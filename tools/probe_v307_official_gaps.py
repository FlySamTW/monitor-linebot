"""Read-only public Samsung evidence collector; never alters registry or GAS."""
import concurrent.futures
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import fitz
import requests
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/manual_library/v307_official_gaps_20260908'
MODELS = ['S27D392GAC', 'S32D392GAC', 'S27F612EAC', 'S32AM703UC', 'S32FM902SC']

def probe(model):
    url = 'https://www.samsung.com/tw/support/model/L' + model + 'XZW/'
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    html = response.text
    match = re.search(r'"manuals"\s*:\s*\[', html)
    records = json.JSONDecoder().raw_decode(html[match.end()-1:])[0] if match else []
    result = {'model': model, 'supportUrl': url, 'collectedAt': datetime.now(timezone.utc).isoformat(), 'supportSha256': hashlib.sha256(response.content).hexdigest(), 'manuals': []}
    (OUT / (model + '.html')).write_bytes(response.content)
    for item in records:
        record = {k: item.get(k) for k in ['fileName', 'fileID', 'downloadUrl', 'contentsTypeCode', 'fileVersion', 'languageList', 'description']}
        result['manuals'].append(record)
        if item['fileName'].lower().endswith('.pdf'):
            try:
                r = requests.get(item['downloadUrl'].replace('&amp;', '&'), timeout=60)
                r.raise_for_status()
                raw = r.content
                sha = hashlib.sha256(raw).hexdigest()
                record.update(sha256=sha, size=len(raw), header=repr(raw[:40]))
                target = OUT / (sha + '.pdf')
                target.write_bytes(raw)
                record['localFile'] = str(target.relative_to(ROOT))
                if raw.startswith(b'%PDF-'):
                    with fitz.open(stream=raw, filetype='pdf') as pdf:
                        record['pages'] = len(pdf)
                        record['cover'] = pdf[0].get_text(sort=True)
                        pdf[0].get_pixmap(matrix=fitz.Matrix(1, 1)).save(str(OUT / (sha + '_cover.png')))
                else:
                    record['rejection'] = 'not_standard_pdf_no_bypass'
            except Exception as exc:
                record['error'] = str(exc)
    return result

if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(probe, MODELS))
    (OUT / 'evidence.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    html_manual = results[-1]['manuals'][-1]['downloadUrl']
    start = requests.get(html_manual, timeout=60)
    start.raise_for_status()
    html_evidence = []
    for name in ['start_here.html', 'sidebar.html', '1_tv-guide_1.html']:
        url = urljoin(start.url, name)
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        (OUT / ('M9_' + name)).write_bytes(response.content)
        decoded = response.content.decode('utf-8')
        html_evidence.append({'url': url, 'sha256': hashlib.sha256(response.content).hexdigest(), 'bytes': len(response.content), 'title': re.findall(r'<title>(.*?)</title>', decoded), 'links': re.findall(r'href="([^"]+)"', decoded)})
    (OUT / 'm9_html_evidence.json').write_text(json.dumps(html_evidence, ensure_ascii=False, indent=2), encoding='utf-8')
    for result in results:
        print(json.dumps({'model': result['model'], 'manuals': len(result['manuals'])}, ensure_ascii=True))
