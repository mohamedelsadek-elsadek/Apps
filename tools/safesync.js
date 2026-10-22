/* ===== SafeSync v1 — حماية البيانات المشتركة لكل البرامج =====
   1) merge3(base, local, remote): دمج ثلاثي سجل بسجل (حسب id) — جهاز قديم مايقدرش يمسح شغل جهاز تاني.
   2) lsSet(key, str): حفظ محلي؛ لو التخزين مليان يحفظ في IndexedDB ويظهر تحذير أحمر بدل الفشل الصامت.
   3) base: آخر نسخة اتفق عليها الجهاز مع السحابة (في IndexedDB) — أساس معرفة "مين اتغير".
   الكود ده بيتنسخ جوه كل برنامج (single-file) بين علامتي SAFESYNC BEGIN/END. */
(function(G){
  if(G.SafeSync) return;
  var TS_FIELDS=['u','updatedAt','_updatedAt','updated','_u','ts','_ts','t'];
  function isObj(x){return x!==null&&typeof x==='object'&&!Array.isArray(x);}
  function same(a,b){if(a===b)return true;try{return JSON.stringify(a)===JSON.stringify(b);}catch(e){return false;}}
  function recTs(r){if(!isObj(r))return 0;for(var i=0;i<TS_FIELDS.length;i++){var v=r[TS_FIELDS[i]];if(typeof v==='number'&&v>1e11)return v;if(typeof v==='string'&&/^\d{4}-\d\d-\d\dT/.test(v)){var p=Date.parse(v);if(p)return p;}}return 0;}
  /* Firebase بيحوّل الأراي اللي فيها فراغات لأوبجكت بمفاتيح أرقام */
  function asArr(x){if(Array.isArray(x))return x;if(isObj(x)){var ks=Object.keys(x);if(ks.length&&ks.every(function(k){return /^\d+$/.test(k);})){return ks.sort(function(a,b){return a-b;}).map(function(k){return x[k];});}}return x;}
  function idOf(r){return isObj(r)&&(r.id!==undefined&&r.id!==null&&r.id!=='')?String(r.id):null;}
  function keyedArr(a){if(!Array.isArray(a))return false;var n=0;for(var i=0;i<a.length;i++){if(a[i]==null)continue;if(idOf(a[i])===null)return false;n++;}return n>0;}
  function emptyArr(a){return Array.isArray(a)&&a.every(function(v){return v==null;});}
  function primArr(a){return Array.isArray(a)&&a.every(function(v){return v===null||typeof v!=='object';});}
  /* قرار قيمة واحدة: لو اتغيرت عند طرف واحد بس خد التغيير؛ لو الاتنين غيروا: الأحدث بالختم، وإلا المحلي (لو فيه base) أو السحابة (لو مفيش) */
  function pick(b,l,r,hasBase,lRec,rRec){
    if(same(l,r))return l;
    if(hasBase){if(same(l,b))return r;if(same(r,b))return l;}
    var lt=recTs(lRec),rt=recTs(rRec);
    if(lt&&rt&&lt!==rt)return lt>rt?l:r;
    return hasBase?l:r;
  }
  function merge3(b,l,r,hasBase,lRec,rRec){
    if(hasBase===undefined)hasBase=(b!==undefined&&b!==null);
    l=asArr(l);r=asArr(r);b=asArr(b);
    if(l===undefined)return hasBase&&same(r,b)?undefined:r;   /* اتمسح محلياً أو جديد من السحابة */
    if(r===undefined)return hasBase&&same(l,b)?undefined:l;   /* اتمسح في السحابة أو جديد محلي */
    if(same(l,r))return l;
    if(isObj(l)&&isObj(r)){
      var out={},keys={},k;
      for(k in r)keys[k]=1;for(k in l)keys[k]=1;
      for(k in keys){
        /* سياق "السجل" (للختم الزمني) بيتورث من الأراي المفهرسة بس — مش من جذر البيانات */
        var v=merge3(isObj(b)?b[k]:undefined,l[k],r[k],hasBase&&isObj(b),lRec,rRec);
        if(v!==undefined)out[k]=v;
      }
      /* ختم السجل = الأكبر */
      if(lRec!==undefined)TS_FIELDS.forEach(function(f){if(typeof l[f]==='number'&&typeof r[f]==='number'&&l[f]>1e11&&r[f]>1e11)out[f]=Math.max(l[f],r[f]);});
      return out;
    }
    if((keyedArr(l)||emptyArr(l))&&(keyedArr(r)||emptyArr(r))&&(keyedArr(l)||keyedArr(r))&&(b===undefined||b===null||keyedArr(b)||emptyArr(b))){
      var bm={},lm={},rm={},order=[],seen={};
      if(Array.isArray(b))b.forEach(function(x){var i=idOf(x);if(i!==null)bm[i]=x;});
      l.forEach(function(x){var i=idOf(x);if(i!==null)lm[i]=x;});
      r.forEach(function(x){var i=idOf(x);if(i!==null){rm[i]=x;if(!seen[i]){seen[i]=1;order.push(i);}}});
      l.forEach(function(x){var i=idOf(x);if(i!==null&&!seen[i]){seen[i]=1;order.push(i);}});
      var hb=hasBase&&Array.isArray(b),res=[];
      order.forEach(function(i){
        var v=merge3(hb?bm[i]:undefined,lm[i],rm[i],hb&&(i in bm),lm[i],rm[i]);
        /* سجل جديد عند طرف واحد ومش في الـbase → يتضاف؛ موجود في base واتمسح عند طرف ومتغيرش عند التاني → يتشال */
        if(v!==undefined)res.push(v);
      });
      return res;
    }
    if(primArr(l)&&primArr(r)&&(b===undefined||primArr(b))){
      var bs=Array.isArray(b)?b.map(String):null,ls=l.map(String),rs=r.map(String),out2=[],s2={};
      function add(v){var k=String(v);if(!s2[k]){s2[k]=1;out2.push(v);}}
      r.forEach(function(v){var k=String(v);if(bs&&hasBase&&bs.indexOf(k)>=0&&ls.indexOf(k)<0)return;add(v);});
      l.forEach(function(v){var k=String(v);if(bs&&hasBase&&bs.indexOf(k)>=0&&rs.indexOf(k)<0)return;add(v);});
      return out2;
    }
    return pick(b,l,r,hasBase,lRec,rRec);
  }
  /* شكل البيانات زي ما Firebase بيخزنها (بيشيل الأراي/الأوبجكت الفاضية والـnull) — للمقارنة بس */
  function fbNorm(x){
    x=asArr(x);
    if(Array.isArray(x)){var o=[];x.forEach(function(v){v=fbNorm(v);if(v!==undefined)o.push(v);});return o.length?o:undefined;}
    if(isObj(x)){var r={},n=0;Object.keys(x).sort().forEach(function(k){var v=fbNorm(x[k]);if(v!==undefined){r[k]=v;n++;}});return n?r:undefined;}
    if(x===null||x===undefined||(typeof x==='number'&&!isFinite(x)))return undefined;
    return x;
  }
  function sameFb(a,b){return JSON.stringify(fbNorm(a))===JSON.stringify(fbNorm(b));}
  function clone(x){return x===undefined?undefined:JSON.parse(JSON.stringify(x));}
  /* ---------- IndexedDB صغير ---------- */
  var _db=null;
  function idb(){if(_db)return _db;_db=new Promise(function(res,rej){try{var q=indexedDB.open('safesync',1);q.onupgradeneeded=function(){q.result.createObjectStore('kv');};q.onsuccess=function(){res(q.result);};q.onerror=function(){rej(q.error);};}catch(e){rej(e);}});return _db;}
  function idbGet(k){return idb().then(function(d){return new Promise(function(res){try{var t=d.transaction('kv').objectStore('kv').get(k);t.onsuccess=function(){res(t.result===undefined?null:t.result);};t.onerror=function(){res(null);};}catch(e){res(null);}});}).catch(function(){return null;});}
  function idbSet(k,v){return idb().then(function(d){return new Promise(function(res){try{var t=d.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=function(){res(true);};t.onerror=function(){res(false);};}catch(e){res(false);}});}).catch(function(){return false;});}
  function idbDel(k){return idb().then(function(d){return new Promise(function(res){try{var t=d.transaction('kv','readwrite');t.objectStore('kv').delete(k);t.oncomplete=function(){res(true);};}catch(e){res(false);}});}).catch(function(){return false;});}
  /* ---------- تحذير أحمر ---------- */
  function warn(msg){
    try{var el=document.getElementById('ss-warn');
      if(!el){el=document.createElement('div');el.id='ss-warn';el.setAttribute('dir','rtl');
        el.style.cssText='position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;background:#b91c1c;color:#fff;font:600 13px/1.5 system-ui,Tahoma,sans-serif;padding:10px 14px;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.35);display:flex;gap:10px;align-items:center';
        var s=document.createElement('span');s.style.flex='1';el.appendChild(s);
        var x=document.createElement('button');x.textContent='✕';x.style.cssText='background:none;border:0;color:#fff;font-size:16px;cursor:pointer';x.onclick=function(){el.remove();};el.appendChild(x);
        (document.body||document.documentElement).appendChild(el);}
      el.firstChild.textContent=msg;}catch(e){}
  }
  /* ---------- حفظ محلي آمن ---------- */
  function lsSet(key,str){
    try{localStorage.setItem(key,str);idbDel('ls:'+key);return true;}
    catch(e){
      idbSet('ls:'+key,{v:str,t:Date.now()});
      warn('⚠️ مساحة التخزين على الجهاز ده مليانة — بياناتك محفوظة على السحابة وفي مخزن احتياطي، بس فضّي مساحة (امسح نسخ احتياطية قديمة).');
      return false;
    }
  }
  /* يرجّع النسخة المحلية الأحدث (localStorage أو المخزن الاحتياطي لو الحفظ فشل قبل كده) */
  function lsGet(key){
    var v=null;try{v=localStorage.getItem(key);}catch(e){}
    return idbGet('ls:'+key).then(function(f){return f&&f.v?f.v:v;});
  }
  /* ---------- base ---------- */
  function getBase(name){return idbGet('base:'+name);}
  function setBase(name,val){return idbSet('base:'+name,clone(val));}
  G.SafeSync={merge3:function(b,l,r){var hb=b!==undefined&&b!==null;return merge3(hb?clone(b):undefined,clone(l),clone(r),hb);},
    same:sameFb,sameStrict:same,fbNorm:fbNorm,clone:clone,recTs:recTs,asArr:asArr,idbGet:idbGet,idbSet:idbSet,idbDel:idbDel,
    lsSet:lsSet,lsGet:lsGet,getBase:getBase,setBase:setBase,warn:warn};
})(typeof window!=='undefined'?window:globalThis);
