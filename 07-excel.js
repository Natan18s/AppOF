/* ===== zip.js ===== */
// ====================================================================
// zip.js — cria e lê arquivos .zip (um .xlsx é um .zip com arquivos XML dentro)
// Sem biblioteca e sem internet. Para criar, guarda os arquivos sem compactar. Para ler, aceita também os compactados
// (o Excel compacta) usando o DecompressionStream do navegador.
// ====================================================================

const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(bytes){let c=0xFFFFFFFF;for(let i=0;i<bytes.length;i++)c=CRC_TABLE[(c^bytes[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}

// Cria um .zip. files = [{name:"pasta/arquivo.xml", data:"texto"}]. Devolve Uint8Array.
function createZip(files){
  const enc=new TextEncoder(), chunks=[], central=[]; let offset=0;
  const u16=n=>[n&255,(n>>8)&255], u32=n=>[n&255,(n>>8)&255,(n>>16)&255,(n>>>24)&255];
  files.forEach(f=>{
    const name=enc.encode(f.name), body=typeof f.data==="string"?enc.encode(f.data):f.data, crc=crc32(body);
    const common=[...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(body.length),...u32(body.length),...u16(name.length),...u16(0)];   // versão, nomes em UTF-8, sem compactar, data fixa
    chunks.push(Uint8Array.from([0x50,0x4b,3,4,...common]),name,body);
    central.push(Uint8Array.from([0x50,0x4b,1,2,...u16(20),...common,...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)]),name);
    offset+=30+name.length+body.length;
  });
  const cdSize=central.reduce((n,c)=>n+c.length,0);
  const end=Uint8Array.from([0x50,0x4b,5,6,...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(cdSize),...u32(offset),...u16(0)]);
  const all=[...chunks,...central,end], out=new Uint8Array(all.reduce((n,c)=>n+c.length,0));
  let p=0; all.forEach(c=>{out.set(c,p);p+=c.length});
  return out;
}

// Descompacta dados "deflate" (formato do Excel).
async function inflateRaw(bytes){
  if(typeof DecompressionStream==="undefined") throw new Error("Este navegador não consegue abrir planilhas compactadas. Use o backup .json ou atualize o navegador.");
  const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Lê um .zip. Devolve {nome: Uint8Array} com todos os arquivos de dentro.
async function readZip(buf){
  const b=ArrayBuffer.isView(buf)?new Uint8Array(buf.buffer,buf.byteOffset,buf.byteLength):new Uint8Array(buf);
  const dv=new DataView(b.buffer,b.byteOffset,b.byteLength), dec=new TextDecoder("utf-8");
  let e=-1; for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){ if(dv.getUint32(i,true)===0x06054b50){e=i;break} }
  if(e<0) throw new Error("Esse arquivo não é uma planilha .xlsx válida.");
  const count=dv.getUint16(e+10,true); let p=dv.getUint32(e+16,true); const files={};
  for(let n=0;n<count;n++){
    if(dv.getUint32(p,true)!==0x02014b50) throw new Error("Planilha .xlsx corrompida.");
    const method=dv.getUint16(p+10,true), csize=dv.getUint32(p+20,true), nlen=dv.getUint16(p+28,true), elen=dv.getUint16(p+30,true), clen=dv.getUint16(p+32,true), lho=dv.getUint32(p+42,true);
    const name=dec.decode(b.subarray(p+46,p+46+nlen));
    const start=lho+30+dv.getUint16(lho+26,true)+dv.getUint16(lho+28,true), raw=b.subarray(start,start+csize);
    files[name]=method===0?raw:method===8?await inflateRaw(raw):(()=>{throw new Error("Planilha .xlsx com formato de compactação não suportado.")})();
    p+=46+nlen+elen+clen;
  }
  return files;
}

;
/* ===== xlsx.js ===== */
// ====================================================================
// xlsx.js — cria e lê planilhas .xlsx (Excel / Planilhas Google)
// Criar: recebe abas prontas (células com texto/número e estilo). Ler: devolve o texto das células de uma aba pelo nome.
// ====================================================================

const xmlEsc=s=>String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const xmlUnesc=s=>s.replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(Number(d))).replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,"&");
const xlsxCol=i=>{let s="";for(i++;i>0;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s};   // 0 -> A, 26 -> AA

// Estilos das células: [fonte, fundo, borda, formato, alinhamento]. O número do estilo é a posição nesta lista.
const XLSX_FONTS=['<font><sz val="11"/><name val="Calibri"/></font>','<font><b/><sz val="11"/><name val="Calibri"/></font>','<font><b/><sz val="11"/><color rgb="FFC00000"/><name val="Calibri"/></font>','<font><b/><sz val="11"/><color rgb="FF1E7B34"/><name val="Calibri"/></font>','<font><b/><sz val="11"/><color rgb="FF8A4B00"/><name val="Calibri"/></font>'];
const XLSX_FILLS=["FFE5E5EA","FFFFFFFF","FFF2F2F7","FFF0FAF3","FFE0F3E6","FFFFE5E3","FFDFF5E5","FFFFE9CC"];   // cores de fundo; em XLSX_STYLES valem os números 2 a 9 (0 e 1 são reservados do Excel)
const XLSX_STYLES=[
  [0,0,0,0,""],                                                   // 0 normal
  [1,2,1,0,"center"],                                             // 1 cabeçalho
  [0,3,1,0,"wrap"],[0,3,1,164,"right"],[1,3,1,0,"mid"],           // 2-4 despesas, categoria clara
  [0,4,1,0,"wrap"],[0,4,1,164,"right"],[1,4,1,0,"mid"],           // 5-7 despesas, categoria escura
  [0,5,1,0,"wrap"],[0,5,1,164,"right"],[1,5,1,0,"mid"],           // 8-10 entradas, grupo claro
  [0,6,1,0,"wrap"],[0,6,1,164,"right"],[1,6,1,0,"mid"],           // 11-13 entradas, grupo escuro
  [2,7,1,0,"mid"],[2,7,1,164,"right"],                            // 14-15 total gasto
  [3,8,1,0,"mid"],[3,8,1,164,"right"],                            // 16-17 soma das entradas
  [4,9,1,0,"mid"],[4,9,1,164,"right"],                            // 18-19 saldo
  [0,0,0,0,"wrap"]                                                // 20 texto corrido
];
const XLSX_ALIGN={center:'<alignment horizontal="center" vertical="center" wrapText="1"/>',wrap:'<alignment vertical="top" wrapText="1"/>',mid:'<alignment vertical="center" wrapText="1"/>',right:'<alignment horizontal="right" vertical="top"/>'};

function xlsxStylesXml(){
  const fills=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>',...XLSX_FILLS.map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="${c}"/><bgColor indexed="64"/></patternFill></fill>`)];
  const line='<left style="thin"><color rgb="FFD1D1D6"/></left><right style="thin"><color rgb="FFD1D1D6"/></right><top style="thin"><color rgb="FFD1D1D6"/></top><bottom style="thin"><color rgb="FFD1D1D6"/></bottom><diagonal/>';
  const xfs=XLSX_STYLES.map(([f,fl,b,n,al])=>`<xf numFmtId="${n}" fontId="${f}" fillId="${fl}" borderId="${b}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"${al?' applyAlignment="1">'+XLSX_ALIGN[al]+"</xf>":"/>"}`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$&quot;\\ #,##0.00;[Red]\\-&quot;R$&quot;\\ #,##0.00"/></numFmts><fonts count="${XLSX_FONTS.length}">${XLSX_FONTS.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border>${line}</border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${XLSX_STYLES.length}">${xfs}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

// Cria o .xlsx. sheets = [{name, rows:[[{v,s}|null,...]], cols:[larguras], merges:["A2:A4"], hidden:false, freeze:true}]. Devolve Uint8Array.
function buildXlsx(sheets){
  const NS='xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', R='xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"', HEAD='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const sheetXml=sh=>{
    const rows=sh.rows.map((cells,r)=>`<row r="${r+1}">${cells.map((c,i)=>{
      if(!c)return "";
      const ref=xlsxCol(i)+(r+1), st=` s="${c.s||0}"`;
      if(c.v===undefined||c.v==="")return `<c r="${ref}"${st}/>`;
      return typeof c.v==="number"?`<c r="${ref}"${st}><v>${c.v}</v></c>`:`<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(c.v)}</t></is></c>`;
    }).join("")}</row>`).join("");
    const view=sh.freeze?'<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>':'<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
    const cols=sh.cols?`<cols>${sh.cols.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("")}</cols>`:"";
    const merges=sh.merges&&sh.merges.length?`<mergeCells count="${sh.merges.length}">${sh.merges.map(m=>`<mergeCell ref="${m}"/>`).join("")}</mergeCells>`:"";
    const fit=sh.fit?'<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>':"";   // para imprimir: cabe na largura da folha
    return `${HEAD}<worksheet ${NS}>${sh.fit?'<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>':""}${view}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows}</sheetData>${merges}${fit}</worksheet>`;
  };
  const files=[
    {name:"[Content_Types].xml",data:`${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`},
    {name:"_rels/.rels",data:`${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {name:"xl/workbook.xml",data:`${HEAD}<workbook ${NS} ${R}><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((s,i)=>`<sheet name="${xmlEsc(s.name)}" sheetId="${i+1}"${s.hidden?' state="hidden"':""} r:id="rId${i+1}"/>`).join("")}</sheets></workbook>`},
    {name:"xl/_rels/workbook.xml.rels",data:`${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name:"xl/styles.xml",data:xlsxStylesXml()},
    ...sheets.map((s,i)=>({name:`xl/worksheets/sheet${i+1}.xml`,data:sheetXml(s)}))
  ];
  return createZip(files);
}

// Lê uma aba de um .xlsx pelo nome. Devolve {A1:"texto", B2:"12.5", ...} (aceita planilhas salvas pelo Excel, com textos compartilhados).
async function readXlsxSheet(bytes,sheetName){
  const files=await readZip(bytes), dec=new TextDecoder("utf-8"), txt=n=>files[n]?dec.decode(files[n]):"";
  const wb=txt("xl/workbook.xml");
  if(!wb) throw new Error("Esse arquivo não parece ser uma planilha do Excel (.xlsx).");
  const attr=(tag,name)=>{const m=new RegExp("(?:^|\\s)"+name+'="([^"]*)"').exec(tag);return m?xmlUnesc(m[1]):null};
  let rid=null; for(const m of wb.matchAll(/<sheet\b[^>]*>/g)){ if(attr(m[0],"name")===sheetName) rid=attr(m[0],"r:id"); }
  if(!rid) return null;
  let target=null; for(const m of txt("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)){ if(attr(m[0],"Id")===rid) target=attr(m[0],"Target"); }
  if(!target) return null;
  const path=target.startsWith("/")?target.slice(1):"xl/"+target;
  const piece=s=>[...s.replace(/<rPh\b[\s\S]*?<\/rPh>/g,"").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m=>xmlUnesc(m[1])).join("");
  const shared=[...txt("xl/sharedStrings.xml").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m=>piece(m[1]));
  const cells={};
  for(const m of txt(path).matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
    const ref=attr(m[1],"r"), type=attr(m[1],"t"), body=m[2]||"";
    if(!ref||!body) continue;
    const v=/<v>([\s\S]*?)<\/v>/.exec(body);
    cells[ref]=type==="s"?(shared[Number(v?.[1])]??""):type==="inlineStr"?piece(body):(v?xmlUnesc(v[1]):"");
  }
  return cells;
}

;
/* ===== excel.js ===== */
// ====================================================================
// excel.js — planilha Excel do backup
// Gera um .xlsx com uma aba por mês, no mesmo formato da "Planilha do mês" do Resumo, mais uma aba escondida "Dados do app"
// com todos os dados do app (é dela que o app restaura). Também lê esse .xlsx de volta (Importar > Restaurar).
// ====================================================================

const XLSX_MIME="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLSX_DATA_SHEET="Dados do app", XLSX_MARK="meu-controle-backup-v1";
const MESES_ABREV=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// Dados da "Planilha do mês" de m (AAAA-MM), usados na tela e no arquivo Excel: despesas por categoria, entradas em grupos, totais e saldo.
// Cada divisão do gasto entra na sua categoria, pelo valor cheio. Devolve null se o mês não tem lançamentos.
function sheetModel(m){
  const sched=scheduledPaymentsForMonth(m);
  const incomes=txForMonth(m).filter(t=>t.type==="income");
  if(!sched.length&&!incomes.length) return null;
  const byCat={};
  sched.forEach(t=>(t.splits||[]).forEach(s=>{ (byCat[s.category]=byCat[s.category]||[]).push({t,s}); }));
  const cats=[...data.categories.filter(c=>byCat[c]),...Object.keys(byCat).filter(c=>!data.categories.includes(c))];   // segue a ordem da aba Categorias
  let totalOut=0;
  const out=cats.map(name=>{
    const items=byCat[name].sort((a,b)=>(a.t.paymentDate||a.t.date).localeCompare(b.t.paymentDate||b.t.date)||a.t.description.localeCompare(b.t.description,"pt-BR")).map(({t,s})=>({
      id:t.id, description:t.description, par:t.installments>1?` ${t.installmentNo||1}/${t.installments}`:"",
      who:s.ownerId!=="self"?(data.people.find(p=>p.id===s.ownerId)?.name||"Outra pessoa"):"",
      date:t.paymentDate||t.date, paid:t.paymentStatus==="paid", amount:Number(s.amount||0)
    }));
    const sub=items.reduce((n,x)=>n+x.amount,0); totalOut+=sub;
    return {name,items,sub};
  });
  // Entradas em três grupos: salário/normais, extras (reembolsos) e devolução de empréstimos
  const groups=[["normal","Entradas do salário e outras"],["reimb","Entradas extras (reembolsos)"],["loan","Entradas de empréstimos cedidos"]];
  let totalIn=0;
  const inc=[];
  groups.forEach(([key,label])=>{
    const list=incomes.filter(t=>incomeOrigin(t)===key).sort((a,b)=>a.date.localeCompare(b.date)||a.description.localeCompare(b.description,"pt-BR"));
    if(!list.length)return;
    const sub=list.reduce((n,t)=>n+t.value,0); totalIn+=sub;
    inc.push({name:label,items:list.map(t=>({id:t.id,description:t.description,date:t.date,amount:t.value})),sub});
  });
  return {out,totalOut,inc,totalIn,bal:totalIn-totalOut};   // saldo = entradas - total gasto (valores cheios, como na planilha)
}

// Meses (AAAA-MM) que têm algo na Planilha do mês: gastos pelo mês do pagamento previsto, entradas pelo mês da entrada.
function sheetMonths(){
  const set=new Set();
  data.transactions.forEach(t=>{ if(t.type==="expense") set.add((t.paymentDate||t.date).slice(0,7)); else if(t.type==="income") set.add(t.date.slice(0,7)); });
  return [...set].filter(m=>/^\d{4}-\d{2}$/.test(m)).sort();
}

// Monta a aba de um mês, igual à Planilha do mês da tela (categoria e soma por categoria ficam em células mescladas).
function monthSheetForExcel(m){
  const model=sheetModel(m), rows=[], merges=[], H=t=>({v:t,s:1});
  rows.push([H("Categoria"),H("Despesas e descrição"),H("Pagamento previsto"),H("Valor previsto (R$)"),H("Soma por categoria")]);
  const group=(g,base,line)=>{
    const first=rows.length+1;
    g.items.forEach((x,i)=>rows.push([{v:i===0?g.name:undefined,s:base+2},{v:line(x).text,s:base},{v:line(x).date,s:base},{v:x.amount,s:base+1},{v:i===0?g.sub:undefined,s:base+1}]));
    if(g.items.length>1) merges.push(`A${first}:A${first+g.items.length-1}`,`E${first}:E${first+g.items.length-1}`);
  };
  const total=(label,value,base)=>{ const r=rows.length+1; rows.push([{v:label,s:base},{s:base},{s:base},{v:value,s:base+1},{s:base+1}]); merges.push(`A${r}:C${r}`,`D${r}:E${r}`); };
  model.out.forEach((g,gi)=>group(g,gi%2?5:2,x=>({text:x.description+x.par+(x.who?` (${x.who})`:""),date:shortDate(x.date)+(x.paid?" ✓":"")})));
  total("Total gasto no mês",model.totalOut,14);
  model.inc.forEach((g,gj)=>group(g,gj%2?11:8,x=>({text:x.description,date:shortDate(x.date)})));
  total("Soma das entradas",model.totalIn,16);
  total("Saldo do mês",model.bal,18);
  const [y,mm]=m.split("-");
  return {name:`${MESES_ABREV[Number(mm)-1]} ${y}`,rows,merges,cols:[28,46,18,20,20],freeze:true,fit:true};
}

// Aba escondida com todos os dados do app em texto (em pedaços, pois uma célula do Excel guarda até ~32 mil caracteres).
function dataSheetForExcel(){
  const json=JSON.stringify(data), rows=[[{v:"NÃO APAGUE esta aba: é dela que o app restaura os dados (Importar > Restaurar de um arquivo). Pode deixá-la escondida.",s:20}],[{v:XLSX_MARK}]];
  for(let i=0;i<json.length;i+=30000) rows.push([{v:json.slice(i,i+30000)}]);
  return {name:XLSX_DATA_SHEET,rows,cols:[120],hidden:true};
}

// Cria o .xlsx completo (uma aba por mês + aba escondida de dados). Devolve Uint8Array.
function buildBackupXlsx(){
  const sheets=sheetMonths().map(monthSheetForExcel);
  if(!sheets.length) sheets.push({name:"Planilha",rows:[[{v:"Ainda não há lançamentos. Quando houver, cada mês vira uma aba aqui.",s:20}]],cols:[60]});
  sheets.push(dataSheetForExcel());
  return buildXlsx(sheets);
}

// Lê os dados de um .xlsx gerado pelo app (aba escondida "Dados do app"). Devolve o objeto do backup.
async function backupFromXlsx(bytes){
  const cells=await readXlsxSheet(bytes,XLSX_DATA_SHEET);
  if(!cells||cells.A2!==XLSX_MARK) throw new Error('Esta planilha não tem a aba "Dados do app" do Meu Controle. Só dá para restaurar planilhas geradas pelo próprio app (e sem apagar essa aba).');
  const rows=Object.keys(cells).filter(k=>/^A\d+$/.test(k)).map(k=>Number(k.slice(1))).filter(n=>n>=3).sort((a,b)=>a-b);
  try{ return JSON.parse(rows.map(n=>cells["A"+n]).join("")) }
  catch{ throw new Error("Os dados dentro da planilha estão incompletos ou foram alterados.") }
}

// Lê um arquivo de backup escolhido: planilha .xlsx do app (começa com "PK") ou backup .json.
async function backupFromBytes(bytes){
  if(bytes[0]===0x50&&bytes[1]===0x4B) return backupFromXlsx(bytes);
  try{ return JSON.parse(new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/,"")) }
  catch{ throw new Error("O arquivo não é um backup .json do app nem uma planilha .xlsx gerada por ele.") }
}

// Baixa a planilha Excel.
function exportExcel(){
  try{
    const blob=new Blob([buildBackupXlsx()],{type:XLSX_MIME});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`meu-controle-planilha-${today()}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    markBackedUp();toast("Planilha Excel baixada");
  }catch(e){ askAlert("Não consegui gerar a planilha: "+(e?.message||e)) }
}

// Arquivo .xlsx pronto para compartilhar junto com o backup (null se não conseguir gerar).
function backupXlsxFile(){
  try{ return new File([buildBackupXlsx()],`meu-controle-planilha-${today()}.xlsx`,{type:XLSX_MIME}) }catch{ return null }
}

;
