// ====================================================================
// importacao.test.js — testes da importação de extratos (CSV/OFX): gasto x entrada, tipo por linha e correção de importações antigas
// Rodar:  node --test        (não precisa instalar nada)
// ====================================================================
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Ambiente de teste: o mínimo que o navegador oferece, mais respostas combinadas para as caixas de confirmação.
function novoAmbiente({ confirma = true } = {}) {
  const store = new Map();
  const sandbox = {
    console, structuredClone, Buffer, crypto: require("node:crypto").webcrypto, TextDecoder, TextEncoder, btoa, atob,
    window: { addEventListener() {} }, document: { getElementById: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    askAlert() {}, renderAll() {}, perguntas: [],
    askConfirm(msg) { sandbox.perguntas.push(msg); return Promise.resolve(confirma); }
  };
  const ctx = vm.createContext(sandbox);
  for (const f of ["utils.js", "config.js", "calculations.js", "storage.js", "importer.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx, { filename: f });
  }
  vm.runInContext('data = structuredClone(defaultData); data.cards = [{id:"c1",name:"Cartão",limit:1000,closing:10,due:19}];', ctx);
  return { sandbox, run: code => vm.runInContext(code, ctx) };
}
// Lê um "arquivo" de texto pelo mesmo caminho que o app usa (parseImport).
function importar(env, nome, texto) {
  env.sandbox.__nome = nome; env.sandbox.__texto = texto;
  return env.run('parseImport({name:__nome,type:"",arrayBuffer:async()=>Uint8Array.from(Buffer.from(__texto)).buffer})');
}
const ofx = linhas => `<OFX><BANKMSGSRSV1><ORG>Nubank\n${linhas.map(([d, v, m], i) => `<STMTTRN>\n<TRNTYPE>OTHER\n<DTPOSTED>${d}000000\n<TRNAMT>${v}\n<FITID>${i + 1}\n<MEMO>${m}\n</STMTTRN>`).join("\n")}\n</OFX>`;
// Array.from: as listas vêm do ambiente isolado (outro "reino" do JavaScript) e o deepEqual exige listas comuns.
const tipos = rows => Array.from(rows, r => (r.isCardPayment ? "pagamento" : r.isExpense ? "gasto" : "entrada"));

test("OFX de cartão com compras NEGATIVAS: compras viram gasto, estorno vira entrada, pagamento da fatura é pagamento", async () => {
  const env = novoAmbiente();
  const r = await importar(env, "fatura.ofx", ofx([["20261005", "-50.00", "Mercado"], ["20261006", "-30.00", "Uber"], ["20261007", "-20.00", "Farmácia"], ["20261008", "15.00", "Estorno Uber"], ["20261009", "300.00", "Pagamento recebido"]]));
  assert.equal(r.expenseSign, -1);
  assert.deepEqual(tipos(r.rows), ["gasto", "gasto", "gasto", "entrada", "pagamento"]);
  assert.ok(r.rows.slice(0, 3).every(x => x.cardId && x.paymentStatus === "planned"), "gasto no cartão fica previsto");
  assert.equal(r.rows[0].paymentDate, "2026-10-19", "compra antes do fechamento (dia 10) vence no dia 19 do mesmo mês");
  assert.equal(r.rows[0].value, 50, "o valor guardado é sempre positivo");
});

test("OFX de cartão com compras POSITIVAS também funciona (maioria positiva)", async () => {
  const env = novoAmbiente();
  const r = await importar(env, "fatura.ofx", ofx([["20261005", "50.00", "Mercado"], ["20261006", "30.00", "Uber"], ["20261007", "-10.00", "Estorno"], ["20261009", "-300.00", "Pagamento recebido"]]));
  assert.equal(r.expenseSign, 1);
  assert.deepEqual(tipos(r.rows), ["gasto", "gasto", "entrada", "pagamento"]);
});

test("CSV do Nubank (compras positivas, estorno negativo): continua como antes", async () => {
  const env = novoAmbiente();
  const r = await importar(env, "nubank.csv", "date,title,amount\n2026-10-05,Mercado,50.00\n2026-10-06,Uber,30.00\n2026-10-07,Estorno Uber,-12.00\n2026-10-09,Pagamento recebido,-300.00\n");
  assert.deepEqual(tipos(r.rows), ["gasto", "gasto", "entrada", "pagamento"]);
  assert.equal(r.expenseSign, 1);
});

test("CSV de cartão com compras NEGATIVAS (vírgula decimal): compras viram gasto", async () => {
  const env = novoAmbiente();
  const r = await importar(env, "cartao.csv", "Data;Descrição;Valor\n05/10/2026;Mercado;-50,00\n06/10/2026;Uber;-30,00\n07/10/2026;Padaria;-8,50\n08/10/2026;Estorno;15,00\n");
  assert.equal(r.expenseSign, -1);
  assert.deepEqual(tipos(r.rows), ["gasto", "gasto", "gasto", "entrada"]);
  assert.deepEqual(Array.from(r.rows, x => x.value), [50, 30, 8.5, 15]);
});

test("extrato de conta (maioria negativa, salário positivo): salário é entrada", async () => {
  const env = novoAmbiente();
  const r = await importar(env, "conta.csv", "Data;Descrição;Valor\n01/10/2026;Salário;3000,00\n02/10/2026;Aluguel;-1200,00\n03/10/2026;Mercado;-300,00\n04/10/2026;Luz;-120,00\n");
  assert.deepEqual(tipos(r.rows), ["entrada", "gasto", "gasto", "gasto"]);
});

test("empate entre positivos e negativos: vale o padrão antigo (positivo é gasto)", async () => {
  const env = novoAmbiente();
  const r = await importar(env, "x.csv", "date,title,amount\n2026-10-05,Compra,40.00\n2026-10-06,Estorno,-40.00\n");
  assert.equal(r.expenseSign, 1);
  assert.deepEqual(tipos(r.rows), ["gasto", "entrada"]);
});

test("mudar o tipo de uma linha recalcula vencimento e situação; inverter todas não mexe no pagamento da fatura", async () => {
  const env = novoAmbiente();
  const r = await importar(env, "fatura.ofx", ofx([["20261005", "-50.00", "Mercado"], ["20261008", "15.00", "Estorno"], ["20261009", "300.00", "Pagamento recebido"]]));
  env.sandbox.__rows = r.rows;
  env.run('setImportRowType(__rows[1],"expense")');   // o estorno na verdade era gasto
  assert.equal(r.rows[1].isExpense, true);
  assert.equal(r.rows[1].paymentDate, "2026-10-19"); assert.equal(r.rows[1].paymentStatus, "planned");
  env.run('setImportRowType(__rows[0],"income")');    // e o "Mercado" vira entrada
  assert.equal(r.rows[0].isExpense, false); assert.equal(r.rows[0].paymentDate, "2026-10-05"); assert.equal(r.rows[0].paymentStatus, "paid");
  env.run('flipImportRows(__rows)');
  assert.deepEqual(tipos(r.rows), ["gasto", "entrada", "pagamento"], "todas invertidas, pagamento da fatura intacto");
  env.run('setImportRowType(__rows[0],"payment")');
  assert.equal(r.rows[0].isCardPayment, true); assert.equal(r.rows[0].isExpense, false);
});

test("importação antiga: entradas 'Crédito importado' que agora são gasto podem ser apagadas (com cópia de segurança)", async () => {
  const env = novoAmbiente({ confirma: true });
  const r = await importar(env, "fatura.ofx", ofx([["20261005", "-50.00", "Mercado"], ["20261006", "-30.00", "Uber"], ["20261008", "15.00", "Estorno"]]));
  env.sandbox.__rows = r.rows;
  env.run(`data.transactions = [
    {id:"w1",type:"income",source:"imported-credit",date:"2026-10-05",description:"Mercado",value:50,importKey:"ofx|outra"},
    {id:"w2",type:"income",source:"imported-credit",date:"2026-10-06",description:"uber",value:30,importKey:"ofx|2"},
    {id:"m1",type:"income",source:"normal",date:"2026-10-05",description:"Mercado",value:50},
    {id:"e1",type:"income",source:"imported-credit",date:"2026-10-08",description:"Estorno",value:15,importKey:"ofx|3"}
  ]`);
  await env.run("fixOldWrongImports(__rows)");
  assert.equal(env.sandbox.perguntas.length, 1);
  assert.match(env.sandbox.perguntas[0], /2 lançamento/);
  assert.deepEqual(Array.from(env.run("data.transactions.map(t=>t.id)")), ["m1", "e1"], "só as importadas por engano que agora são gasto saem; a entrada manual e o estorno ficam");
  const copia = JSON.parse(env.run('localStorage.getItem("meu-controle-importacao-removida")'));
  assert.deepEqual(copia.items.map(t => t.id), ["w1", "w2"]);
});

test("importação antiga: se o usuário recusar, nada é apagado", async () => {
  const env = novoAmbiente({ confirma: false });
  const r = await importar(env, "fatura.ofx", ofx([["20261005", "-50.00", "Mercado"], ["20261006", "-30.00", "Uber"]]));
  env.sandbox.__rows = r.rows;
  env.run('data.transactions = [{id:"w1",type:"income",source:"imported-credit",date:"2026-10-05",description:"Mercado",value:50,importKey:"ofx|1"}]');
  await env.run("fixOldWrongImports(__rows)");
  assert.deepEqual(Array.from(env.run("data.transactions.map(t=>t.id)")), ["w1"]);
  assert.equal(env.run('localStorage.getItem("meu-controle-importacao-removida")'), null);
});

test("sem entradas antigas por engano, não pergunta nada", async () => {
  const env = novoAmbiente();
  const r = await importar(env, "fatura.ofx", ofx([["20261005", "-50.00", "Mercado"]]));
  env.sandbox.__rows = r.rows;
  await env.run("fixOldWrongImports(__rows)");
  assert.equal(env.sandbox.perguntas.length, 0);
});

test("CSV com ponto e vírgula e valores brasileiros: centavos e milhares não se perdem", async () => {
  const env = novoAmbiente();
  const r = await importar(env, "extrato.csv", 'Data;Descrição;Valor\n05/10/2026;Compra grande;-1.234,56\n06/10/2026;"Loja; matriz, centro";-8,50\n07/10/2026;Pix recebido;2.000,00\n');
  assert.deepEqual(Array.from(r.rows, x => x.value), [1234.56, 8.5, 2000]);
  assert.equal(r.rows[1].description, "Loja; matriz, centro", "separador dentro de aspas não divide a célula");
  assert.deepEqual(tipos(r.rows), ["gasto", "gasto", "entrada"]);
});

test("detecção do separador do CSV", () => {
  const { run } = novoAmbiente();
  const d = t => { run("1"); return JSON.parse(run(`JSON.stringify(detectCsvDelimiter(${JSON.stringify(t)}))`)); };
  assert.equal(d("date,title,amount\n1,2,3"), ",");
  assert.equal(d("Data;Descrição;Valor\n1;2;3,50"), ";");
  assert.equal(d("Data\tDescrição\tValor\n1\t2\t3"), "\t");
  assert.equal(d('"Data","Descrição","Valor"\n'), ",");
});
