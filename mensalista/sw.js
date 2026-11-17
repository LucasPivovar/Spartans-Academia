const CACHE='dontstop-member-shell-v2';
const SHELL=['/mensalista/','/mensalista/app.js','/mensalista/styles.css','/mensalista/store.js','/mensalista/store.css','/mensalista/manifest.webmanifest','/assets/logo-spartans.jpg','/assets/member-icons.svg','/assets/pwa/member-192.png','/assets/pwa/member-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('dontstop-member-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  // API responses may contain personal/financial data: always go to the network.
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  const isPage=request.mode==='navigate'&&url.pathname.startsWith('/mensalista');
  const isPublic=url.pathname.startsWith('/assets/')||url.pathname.startsWith('/mensalista/')||['/demo/fixture.json','/demo/api.js','/demo/member-api.js','/demo/professor-api.js','/demo/store-api.js'].includes(url.pathname);
  if(!isPage&&!isPublic)return;
  event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));}return response;}).catch(async()=>{const cached=await caches.match(request);if(cached)return cached;if(isPage)return caches.match('/mensalista/');return Response.error();}));
});
