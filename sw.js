// Service worker: guarda os arquivos do app no aparelho para abrir rápido e funcionar sem internet.
// O número da versão do app fica visível no cabeçalho do index.html (selo "vNN"); NÃO é preciso mexer neste arquivo a cada alteração.
// O app sempre pede os arquivos novos à internet (revalidando) e só usa o cache quando está sem conexão. Mexa aqui só se criar/remover
// um arquivo da lista FILES ou mudar o próprio service worker. O nome do cache abaixo não é a versão do app.
const CACHE="meu-controle-cache";
// Lista de arquivos guardados. Se criar um arquivo novo (.css ou .js), inclua-o aqui.
const FILES=[
  "./","./index.html","./manifest.json",
  "./icon-192.png","./icon-512.png","./icon-maskable-512.png",
  "./theme.css","./base.css","./components.css",
  "./utils.js", "./config.js", "./theme.js", "./calculations.js", "./storage.js",
  "./ui.js", "./dashboard.js", "./sheet-drag.js", "./transactions.js", "./cadastros.js",
  "./importer.js", "./backup.js", "./recorrentes.js", "./graficos.js", "./exportar.js",
  "./demo.js", "./bloqueio.js", "./integridade.js", "./main.js"
];
// Instalação: baixa e guarda todos os arquivos da lista
// ("reload" ignora a cópia temporária do navegador, para guardar sempre a versão mais nova do servidor)
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:"reload"})))));self.skipWaiting()});
// Ativação: apaga caches de versões antigas
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
// Busca: tenta a internet primeiro (revalida sempre, então uma atualização publicada aparece na hora) e, sem internet, usa o que está guardado
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET")return;
  e.respondWith(fetch(e.request,{cache:"no-cache"}).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)));
});
