#!/usr/bin/env bash
# Tek dosya desenleriyle kısa özet: bash run1.sh api/2_03*.test.js
cd "$(dirname "$0")"
node --test --test-concurrency=1 --test-timeout=300000 --test-reporter=tap "$@" > /tmp/e2e-last.tap 2>&1
python3 - <<'PY'
import re
t=open('/tmp/e2e-last.tap').read().split('\n')
cur=None;n=0;msg=[]
out=[]
for i,l in enumerate(t):
    m=re.match(r'^\s*not ok \d+ - (.*)',l)
    if m:
        ctx=t[i+1:i+40]; e=[]
        for c in ctx:
            s=c.strip()
            if re.match(r'^(not ok|ok )',s): break
            if s.startswith(('error:','expected:','actual:')) and s not in('error: |-',): e.append(s[:150])
            elif len(e)==0 and s and not s.startswith(('---','duration','type:','location','failureType','code:','name:','stack','operator','at ','error: |-','...')): e.append(s[:160])
        print('FAIL',m.group(1),'|',' ; '.join(e[:4]))
for l in t:
    if re.match(r'^# (tests|pass|fail) ',l): print(l)
PY
