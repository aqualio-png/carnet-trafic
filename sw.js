/* Carnet de trafic : fonctionnement hors ligne */
var VERSION = "carnet-v5-2026-10-21";
var SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png",
  "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png", "./icons/icon.svg"];
var RUNTIME = "carnet-ext-v1";
var EXT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"];

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){ return c.addAll(SHELL); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== VERSION && k !== RUNTIME; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  /* page de l'appli : réponse immédiate depuis le cache, mise à jour en arrière-plan */
  if (req.mode === "navigate" && url.origin === self.location.origin) {
    e.respondWith(caches.open(VERSION).then(function(c){
      return c.match("./index.html").then(function(hit){
        var net = fetch(req).then(function(r){ if (r && r.ok) c.put("./index.html", r.clone()); return r; }).catch(function(){ return hit; });
        return hit || net;
      });
    }));
    return;
  }
  /* fichiers de l'appli */
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req, {ignoreSearch:true}).then(function(hit){
      return hit || fetch(req).then(function(r){
        if (r && r.ok) { var cp = r.clone(); caches.open(VERSION).then(function(c){ c.put(req, cp); }); }
        return r;
      });
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
  /* l'appli demande de préparer la carte hors ligne */
  if (e.data && e.data.type === "precache-map") {
    caches.open(RUNTIME).then(function(c){
      return Promise.all(e.data.urls.map(function(u){ return c.match(u).then(function(h){ return h || fetch(u, {mode:"cors"}).then(function(r){ if (r.ok) return c.put(u, r); }).catch(function(){}); }); }));
    });
  }
});
