/* Service Worker — نظام إدارة مزارع الدواجن
   الصفحة: شبكة أولاً (أحدث نسخة دائماً) · الأصول: كاش أولاً مع تحديث بالخلفية */
const C='brmas-v124';
self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k!==C).map(k=>caches.delete(k)));
  await self.clients.claim();
})());});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||r.url.includes('firebaseio')||r.url.includes('firebasedatabase')||r.url.includes('googleapis')||r.url.includes('gstatic'))return;
  const isDoc=r.mode==='navigate'||(r.headers.get('accept')||'').includes('text/html');
  if(isDoc){
    e.respondWith(
      fetch(r,{cache:'no-store'}).then(resp=>{const c=resp.clone();caches.open(C).then(ch=>ch.put(r,c));return resp;})
        .catch(()=>caches.match(r).then(h=>h||caches.match('./')))
    );
    return;
  }
  e.respondWith(
    caches.open(C).then(cache=>cache.match(r).then(hit=>{
      const net=fetch(r).then(resp=>{try{cache.put(r,resp.clone());}catch(_){}return resp;}).catch(()=>hit);
      return hit||net;
    }))
  );
});
