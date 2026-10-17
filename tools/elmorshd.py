# يسحب أسعار الدواجن من elmorshdledwagn.com ويحفظها في data/elmorshd.json
import urllib.request, re, json, os, html, datetime, sys
URL='https://www.elmorshdledwagn.com/'
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
def get(u):
    r=urllib.request.Request(u,headers={'User-Agent':UA,'Accept-Language':'ar,en;q=0.8'})
    return urllib.request.urlopen(r,timeout=40).read().decode('utf-8','replace')
os.makedirs('data',exist_ok=True)
raw=get(URL)
open('data/elmorshd_raw.html','w',encoding='utf-8').write(raw)
print('fetched',len(raw))
