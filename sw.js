// Service worker: guarda os arquivos do app no aparelho para abrir rápido e funcionar sem internet.
// O número da versão do app fica visível no cabeçalho do index.html (selo "vNN"); NÃO é preciso mexer neste arquivo a cada alteração.
// O app sempre pede os arquivos novos à internet (revalidando) e só usa o cache quando está sem conexão. Mexa aqui só se criar/remover
// um arquivo da lista FILES ou mudar o próprio service worker. O nome do cache abaixo não é a versão do app.
const CACHE="meu-controle-cache";
// Lista de arquivos guardados. Se criar um arquivo novo (.css ou .js), inclua-o aqui.
const FILES=[
  "./","./index.html","./manifest.json",
  "./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png",
  "./css/theme.css","./css/base.css","./css/components.css",
  "./js/utils.js", "./js/config.js", "./js/theme.js", "./js/calculations.js", "./js/storage.js",
  "./js/ui.js", "./js/dashboard.js", "./js/sheet-drag.js", "./js/transactions.js", "./js/cadastros.js",
  "./js/importer.js", "./js/backup.js", "./js/recorrentes.js", "./js/graficos.js", "./js/exportar.js",
  "./js/demo.js", "./js/bloqueio.js", "./js/integridade.js", "./js/main.js"
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
