// Service worker: guarda os arquivos do app no aparelho para abrir rápido e funcionar sem internet.
// Sempre que mudar QUALQUER arquivo do app, aumente o número da versão abaixo (v6 -> v7...) para o celular baixar a versão nova.
const CACHE="meu-controle-v22";
// Lista de arquivos guardados. Se criar um arquivo novo (.css ou .js), inclua-o aqui.
const FILES=[
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./theme.css",
  "./base.css",
  "./components.css",
  "./utils.js",
  "./config.js",
  "./theme.js",
  "./calculations.js",
  "./storage.js",
  "./ui.js",
  "./dashboard.js",
  "./sheet-drag.js",
  "./transactions.js",
  "./cadastros.js",
  "./importer.js",
  "./backup.js",
  "./recorrentes.js",
  "./graficos.js",
  "./exportar.js",
  "./demo.js",
  "./bloqueio.js",
  "./integridade.js",
  "./main.js"
];
// Instalação: baixa e guarda todos os arquivos da lista
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting()});
// Ativação: apaga caches de versões antigas
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
// Busca: tenta a internet primeiro (para sempre ter a versão nova) e, sem internet, usa o que está guardado
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)));
});
