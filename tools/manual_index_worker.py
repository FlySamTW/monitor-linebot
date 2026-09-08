"""Zero-provider local PDF worker. Secret is supplied by environment, never printed."""
from __future__ import annotations
import argparse
import base64
import gzip
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import tempfile
import time
import zipfile
from urllib.parse import urlsplit
import requests
from build_manual_page_index import build_document, dump_json_bytes


def official_url(url: str) -> bool:
    parsed = urlsplit(url)
    return (parsed.scheme == 'https' and parsed.hostname in
            {'downloadcenter.samsung.com', 'downloadcenter2.samsung.com', 'org.downloadcenter.samsung.com'} and
            not parsed.username and not parsed.password and parsed.port in (None, 443))


def request(endpoint: str, secret: str, action: str, payload: dict) -> dict:
    envelope = {'protocol': 'manual-index-worker-v1', 'timestamp': int(time.time() * 1000),
                'nonce': secrets.token_hex(16), 'action': action,
                'payload': json.dumps(payload, ensure_ascii=False, separators=(',', ':'))}
    message = '\n'.join(str(envelope[key]) for key in ('protocol', 'timestamp', 'nonce', 'action', 'payload'))
    envelope['signature'] = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
    response = requests.post(endpoint, json=envelope, timeout=240)
    response.raise_for_status()
    result = response.json()
    if not result.get('ok'):
        raise RuntimeError(result.get('error', 'WORKER_REMOTE_FAILED'))
    return result


def download(url: str, destination: Path, expected_sha: str, *, archive: bool = False) -> None:
    session = requests.Session()
    for _ in range(6):
        if not official_url(url):
            raise RuntimeError('WORKER_DOWNLOAD_HOST')
        response = session.get(url, allow_redirects=False, stream=True, timeout=90)
        if response.is_redirect:
            from urllib.parse import urljoin
            url = urljoin(url, response.headers['Location'])
            response.close()
            continue
        response.raise_for_status()
        size = 0
        digest = hashlib.sha256()
        with destination.open('wb') as handle:
            for chunk in response.iter_content(65536):
                size += len(chunk)
                if size > (96 if archive else 48) * 1024 * 1024:
                    raise RuntimeError('WORKER_PDF_SIZE')
                digest.update(chunk)
                handle.write(chunk)
        if digest.hexdigest() != expected_sha:
            raise RuntimeError('WORKER_ARCHIVE_SHA' if archive else 'WORKER_PDF_SHA')
        with destination.open('rb') as handle:
            if not archive and handle.read(5) != b'%PDF-':
                raise RuntimeError('WORKER_PDF_HEADER')
        return
    raise RuntimeError('WORKER_REDIRECT_LIMIT')


def extract_zip_pdf(source: Path, destination: Path, entry: str, expected_sha: str) -> None:
    def safe_name(name: str) -> bool:
        return bool(name) and len(name) <= 512 and not re.search(r'[\\\x00-\x1f:]', name) and not name.startswith('/') and all(p not in ('.', '..') for p in name.split('/'))
    if not safe_name(entry) or not entry.lower().endswith('.pdf'):
        raise RuntimeError('WORKER_ZIP_ENTRY')
    with zipfile.ZipFile(source) as archive:
        members = archive.infolist()
        if not members or len(members) > 512:
            raise RuntimeError('WORKER_ZIP_LIMIT')
        names = set()
        for member in members:
            if member.extract_version >= 45:
                raise RuntimeError('WORKER_ZIP_FORMAT')
            if not safe_name(member.filename) or member.flag_bits & 1:
                raise RuntimeError('WORKER_ZIP_PATH')
            if member.filename in names:
                raise RuntimeError('WORKER_ZIP_DUPLICATE')
            names.add(member.filename)
        selected = [member for member in members if member.filename == entry]
        if len(selected) != 1:
            raise RuntimeError('WORKER_ZIP_ENTRY')
        member = selected[0]
        if not 0 < member.file_size <= 48 * 1024 * 1024 or member.file_size / max(1, member.compress_size) > 200 or member.compress_type not in (0, 8):
            raise RuntimeError('WORKER_ZIP_EXPANSION_LIMIT')
        digest = hashlib.sha256()
        with archive.open(member) as incoming, destination.open('wb') as outgoing:
            count = 0
            while chunk := incoming.read(65536):
                count += len(chunk)
                if count > member.file_size:
                    raise RuntimeError('WORKER_ZIP_EXPANSION_LIMIT')
                digest.update(chunk)
                outgoing.write(chunk)
        if count != member.file_size or digest.hexdigest() != expected_sha:
            raise RuntimeError('WORKER_PDF_SHA')
    with destination.open('rb') as pdf:
        if pdf.read(5) != b'%PDF-':
            raise RuntimeError('WORKER_PDF_HEADER')


