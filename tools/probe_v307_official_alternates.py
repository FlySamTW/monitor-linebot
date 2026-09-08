"""Read public official alternate manuals, never activate or bypass protected files."""
import concurrent.futures, hashlib, json, re, io, zipfile, sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, parse_qs
import requests, fitz

OUT=Path(__file__).resolve().parents[1]/'output/manual_library/v307_official_alternates_20260908'
URLS=[
 'https://www.samsung.com/uk/support/model/LS27D396GAUXXU/',
 'https://www.samsung.com/fi/support/model/LS27F612EAUXEN/',
 'https://www.samsung.com/au/support/model/LS27D390GAEXXY/',
 'https://www.samsung.com/fr/support/model/LS32D392GAUXEN/',
 'https://www.samsung.com.cn/support/model/LS32AM703UCXXF/',
]
def get(url):
 r=requests.get(url,timeout=45);r.raise_for_status()
 if urlparse(r.url).hostname not in ['www.samsung.com','www.samsung.com.cn','downloadcenter.samsung.com','org.downloadcenter.samsung.com']:raise ValueError('nonofficial redirect')
 return r
def probe(url):
 result={'supportUrl':url,'checkedAt':datetime.now(timezone.utc).isoformat(),'manuals':[]}
 try:
  r=get(url);html=r.content.decode('utf8');result['supportSha']=hashlib.sha256(r.content).hexdigest()
  (OUT/(urlparse(url).path.strip('/').replace('/','_')+'.html')).write_bytes(r.content)
  match=re.search(r'"manuals"\s*:\s*\[',html)
  manuals=json.JSONDecoder().raw_decode(html[match.end()-1:])[0] if match else []
  result['available']=[{k:m.get(k) for k in ['description','fileName','contentsTypeCode','downloadUrl','languageList']} for m in manuals]
  for m in manuals:
   if m.get('contentsTypeCode')!='UM':continue
   if not m.get('fileName','').lower().endswith(('.pdf','.zip')):continue
   langs=str(m.get('languageList',''))
   if not re.search('ENGLISH|CHINESE|MULTI LANGUAGE|EN',langs,re.I):continue
   rec={k:m.get(k) for k in ['description','fileName','fileID','downloadUrl','languageList','fileVersion']};result['manuals'].append(rec)
   original=m['downloadUrl'].replace('&amp;','&')
   vpath=parse_qs(urlparse(original).query).get('VPath',[''])[0]
   direct='https://downloadcenter.samsung.com/content/'+vpath
   rec['directUrl']=direct
   raw=get(direct).content
   if raw.startswith(b'PK'):
    rec['archiveSha256']=hashlib.sha256(raw).hexdigest()
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
     names=[n for n in z.namelist() if re.search(r'(?:^|[_/ -])ENG(?:[_ .-]|$)',n,re.I) and n.lower().endswith('.pdf')]
     rec['englishEntries']=names
     if len(names)!=1:continue
     rec['archiveEntry']=names[0];raw=z.read(names[0])
   sha=hashlib.sha256(raw).hexdigest()
   rec.update(sha256=sha,size=len(raw),standardPdf=raw.startswith(b'%PDF-'))
   (OUT/(sha+'.pdf')).write_bytes(raw)
   if rec['standardPdf']:
    with fitz.open(stream=raw,filetype='pdf') as pdf:
     rec['pages']=len(pdf);rec['cover']=pdf[0].get_text(sort=True)
     pdf[0].get_pixmap(matrix=fitz.Matrix(1,1)).save(str(OUT/(sha+'_cover.png')))
 except Exception as e:result['error']=str(e)
 return result
if __name__=='__main__':
 if '--inventory' in sys.argv:
  for file in OUT.glob('*.html'):
   html=file.read_text(encoding='utf8');match=re.search(r'"manuals"\s*:\s*\[',html)
   manuals=json.JSONDecoder().raw_decode(html[match.end()-1:])[0] if match else []
   print(json.dumps({'file':file.name,'manuals':[{k:m.get(k) for k in ['fileName','contentsTypeCode','downloadUrl','languageList']} for m in manuals]},ensure_ascii=True))
  sys.exit(0)
 OUT.mkdir(parents=True,exist_ok=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:results=list(pool.map(probe,URLS))
 (OUT/'evidence.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
 for r in results:print(json.dumps(r,ensure_ascii=True))
