// ====================================================================
// estrutura.test.js — confere a estrutura do projeto: selo de versão, caminhos dos arquivos, cache do service worker e limite de 500 linhas
// Rodar:  node --test
// ====================================================================
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
const arquivosDoCache = () => {
  const lista = /const FILES=\[([\s\S]*?)\];/.exec(ler("sw.js"));
  assert.ok(lista, "não encontrei a lista FILES do service worker");
  return [...lista[1].matchAll(/["']([^"']+)["']/g)].map(match => match[1]);
};

// ---- versão ----
test("o cabeçalho do index.html mostra a versão do app (vNN, número inteiro positivo)", () => {
  const achou = /<header[^>]*class="app-header"[\s\S]*?<span id="appVersion"[^>]*>v(\d+)<\/span>[\s\S]*?<\/header>/.exec(ler("index.html"));
  assert.ok(achou, 'faltou o selo <span id="appVersion">vNN</span> dentro do <header class="app-header">');
  assert.ok(Number(achou[1]) >= 26, "o número da versão não pode voltar atrás");
});

test("existe um único selo de versão", () => {
  assert.equal((ler("index.html").match(/id="appVersion"/g) || []).length, 1);
});

test("o sw.js não carrega número de versão do app (o nome do cache não termina em -vNN)", () => {
  const nome = /const CACHE="([^"]+)"/.exec(ler("sw.js"));
  assert.ok(nome, "não achei const CACHE no sw.js");
  assert.ok(!/-v\d+$/.test(nome[1]), "o nome do cache não deve parecer um número de versão: " + nome[1]);
});

// ---- caminhos ----
test("os recursos locais do index.html existem", () => {
  const referencias = [...ler("index.html").matchAll(/<(?:script|link|img|source)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi)]
    .map(match => match[1]).filter(referencia => !eRemota(referencia));
  assert.deepEqual(referencias.filter(referencia => !existe(referencia)), []);
});

test("os ícones definidos no manifest.json existem", () => {
  assert.deepEqual(JSON.parse(ler("manifest.json")).icons.map(icone => icone.src).filter(src => !existe(src)), []);
});

test("todos os arquivos do cache do service worker existem", () => {
  assert.deepEqual(arquivosDoCache().filter(referencia => !existe(referencia)), []);
});

test("todo script e estilo local do index.html está na lista FILES do service worker (senão não abre sem internet)", () => {
  const noCache = new Set(arquivosDoCache().map(r => r.replace(/^\.\//, "")));
  const usados = [...ler("index.html").matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi)]
    .map(match => match[1]).filter(r => !eRemota(r) && /\.(?:js|css)$/.test(r));
  assert.deepEqual(usados.filter(r => !noCache.has(r.replace(/^\.\//, ""))), []);
});

// ---- limite de linhas ----
test("nenhum arquivo da raiz passa de 500 linhas (se passar, divida em arquivos menores)", () => {
  const grandes = fs.readdirSync(__dirname)
    .filter(nome => /\.(?:js|css|html|md|json)$/.test(nome))
    .map(nome => [nome, ler(nome).split("\n").length])
    .filter(([, linhas]) => linhas > 500)
    .map(([nome, linhas]) => `${nome} (${linhas} linhas)`);
  assert.deepEqual(grandes, []);
});