def reviewed_index_content(checksum: str) -> bytes:
    """Reviewed releases pin their exact approved index, not today's lexicon."""
    if not re.fullmatch(r'[a-f0-9]{64}', checksum):
        raise RuntimeError('WORKER_REGISTERED_INDEX_CHECKSUM')
    pack_path = Path(__file__).resolve().parent / 'data/manual_index_packages' / (checksum + '.json')
    if not pack_path.is_file():
        pack_path = Path(__file__).resolve().parents[1] / 'output/manual_library/editor_import.json'
    pack = json.loads(pack_path.read_text(encoding='utf-8'))
    records = [r for r in pack['records'] if r.get('sha256') == checksum]
    if len(records) != 1:
        raise RuntimeError('WORKER_REGISTERED_INDEX_MISSING')
    compressed = base64.b64decode(records[0]['data'], validate=True)
    if len(compressed) > 4 * 1024 * 1024 or int.from_bytes(compressed[-4:], 'little') > 24 * 1024 * 1024:
        raise RuntimeError('WORKER_REGISTERED_INDEX_LIMIT')
    content = gzip.decompress(compressed)
    if hashlib.sha256(content).hexdigest() != checksum:
        raise RuntimeError('WORKER_REGISTERED_INDEX_CHECKSUM')
    return content


