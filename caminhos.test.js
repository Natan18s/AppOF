// Confere se os recursos locais referenciados pelo app existem na raiz.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ler = nome => fs.readFileSync(path.join(__dirname, nome), "utf8");
const existe = referencia => {
  const local = referencia.split(/[?#]/, 1)[0].replace(/^\.\//, "");
  return fs.existsSync(path.resolve(__dirname, local));
};
const eRemota = referencia => /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(referencia);

test("os recursos locais do index.html existem", () => {
  const html = ler("index.html");
  const referencias = [...html.matchAll(/<(?:script|link|img|source)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi)]
    .map(match => match[1])
    .filter(referencia => !eRemota(referencia));
  assert.deepEqual(referencias.filter(referencia => !existe(referencia)), []);
});

test("os ícones definidos no manifest.json existem", () => {
  const manifesto = JSON.parse(ler("manifest.json"));
  assert.deepEqual(manifesto.icons.map(icone => icone.src).filter(src => !existe(src)), []);
});

test("todos os arquivos do cache do service worker existem", () => {
  const sw = ler("sw.js");
  const arquivos = /const FILES=\[([\s\S]*?)\];/.exec(sw);
  assert.ok(arquivos, "não encontrei a lista FILES do service worker");
  const referencias = [...arquivos[1].matchAll(/["']([^"']+)["']/g)].map(match => match[1]);
  assert.deepEqual(referencias.filter(referencia => !existe(referencia)), []);
});
