// ====================================================================
// calculos.test.js — testes automáticos das regras do app (sem navegador e sem instalar nada)
// Rodar:  node --test        (Node 18 ou mais novo)
// Os arquivos do app são carregados "de verdade" num ambiente isolado e as funções são testadas.
// ====================================================================
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Ambiente de teste: o mínimo que o navegador oferece e os arquivos do app precisam.
function novoAmbiente() {
  const store = new Map();
  const sandbox = {
    console, structuredClone, crypto: require("node:crypto").webcrypto, btoa, atob, TextEncoder,
    window: { addEventListener() {} },
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    askAlert() {}, renderAll() {}
  };
  const ctx = vm.createContext(sandbox);
  for (const f of ["utils.js", "config.js", "calculations.js", "storage.js", "recorrentes.js", "graficos.js", "exportar.js", "demo.js", "bloqueio.js", "integridade.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx, { filename: f });
  }
  return { run: code => vm.runInContext(code, ctx) };
}

// Dados pequenos e conhecidos para os testes: um cartão (fecha dia 10, vence dia 19) e lançamentos de outubro/2026.
const DADOS = `data = structuredClone(defaultData);
data.cards = [{id:"c1",name:"Cartão",limit:2000,closing:10,due:19}];
data.people = [{id:"self",name:"Você"},{id:"ana",name:"Ana"}];
data.transactions = [
 {id:"e1",type:"expense",date:"2026-10-05",description:"Mercado",value:100,method:"pix",paymentDate:"2026-10-05",paymentStatus:"paid",splits:[{id:"s1",category:"Casa",amount:100,ownerId:"self",reimbursed:false}]},
 {id:"e2",type:"expense",date:"2026-10-06",description:"Jantar",value:200,method:"pix",paymentDate:"2026-10-06",paymentStatus:"paid",splits:[{id:"s2",category:"Lazer",amount:120,ownerId:"self",reimbursed:false},{id:"s3",category:"Lazer",amount:80,ownerId:"ana",reimbursed:false}]},
 {id:"e3",type:"expense",date:"2026-09-20",description:"Roupa",value:300,method:"credit",cardId:"c1",paymentDate:"2026-10-19",paymentStatus:"planned",splits:[{id:"s4",category:"Compras",amount:300,ownerId:"self",reimbursed:false}]},
 {id:"i1",type:"income",date:"2026-10-05",description:"Salário",value:1000,source:"normal"}
];`;

test("datas: soma e subtrai meses, inclusive na virada do ano", () => {
  const { run } = novoAmbiente();
  assert.equal(run('shiftMonthStr("2026-01",-1)'), "2025-12");
  assert.equal(run('shiftMonthStr("2026-11",3)'), "2027-02");
  assert.equal(run('shiftMonthStr("2026-10",0)'), "2026-10");
});

test("datas: dia 31 em mês curto vira o último dia do mês", () => {
  const { run } = novoAmbiente();
  assert.equal(run('shiftMonthDate("2026-02",31,0)'), "2026-02-28");
  assert.equal(run('shiftMonthDate("2024-02",31,0)'), "2024-02-29");   // ano bissexto
  assert.equal(run('shiftMonthDate("2026-12",15,1)'), "2027-01-15");
});

test("divisão do gasto: parte sua e parte a receber", () => {
  const { run } = novoAmbiente(); run(DADOS);
  assert.equal(run('ownAmount(data.transactions[1])'), 120);
  assert.equal(run('receivableAmount(data.transactions[1])'), 80);
  assert.equal(run('ownAmount(data.transactions[3])'), 0);   // entrada não conta como gasto
});

test("crédito: vence no mês seguinte, no dia de vencimento do cartão", () => {
  const { run } = novoAmbiente(); run(DADOS);
  assert.equal(run('nextMonthPaymentDate("c1","2026-10-09")'), "2026-11-19");
  assert.equal(run('nextMonthPaymentDate("c1","2026-12-20")'), "2027-01-19");
});

test("o Resumo usa a data de PAGAMENTO, não a da compra", () => {
  const { run } = novoAmbiente(); run(DADOS);
  const ids = JSON.parse(run('JSON.stringify(scheduledPaymentsForMonth("2026-10").map(t=>t.id))'));
  assert.deepEqual(ids.sort(), ["e1", "e2", "e3"]);   // a Roupa foi comprada em setembro mas paga em outubro
  assert.deepEqual(JSON.parse(run('JSON.stringify(scheduledPaymentsForMonth("2026-09"))')), []);
});

test("série mensal: entradas, seu gasto e saldo", () => {
  const { run } = novoAmbiente(); run(DADOS);
  const s = JSON.parse(run('JSON.stringify(monthlySeries("2026-10",3))'));
  assert.equal(s.length, 3);
  assert.deepEqual(s.map(x => x.month), ["2026-08", "2026-09", "2026-10"]);
  const out = s[2];
  assert.equal(out.income, 1000);
  assert.equal(out.own, 100 + 120 + 300);
  assert.equal(out.gross, 100 + 200 + 300);
  assert.equal(out.balance, 1000 - 520);
});

test("categorias: total de todas as partes e total só seu", () => {
  const { run } = novoAmbiente(); run(DADOS);
  const tot = JSON.parse(run('JSON.stringify(categoryTotals("2026-10"))'));
  assert.deepEqual(tot[0], { category: "Compras", value: 300 });   // ordenado do maior para o menor
  assert.equal(tot.find(x => x.category === "Lazer").value, 200);
  const own = JSON.parse(run('JSON.stringify(ownByCategory("2026-10"))'));
  assert.equal(own.Lazer, 120);   // a parte da Ana não entra
});

test("orçamento: ok até 79%, atenção a partir de 80%, estourado a partir de 100%", () => {
  const { run } = novoAmbiente(); run(DADOS);
  const nivel = limite => { run(`data.budgets = {Lazer:${limite}}`); return JSON.parse(run('JSON.stringify(budgetStatus("2026-10"))'))[0]; };
  assert.equal(nivel(200).level, "ok");     // 120 de 200 = 60%
  assert.equal(nivel(150).level, "warn");   // 120 de 150 = 80%
  assert.equal(nivel(120).level, "over");   // 120 de 120 = 100%
  assert.equal(nivel(100).level, "over");
  assert.equal(Math.round(nivel(200).pct), 60);
  run("data.budgets = {Lazer:0}");
  assert.deepEqual(JSON.parse(run('JSON.stringify(budgetStatus("2026-10"))')), []);   // limite 0 = sem orçamento
});

test("eixo dos gráficos: arredondamento e texto curto", () => {
  const { run } = novoAmbiente();
  assert.equal(run("niceMax(0)"), 1);
  assert.equal(run("niceMax(83)"), 100);
  assert.equal(run("niceMax(4600)"), 6000);
  assert.equal(run("niceMax(1200)"), 1500);
  assert.deepEqual(JSON.parse(run("JSON.stringify(niceScale(4500))")), { step: 2000, ticks: 3, top: 6000 });
  assert.equal(run("fmtCompact(850)"), "R$ 850");
  assert.equal(run("fmtCompact(1234)"), "R$ 1,2 mil");
  assert.equal(run("fmtCompact(15000)"), "R$ 15 mil");
  assert.equal(run("fmtCompact(2000)"), "R$ 2 mil");
  assert.equal(run("fmtCompact(-400)"), "-R$ 400");
});

// ----- Recorrentes -----
const MODELOS = `data = structuredClone(defaultData);
data.cards = [{id:"c1",name:"Cartão",limit:2000,closing:10,due:19}];
data.transactions = [];
data.recurring = [
 {id:"r1",type:"expense",description:"Aluguel",value:1200,day:8,startMonth:"2026-09",endMonth:"",method:"pix",cardId:"",category:"Casa",active:true,generated:[]},
 {id:"r2",type:"income",description:"Salário",value:4500,day:5,startMonth:"2026-10",endMonth:"",method:"",cardId:"",category:"",active:true,generated:[]},
 {id:"r3",type:"expense",description:"Netflix",value:39.9,day:15,startMonth:"2026-10",endMonth:"2026-10",method:"credit",cardId:"c1",category:"Lazer",active:true,generated:[]},
 {id:"r4",type:"expense",description:"Pausado",value:10,day:1,startMonth:"2026-10",endMonth:"",method:"pix",cardId:"",category:"Outros",active:false,generated:[]}
];`;

test("recorrentes: gera do mês inicial até o mês seguinte ao atual", () => {
  const { run } = novoAmbiente(); run(MODELOS);
  const n = run('generateRecurring("2026-10-09")');
  // Aluguel: set, out, nov (3) + Salário: out, nov (2) + Netflix: só out (1, tem mês final) + Pausado: 0
  assert.equal(n, 6);
  const meses = JSON.parse(run('JSON.stringify(data.transactions.filter(t=>t.recurringId==="r1").map(t=>t.date).sort())'));
  assert.deepEqual(meses, ["2026-09-08", "2026-10-08", "2026-11-08"]);
});

test("recorrentes: rodar de novo não duplica nada", () => {
  const { run } = novoAmbiente(); run(MODELOS);
  run('generateRecurring("2026-10-09")');
  assert.equal(run('generateRecurring("2026-10-09")'), 0);
  assert.equal(run("data.transactions.length"), 6);
});

test("recorrentes: lançamento excluído não volta; mês novo gera só o que falta", () => {
  const { run } = novoAmbiente(); run(MODELOS);
  run('generateRecurring("2026-10-09")');
  run('data.transactions = data.transactions.filter(t=>!(t.recurringId==="r1" && t.date==="2026-10-08"))');   // exclui o aluguel de outubro
  assert.equal(run('generateRecurring("2026-10-20")'), 0);   // não recria
  assert.equal(run('generateRecurring("2026-11-02")'), 2);   // chegou novembro: faltam só os de dezembro (aluguel e salário); o Netflix tem mês final
});

test("recorrentes: pausado não gera; ao retomar, gera", () => {
  const { run } = novoAmbiente(); run(MODELOS);
  run('generateRecurring("2026-10-09")');
  assert.equal(run('data.transactions.filter(t=>t.recurringId==="r4").length'), 0);
  run('data.recurring.find(r=>r.id==="r4").active = true');
  assert.equal(run('generateRecurring("2026-10-09")'), 2);   // out e nov
});

test("recorrentes: crédito vence no mês seguinte e fica previsto; Pix futuro fica previsto; entrada vira income", () => {
  const { run } = novoAmbiente(); run(MODELOS);
  run('generateRecurring("2026-10-09")');
  const net = JSON.parse(run('JSON.stringify(data.transactions.find(t=>t.recurringId==="r3"))'));
  assert.equal(net.date, "2026-10-15");
  assert.equal(net.paymentDate, "2026-11-19");
  assert.equal(net.paymentStatus, "planned");
  assert.equal(net.cardId, "c1");
  assert.equal(net.splits[0].ownerId, "self");
  const alugOut = JSON.parse(run('JSON.stringify(data.transactions.find(t=>t.recurringId==="r1" && t.date==="2026-10-08"))'));
  assert.equal(alugOut.paymentStatus, "paid");      // dia 8 já passou em 09/10
  const alugNov = JSON.parse(run('JSON.stringify(data.transactions.find(t=>t.recurringId==="r1" && t.date==="2026-11-08"))'));
  assert.equal(alugNov.paymentStatus, "planned");   // ainda no futuro
  const sal = JSON.parse(run('JSON.stringify(data.transactions.find(t=>t.recurringId==="r2" && t.date==="2026-10-05"))'));
  assert.equal(sal.type, "income");
  assert.equal(sal.value, 4500);
});

// ----- CSV -----
test("CSV: separador ;, vírgula decimal, aspas protegidas e tipos de lançamento", () => {
  const { run } = novoAmbiente(); run(DADOS);
  run('data.transactions.push({id:"x",type:"expense",date:"2026-10-07",description:"Pizza; \\"grande\\"",value:50.5,method:"pix",paymentDate:"2026-10-07",paymentStatus:"paid",splits:[{id:"s9",category:"Lazer",amount:50.5,ownerId:"self",reimbursed:false}]})');
  run('data.transactions.push({id:"y",type:"income",date:"2026-10-08",description:"Devolução",value:80,source:"reimbursement"})');
  const csv = run("buildCsv(data.transactions)");
  const linhas = csv.split("\r\n");
  assert.equal(linhas[0].split(";").length, 13);
  assert.ok(csv.includes('"Pizza; ""grande"""'));
  assert.ok(csv.includes(";50,50;50,50;0,00;"));
  assert.ok(linhas.some(l => l.includes("Reembolso") && l.includes("80,00")));
  assert.ok(linhas.some(l => l.includes("Jantar") && l.includes("200,00;120,00;80,00")));   // total; seu valor; a receber
  assert.ok(linhas.some(l => l.includes("Roupa") && l.includes("Cartão") && l.includes("Previsto")));
});

// ----- Modo demonstração -----
test("demonstração: dados coerentes e os dados reais não são tocados", () => {
  const { run } = novoAmbiente(); run(DADOS);
  const antes = run("JSON.stringify(data)");
  const demo = JSON.parse(run("JSON.stringify(buildDemoData('2026-10-09'))"));
  assert.equal(run("JSON.stringify(data)"), antes);   // montar a demonstração não altera os dados reais
  assert.equal(demo.demoMode, true);
  assert.ok(demo.transactions.length > 60);
  assert.equal(demo.recurring.length, 3);
  for (const t of demo.transactions.filter(t => t.type === "expense")) {
    const soma = t.splits.reduce((s, x) => s + x.amount, 0);
    assert.ok(Math.abs(soma - t.value) < 0.005, `a soma das partes de "${t.description}" deve ser o valor total`);
    assert.ok(t.paymentDate, "todo gasto tem data de pagamento");
  }
  assert.ok(demo.transactions.some(t => t.recurringId));
});

test("demonstração: entrar e sair devolve exatamente os dados reais", () => {
  const { run } = novoAmbiente(); run(DADOS);
  run('localStorage.setItem(DB_KEY, JSON.stringify(data))');
  const reais = JSON.parse(run("JSON.stringify(data)"));
  // Simula o que startDemo / exitDemo fazem (sem a janela de confirmação):
  run("localStorage.setItem(DEMO_STASH_KEY, JSON.stringify(data)); data = buildDemoData(); localStorage.setItem(DB_KEY, JSON.stringify(data));");
  assert.equal(run("isDemoMode()"), true);
  run("localStorage.setItem(DB_KEY, localStorage.getItem(DEMO_STASH_KEY)); localStorage.removeItem(DEMO_STASH_KEY); data = loadData();");
  assert.equal(run("isDemoMode()"), false);
  assert.equal(run("data.transactions.length"), reais.transactions.length);
  assert.equal(run("data.transactions[1].description"), "Jantar");
});

test("carregar dados antigos (sem orçamento/recorrentes) completa os campos novos", () => {
  const { run } = novoAmbiente();
  run('localStorage.setItem(DB_KEY, JSON.stringify({transactions:[],cards:[],categories:["Casa"],people:[{id:"self",name:"Você"}],rules:[]}))');
  run("data = loadData()");
  assert.deepEqual(JSON.parse(run("JSON.stringify(data.budgets)")), {});
  assert.deepEqual(JSON.parse(run("JSON.stringify(data.recurring)")), []);
});

// ----- Bloqueio por PIN -----
test("PIN: o mesmo PIN e sal dão o mesmo resumo; PIN errado não confere", async () => {
  const { run } = novoAmbiente();
  assert.equal(run("lockEnabled()"), false);
  await run('setPin("4821", 60)');
  assert.equal(run("lockEnabled()"), true);
  assert.equal(await run('checkPin("4821")'), true);
  assert.equal(await run('checkPin("4822")'), false);
  assert.equal(await run('checkPin("")'), false);
});

test("PIN: o PIN em si nunca fica guardado, e cada ativação usa um sal novo", async () => {
  const { run } = novoAmbiente();
  await run('setPin("123456", 0)');
  const guardado = run("localStorage.getItem(LOCK_KEY)");
  assert.ok(!guardado.includes("123456"));
  const sal1 = JSON.parse(guardado).salt;
  await run('setPin("123456", 0)');
  assert.notEqual(JSON.parse(run("localStorage.getItem(LOCK_KEY)")).salt, sal1);
  assert.equal(JSON.parse(run("localStorage.getItem(LOCK_KEY)")).autoSec, 0);
});

test("PIN: aceita só 4 a 8 números", () => {
  const { run } = novoAmbiente();
  for (const ok of ["1234", "12345678"]) assert.equal(run(`lockPinValid("${ok}")`), true);
  for (const ruim of ["123", "123456789", "12a4", "", "12 34"]) assert.equal(run(`lockPinValid("${ruim}")`), false);
});

// ----- Verificar dados -----
test("verificar dados: acha problemas e corrige só o que é seguro", () => {
  const { run } = novoAmbiente(); run(DADOS);
  assert.deepEqual(JSON.parse(run("JSON.stringify(checkDataIntegrity())")), []);   // dados bons: nenhum problema
  run(`data.transactions.push({id:"b1",type:"expense",date:"2026-10-10",description:"Quebrado",value:10.004,method:"pix",paymentDate:"2026-10-10",paymentStatus:"paid",splits:[{id:"q1",category:"Fantasma",amount:10.004,ownerId:"self",reimbursed:false}]});
        data.transactions.push({id:"b2",type:"expense",date:"2026-10-11",description:"Soma errada",value:50,method:"pix",paymentDate:"2026-10-11",paymentStatus:"paid",splits:[{id:"q2",category:"Casa",amount:20,ownerId:"self",reimbursed:false},{id:"q3",category:"Casa",amount:20,ownerId:"sumiu",reimbursed:false}]});
        data.budgets = {Lazer:100, Antiga:50};`);
  const textos = JSON.parse(run("JSON.stringify(checkDataIntegrity())")).map(i => i.level + ":" + i.text);
  assert.ok(textos.some(t => t.startsWith("fix:") && t.includes("Quebrado") && t.includes("2 casas")));
  assert.ok(textos.some(t => t.startsWith("fix:") && t.includes('"Fantasma"')));
  assert.ok(textos.some(t => t.startsWith("fix:") && t.includes('"Antiga"')));
  assert.ok(textos.some(t => t.startsWith("warn:") && t.includes("Soma errada") && t.includes("soma das partes")));
  assert.ok(textos.some(t => t.startsWith("warn:") && t.includes("pessoa")));
  const n = run("fixDataIntegrity()");
  assert.ok(n >= 4);   // valor + parte arredondados, categoria recolocada, limite removido
  assert.equal(run('data.transactions.find(t=>t.id==="b1").value'), 10);
  assert.ok(run('data.categories.includes("Fantasma")'));
  assert.equal(run('"Antiga" in data.budgets'), false);
  const depois = JSON.parse(run("JSON.stringify(checkDataIntegrity())"));
  assert.ok(depois.every(i => i.level === "warn"));   // sobrou só o que precisa de decisão humana
});

test("ao carregar, limpa sujeira de ponto flutuante sem mexer em centavos reais", () => {
  const { run } = novoAmbiente();
  assert.equal(run("cleanFloat(0.1+0.2)"), 0.3);
  assert.equal(run("cleanFloat(10.004)"), 10.004);   // 3 casas de verdade: não mexe (a verificação de dados avisa)
  const t = run('normalizeTransaction({type:"expense",date:"2026-10-01",value:0.1+0.2,splits:[{id:"s",category:"Casa",amount:0.1+0.2,ownerId:"self"}]})');
  assert.equal(t.value, 0.3);
  assert.equal(t.splits[0].amount, 0.3);
});