def run(endpoint: str, secret: str, lexicon_path: Path, start_after: str = '') -> dict:
    state = request(endpoint, secret, 'list', {})
    completed, failed = [], []
    lexicon = json.loads(lexicon_path.read_text(encoding='utf-8'))
    pending = state['pending']
    # Persist a fair cursor in the sanitized local report: failed early items
    # must not permanently starve later manuals in the bounded daily batch.
    previous = next((i for i, item in enumerate(pending) if item['pendingKey'] == start_after), -1)
    if previous >= 0:
        pending = pending[previous + 1:] + pending[:previous + 1]
    last_attempted = start_after
    for item in pending[:20]:
      last_attempted = item['pendingKey']
      try:
        with tempfile.TemporaryDirectory(prefix='samsung-manual-worker-') as directory:
            root = Path(directory)
            if item.get('sourceFormat') == 'zip_entry_pdf':
                download(item['downloadUrl'], root / 'source.zip', item['archiveSha256'], archive=True)
                extract_zip_pdf(root / 'source.zip', root / 'source.pdf', item['archiveEntry'], item['sourcePdfSha256'])
            else:
                download(item['downloadUrl'], root / 'source.pdf', item['sourcePdfSha256'])
            document = dict(item, docKey='worker_candidate', sourceFileName='source.pdf')
            if item.get('reviewedDocKey'):
                content = reviewed_index_content(item['expectedIndexChecksum'])
            else:
                built = build_document(document, root, root / 'index', lexicon, 40)
                content = dump_json_bytes({'lex': built['lex'], 'pages': built['pages']})
            package = {'pendingKey': item['pendingKey'], 'baseRevision': state['revision'],
                       'sourcePdfSha256': item['sourcePdfSha256'],
                       'indexChecksum': hashlib.sha256(content).hexdigest(),
                       'gzip': base64.b64encode(gzip.compress(content, mtime=0)).decode('ascii')}
            if item.get('sourceFormat') == 'zip_entry_pdf' and item.get('reviewedDocKey'):
                pdf = (root / 'source.pdf').read_bytes()
                if len(pdf) > 8 * 1024 * 1024:
                    raise RuntimeError('WORKER_PDF_UPLOAD_LIMIT')
                package['pdfData'] = base64.b64encode(pdf).decode('ascii')
            elif item.get('sourceFormat') == 'zip_entry_pdf' and (root / 'source.zip').stat().st_size > 48 * 1024 * 1024:
                raise RuntimeError('WORKER_ZIP_REVIEW_REQUIRED')
            if len(package['gzip']) > 5500000:
                raise RuntimeError('WORKER_PACKAGE_TOO_LARGE')
            result = request(endpoint, secret, 'prepare', package)
            readback = request(endpoint, secret, 'list', {})
            if readback['revision'] != result['revision']:
                raise RuntimeError('WORKER_ACTIVATION_READBACK')
            probe = request(endpoint, secret, 'probe', {'docKey': result.get('docKey', 'worker_' + item['models'][0])})
            if (probe['revision'] != result['revision'] or not probe['verified'] or
                probe['verified'][0]['sourcePdfSha256'] != item['sourcePdfSha256'] or
                probe['verified'][0]['indexChecksum'] != package['indexChecksum']):
                raise RuntimeError('WORKER_CONTENT_READBACK')
            state = readback
            completed.append({'model': item['fullSku'], 'revision': result['revision']})
      except Exception as error:
        code = str(error) if re.fullmatch(r'WORKER_[A-Z_]+', str(error)) else type(error).__name__
        failed.append({'model': item.get('fullSku', ''), 'error': code})
        # Refresh the base after an uncertain response; never blindly overwrite.
        state = request(endpoint, secret, 'list', {})
    request(endpoint, secret, 'health', {'ok': not failed, 'completed': len(completed), 'failed': len(failed)})
    return {'ok': not failed, 'completed': completed, 'failed': failed, 'providerCalls': 0,
            'lastAttempted': last_attempted}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--endpoint', required=True)
    parser.add_argument('--secret-env', default='SAMSUNG_MANUAL_WORKER_SECRET')
    parser.add_argument('--secret-file', type=Path, help='Local restricted plaintext or JSON {secret: ...}; never logged')
    parser.add_argument('--report', type=Path, help='Sanitized local result; never contains secrets')
    parser.add_argument('--lexicon', type=Path, default=Path(__file__).resolve().parents[1] / 'config/manual_lexicon.json')
    args = parser.parse_args()
    if not re.fullmatch(r'https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec', args.endpoint):
        parser.error('Only the existing official GAS /exec endpoint is allowed')
    secret = os.environ.get(args.secret_env, '')
    if args.secret_file:
        value = args.secret_file.read_text(encoding='utf-8-sig').strip()
        secret = json.loads(value)['secret'] if value.startswith('{') else value
    if not re.fullmatch(r'[a-fA-F0-9]{64}', secret):
        parser.error('A 64-hex editor-provisioned worker secret is required in the selected environment variable')
    try:
        start_after = ''
        if args.report and args.report.exists():
            try:
                start_after = str(json.loads(args.report.read_text(encoding='utf-8')).get('lastAttempted', ''))
            except (ValueError, OSError):
                pass
        result = run(args.endpoint, secret, args.lexicon, start_after)
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps(dict(result, finishedAt=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())),ensure_ascii=False),encoding='utf-8')
        print(json.dumps(result, ensure_ascii=False))
        return 0 if result['ok'] else 1
    except Exception as error:
        # Avoid requests exceptions that could echo credential-bearing URLs/bodies.
        code = str(error) if re.fullmatch(r'WORKER_[A-Z_]+', str(error)) else type(error).__name__
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps({'ok':False,'error':code,'finishedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}),encoding='utf-8')
        print(json.dumps({'ok': False, 'error': code, 'providerCalls': 0}))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
