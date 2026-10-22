/* Carnet de trafic : fonctionnement hors ligne */
var VERSION = "carnet-v8-2026-10-22";
var SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png",
  "./icon-maskable-192.png", "./icon-maskable-512.png", "./apple-touch-icon.png", "./favicon-32.png", "./icon.svg"];
var RUNTIME = "carnet-ext-v1";
var EXT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"];

self.addEventListener("install", function(e){
  /* chaque fichier est mis en cache séparément : un fichier manquant ne bloque pas le reste */
  e.waitUntil(caches.open(VERSION).then(function(c){
    return Promise.all(SHELL.map(function(u){ return c.add(new Request(u, {cache:"reload"})).catch(function(){}); }));
  }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== VERSION && k !== RUNTIME; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
function timeout(ms){ return new Promise(function(_, rej){ setTimeout(function(){ rej(new Error("timeout")); }, ms); }); }
self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  /* page de l'appli : réseau d'abord (mises à jour immédiates), cache si hors ligne ou trop lent */
  if (req.mode === "navigate" && url.origin === self.location.origin) {
    e.respondWith(caches.open(VERSION).then(function(c){
      var net = fetch(req, {cache:"no-store"}).then(function(r){ if (r && r.ok) c.put("./index.html", r.clone()); return r; });
      return Promise.race([net, timeout(3000)]).catch(function(){
        return c.match("./index.html").then(function(hit){ return hit || net; });
      });
    }));
    return;
  }
  /* fichiers de l'appli */
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req, {ignoreSearch:true}).then(function(hit){
      var net = fetch(req).then(function(r){
        if (r && r.ok) { var cp = r.clone(); caches.open(VERSION).then(function(c){ c.put(req, cp); }); }
        return r;
      });
      return hit || net;
    }));
    return;
  }
  /* polices et fond de carte : gardés après le premier chargement */
  if (EXT_HOSTS.indexOf(url.hostname) >= 0) {
    e.respondWith(caches.open(RUNTIME).then(function(c){
      return c.match(req).then(function(hit){
        var net = fetch(req).then(function(r){ if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()); return r; }).catch(function(){ return hit; });
        return hit || net;
      });
    }));
  }
});
self.addEventListener("message", function(e){
  if (e.data && e.data.type === "precache-map") {
    caches.open(RUNTIME).then(function(c){
      return Promise.all(e.data.urls.map(function(u){ return c.match(u).then(function(h){ return h || fetch(u, {mode:"cors"}).then(function(r){ if (r.ok) return c.put(u, r); }).catch(function(){}); }); }));
    });
  }
});
