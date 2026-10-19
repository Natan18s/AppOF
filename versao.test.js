// ====================================================================
// versao.test.js — garante que a versão do app aparece no cabeçalho do index.html (selo "vNN") e que o sw.js não carrega mais número de versão
// Rodar:  node --test
// ====================================================================
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const lerArquivo = nome => fs.readFileSync(path.join(__dirname, "..", nome), "utf8");   // index.html e sw.js ficam na raiz do projeto

test("o cabeçalho do index.html mostra a versão do app (vNN, número inteiro positivo)", () => {
  const html = lerArquivo("index.html");
  const achou = /<header[^>]*class="app-header"[\s\S]*?<span id="appVersion"[^>]*>v(\d+)<\/span>[\s\S]*?<\/header>/.exec(html);
  assert.ok(achou, 'faltou o selo <span id="appVersion">vNN</span> dentro do <header class="app-header">');
  assert.ok(Number(achou[1]) >= 26, "o número da versão não pode voltar atrás");
});

test("existe um único selo de versão", () => {
  assert.equal((lerArquivo("index.html").match(/id="appVersion"/g) || []).length, 1);
});

test("o sw.js não precisa mais de número de versão do app (o nome do cache não termina em -vNN)", () => {
  const sw = lerArquivo("sw.js");
  const nome = /const CACHE="([^"]+)"/.exec(sw);
  assert.ok(nome, "não achei const CACHE no sw.js");
  assert.ok(!/-v\d+$/.test(nome[1]), "o nome do cache não deve parecer um número de versão: " + nome[1]);
});
