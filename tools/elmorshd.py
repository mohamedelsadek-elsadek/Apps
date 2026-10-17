# يسحب أسعار الدواجن من elmorshdledwagn.com مرتين يوميًا (GitHub Actions)
# ويحفظها في data/elmorshd.json (آخر قراءة) و data/elmorshd_history.json (يوم بيوم)
import urllib.request, re, json, os, html, datetime
URL='https://www.elmorshdledwagn.com/'
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
def get(u):
    r=urllib.request.Request(u,headers={'User-Agent':UA,'Accept-Language':'ar,en;q=0.8'})
    return urllib.request.urlopen(r,timeout=40).read().decode('utf-8','replace')
def txt(x): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',x))).strip()
def num(x):
    x=txt(x).translate(str.maketrans('٠١٢٣٤٥٦٧٨٩','0123456789')).replace(',','')
    m=re.search(r'-?\d+(?:\.\d+)?',x); return float(m.group()) if m else None

def parse(s):
    items=[]
    seg=s[s.find('price-today'):s.find('price-tables') if 'price-tables' in s else len(s)]
    for card in re.split(r'<div class="card">',seg)[1:]:
        t=re.search(r'class="card-title"[^>]*>(.*?)</h5>',card,re.S)
        if not t: continue
        name=txt(t.group(1)); vals={}
        for lab,val in re.findall(r'<span class="text-muted">(.*?)</span>\s*<h5[^>]*>(.*?)</h5>',card,re.S):
            v=num(val)
            if v is not None and v>0: vals[txt(lab)]=v
        if name and vals: items.append({'name':name,'vals':vals})
    tables=[]
    tseg=s[s.find('price-tables'):] if 'price-tables' in s else ''
    for blk in re.split(r'<div class="card-header',tseg)[1:]:
        t=re.search(r'class="card-title[^"]*"[^>]*>(.*?)</h2>',blk,re.S)
        tb=re.search(r'<table.*?</table>',blk,re.S)
        if not t or not tb: continue
        cols=[txt(c) for c in re.findall(r'<th[^>]*>(.*?)</th>',tb.group(),re.S)]
        rows=[]
        for tr in re.findall(r'<tr>(.*?)</tr>',tb.group(),re.S):
            tds=[txt(c) for c in re.findall(r'<td[^>]*>(.*?)</td>',tr,re.S)]
            if tds and any(re.search(r'[1-9]',c) for c in tds[1:]): rows.append(tds)
        if rows: tables.append({'title':txt(t.group(1)),'cols':cols,'rows':rows})
    return items,tables

os.makedirs('data',exist_ok=True)
raw=get(URL)
items,tables=parse(raw)
cairo=datetime.datetime.utcnow()+datetime.timedelta(hours=3)
day=cairo.strftime('%Y-%m-%d')
out={'source':URL,'updated':cairo.strftime('%Y-%m-%d %H:%M'),'date':day,'items':items,'tables':tables}
if not items:
    open('data/elmorshd_raw.html','w',encoding='utf-8').write(raw)   # للتشخيص لو شكل الصفحة اتغيّر
    raise SystemExit('ماقدرتش أقرا الأسعار — اتحفظت الصفحة في data/elmorshd_raw.html')
if os.path.exists('data/elmorshd_raw.html'): os.remove('data/elmorshd_raw.html')
json.dump(out,open('data/elmorshd.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
hp='data/elmorshd_history.json'
try: hist=json.load(open(hp,encoding='utf-8'))
except Exception: hist={}
hist[day]={i['name']:i['vals'] for i in items}
json.dump(dict(sorted(hist.items())),open(hp,'w',encoding='utf-8'),ensure_ascii=False,indent=0)
print('اتسحب',len(items),'صنف و',len(tables),'جدول ليوم',day)
