import json,re
d=json.load(open('/root/ahenk-test-artifacts/ui-results.json'))
s=d['stats'];print({k:s.get(k) for k in('expected','unexpected','skipped')})
def walk(x):
    for su in x.get('suites',[]): walk(su)
    for sp in x.get('specs',[]):
        for t in sp['tests']:
            for r in t['results']:
                if r['status']!='passed':
                    e=re.sub(r'\x1b\[[0-9;]*m','',(r.get('error') or {}).get('message',''))
                    e=' '.join(l.strip() for l in e.split('\n') if l.strip().startswith(('+','Error','Expected','Received','-')))[:300]
                    print('FAIL',sp['title'],'|',e)
for su in d['suites']: walk(su)
