// ====================================================================
// excel.test.js — testes da planilha Excel do backup: zip, .xlsx, aba "Dados do app", restauração e formato da Planilha do mês
// Rodar:  node --test        (não precisa instalar nada)
// ====================================================================
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
// Junta os scripts do app na mesma ordem em que o index.html os carrega.
const appSource = [...fs.readFileSync(path.join(__dirname, "index.html"), "utf8").matchAll(/<script\s+src="([^"]+)"/g)]
  .map(m => fs.readFileSync(path.join(__dirname, m[1]), "utf8")).join("\n");

function carregarArquivos(ctx, arquivos) {
  for (const arquivo of arquivos) {
    const marcador = `/* ===== ${arquivo} ===== */`;
    const inicio = appSource.indexOf(marcador);
    assert.notEqual(inicio, -1, `seção ${arquivo} não encontrada nos scripts do index.html`);
    const codigoInicio = inicio + marcador.length;
    const proximaSecao = appSource.indexOf("\n/* ===== ", codigoInicio);
    vm.runInContext(appSource.slice(codigoInicio, proximaSecao === -1 ? undefined : proximaSecao), ctx, { filename: arquivo });
  }
}

function novoAmbiente() {
  const store = new Map();
  const sandbox = {
    console, structuredClone, Buffer, TextDecoder, TextEncoder, btoa, atob, Blob, Response, DecompressionStream, File,
    crypto: require("node:crypto").webcrypto,
    window: { addEventListener() {} }, document: { getElementById: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
    askAlert() {}, renderAll() {}, askConfirm: () => Promise.resolve(true)
  };
  const ctx = vm.createContext(sandbox);
  carregarArquivos(ctx, ["utils.js", "config.js", "calculations.js", "storage.js", "zip.js", "xlsx.js", "excel.js"]);
  vm.runInContext('var shortDate=d=>d.slice(8,10)+"/"+d.slice(5,7);', ctx);   // vem da tela (dashboard.js); aqui só precisamos dela
  return { sandbox, run: code => vm.runInContext(code, ctx) };
}
const DADOS = `data = structuredClone(defaultData);
data.cards = [{id:"c1",name:"Cartão",limit:1000,closing:10,due:19}];
data.people = [{id:"self",name:"Você"},{id:"p1",name:"Gui"}];
data.transactions = [
  {id:"e1",type:"expense",date:"2026-10-05",description:"Mercado & cia <ok>",value:100,method:"pix",cardId:"",paymentDate:"2026-10-05",paymentStatus:"paid",installments:1,installmentNo:1,splits:[{id:"s1",category:"Casa",amount:60,ownerId:"self"},{id:"s2",category:"Casa",amount:40,ownerId:"p1"}]},
  {id:"e2",type:"expense",date:"2026-10-02",description:"Celular",value:50,method:"credit",cardId:"c1",paymentDate:"2026-11-19",paymentStatus:"planned",installments:6,installmentNo:2,splits:[{id:"s3",category:"Compras",amount:50,ownerId:"self"}]},
  {id:"i1",type:"income",date:"2026-10-06",description:"Salário",value:1790,source:"normal"}
];`;
const bytes = u8 => Uint8Array.from(u8);

test("crc32 bate com o valor conhecido (123456789 = CBF43926)", () => {
  const { run } = novoAmbiente();
  assert.equal(run('crc32(new TextEncoder().encode("123456789"))'), 0xCBF43926);
});

test("zip: o que entra sai igual (nomes e textos com acento)", async () => {
  const { sandbox, run } = novoAmbiente();
  sandbox.__z = bytes(run('createZip([{name:"a.txt",data:"olá, ç ã é"},{name:"pasta/b.xml",data:"<x/>"}])'));
  const files = await run("readZip(__z)");
  assert.deepEqual(Object.keys(files), ["a.txt", "pasta/b.xml"]);
  assert.equal(new TextDecoder().decode(files["a.txt"]), "olá, ç ã é");
});

test("xlsx: textos com caracteres especiais e números voltam iguais; aba escondida é lida pelo nome", async () => {
  const { sandbox, run } = novoAmbiente();
  sandbox.__x = bytes(run('buildXlsx([{name:"Visível",rows:[[{v:"x"}]]},{name:"Dados do app",hidden:true,rows:[[{v:"A & B <c> \\"d\\" ç 😀"}],[{v:12.5}],[{v:" com espaços "}]]}])'));
  const cells = await run('readXlsxSheet(__x,"Dados do app")');
  assert.equal(cells.A1, 'A & B <c> "d" ç 😀'); assert.equal(cells.A2, "12.5"); assert.equal(cells.A3, " com espaços ");
  assert.equal(await run('readXlsxSheet(__x,"Não existe")'), null);
});

test("backup em Excel: restaura exatamente os mesmos dados, mesmo grandes (vários pedaços na aba escondida)", async () => {
  const { sandbox, run } = novoAmbiente();
  run(DADOS);
  run('for(let i=0;i<400;i++) data.transactions.push({id:"x"+i,type:"expense",date:"2026-10-10",description:"Compra número "+i+" com bastante texto para ocupar espaço",value:10,method:"pix",cardId:"",paymentDate:"2026-10-10",paymentStatus:"paid",installments:1,installmentNo:1,splits:[{id:"sx"+i,category:"Casa",amount:10,ownerId:"self"}]})');
  const original = run("JSON.stringify(data)");
  assert.ok(original.length > 60000, "o teste precisa de dados maiores que um pedaço (30 mil caracteres)");
  sandbox.__x = bytes(run("buildBackupXlsx()"));
  const volta = await run("backupFromBytes(__x)");
  assert.equal(JSON.stringify(volta), original);
});

test("Planilha do mês no Excel: mesmo formato da tela (categorias mescladas, totais e saldo)", () => {
  const { run } = novoAmbiente(); run(DADOS);
  assert.deepEqual(JSON.parse(run("JSON.stringify(sheetMonths())")), ["2026-10", "2026-11"]);
  const s = JSON.parse(run('JSON.stringify(monthSheetForExcel("2026-10"))'));
  assert.equal(s.name, "Out 2026");
  const texto = s.rows.map(r => r.map(c => c && c.v));
  assert.deepEqual(texto[0], ["Categoria", "Despesas e descrição", "Pagamento previsto", "Valor previsto (R$)", "Soma por categoria"]);
  assert.deepEqual(texto[1], ["Casa", "Mercado & cia <ok>", "05/10 ✓", 60, 100]);                // a parte do Gui entra pelo valor cheio e vem com o nome
  assert.deepEqual(texto[2], [undefined, "Mercado & cia <ok> (Gui)", "05/10 ✓", 40, undefined]);   // células mescladas ficam vazias
  assert.deepEqual([texto[3][0], texto[3][3]], ["Total gasto no mês", 100]);
  assert.deepEqual([texto[4][0], texto[4][1], texto[4][3]], ["Entradas do salário e outras", "Salário", 1790]);
  assert.deepEqual(texto.slice(-2).map(r => [r[0], r[3]]), [["Soma das entradas", 1790], ["Saldo do mês", 1690]]);
  assert.ok(s.merges.includes("A2:A3") && s.merges.includes("E2:E3"), "a categoria e a soma por categoria ficam mescladas");
});

test("planilha salva pelo Excel (textos compartilhados, compactada, caminhos absolutos) também é lida", async () => {
  const { sandbox, run } = novoAmbiente();
  const backup = '{"transactions":[],"cards":[],"people":[{"id":"self","name":"Você"}]}';
  const zip = nomes => { // zip com compactação "deflate", como o Excel grava
    const partes = [], central = []; let off = 0; const u16 = n => [n & 255, n >> 8 & 255], u32 = n => [n & 255, n >> 8 & 255, n >> 16 & 255, n >>> 24 & 255];
    for (const [nome, texto] of nomes) {
      const nm = Buffer.from(nome), raw = Buffer.from(texto), comp = zlib.deflateRawSync(raw), crc = zlib.crc32 ? zlib.crc32(raw) : 0;
      const c = [...u16(20), ...u16(0), ...u16(8), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(comp.length), ...u32(raw.length), ...u16(nm.length), ...u16(0)];
      partes.push(Buffer.from([0x50, 0x4b, 3, 4, ...c]), nm, comp);
      central.push(Buffer.from([0x50, 0x4b, 1, 2, ...u16(20), ...c, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nm);
      off += 30 + nm.length + comp.length;
    }
    const cd = Buffer.concat(central);
    return Uint8Array.from(Buffer.concat([...partes, cd, Buffer.from([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(nomes.length), ...u16(nomes.length), ...u32(cd.length), ...u32(off), 0, 0])]));
  };
  sandbox.__x = zip([
    ["xl/workbook.xml", '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Out 2026" sheetId="1" r:id="rId1"/><sheet name="Dados do app" sheetId="2" state="hidden" r:id="rId2"/></sheets></workbook>'],
    ["xl/_rels/workbook.xml.rels", '<Relationships><Relationship Id="rId2" Type="x" Target="/xl/worksheets/sheet2.xml"/><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>'],
    ["xl/sharedStrings.xml", `<sst><si><t>aviso</t></si><si><t>meu-controle-backup-v1</t></si><si><r><t>${backup.slice(0, 20).replace(/"/g, "&quot;")}</t></r><r><t>${backup.slice(20).replace(/"/g, "&quot;")}</t></r></si></sst>`],
    ["xl/worksheets/sheet2.xml", '<worksheet><sheetData><row r="1"><c r="A1" s="1" t="s"><v>0</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c></row><row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3"/></row></sheetData></worksheet>'],
    ["xl/worksheets/sheet1.xml", "<worksheet><sheetData/></worksheet>"]
  ]);
  const volta = await run("backupFromBytes(__x)");
  assert.equal(JSON.stringify(volta), backup);
});

test("arquivos que não são backup dão um aviso claro", async () => {
  const { sandbox, run } = novoAmbiente();
  sandbox.__t = Uint8Array.from(Buffer.from("isso não é backup"));
  await assert.rejects(() => run("backupFromBytes(__t)"), /não é um backup/);
  sandbox.__v = bytes(run('buildXlsx([{name:"Outra",rows:[[{v:"oi"}]]}])'));
  await assert.rejects(() => run("backupFromBytes(__v)"), /Dados do app/);
  sandbox.__j = Uint8Array.from(Buffer.from('\uFEFF{"transactions":[],"cards":[],"people":[]}'));
  assert.deepEqual(JSON.parse(JSON.stringify(await run("backupFromBytes(__j)"))), { transactions: [], cards: [], people: [] });   // .json com BOM também abre
});
