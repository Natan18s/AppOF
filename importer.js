// ====================================================================
// importer.js — importação de CSV/OFX
// Leitura de extratos de banco/cartão, detecção de duplicados e prévia antes de importar.
// ====================================================================

// Preenche a lista de cartões da aba Importar.
function renderImportCardOptions(){const sel=$("importCard");if(!sel)return;const current=sel.value;sel.innerHTML='<option value="">Detectar pelo arquivo OFX / sem cartão</option>'+data.cards.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");if(current)sel.value=current}

// Lê um arquivo como texto, detectando UTF-8 ou Windows-1252.
function readFileAsText(file){
  return file.arrayBuffer().then(buf=>{
    let utf8=new TextDecoder("utf-8",{fatal:false}).decode(buf);
    const needs1252=utf8.includes("�");
    if(needs1252) return new TextDecoder("windows-1252").decode(buf);
    return utf8.replace(/^\uFEFF/,"");
  });
}

// Descobre se o arquivo é OFX ou CSV.
function detectFormat(file,text){
  const ext=file.name.toLowerCase().split(".").pop();
  if(ext==="ofx"||ext==="qfx"||text.includes("<OFX>")) return "ofx";
  return "csv";
}

// Descobre o separador do CSV pela primeira linha: ";" (bancos brasileiros, que usam vírgula nos valores, ex.: 1.234,56),
// tabulação ou "," (Nubank). Antes, todos eram aceitos ao mesmo tempo e "8,50" virava duas colunas ("8" e "50").
function detectCsvDelimiter(text){
  const first=text.split(/\r?\n/).find(l=>l.trim())||"";
  const count=ch=>{let n=0,q=false;for(const c of first){if(c==='"')q=!q;else if(c===ch&&!q)n++}return n};
  const semi=count(";"),tab=count("\t"),comma=count(",");
  if(semi>0&&semi>=comma)return ";";
  if(tab>0&&tab>comma)return "\t";
  return ",";
}

// Lê um CSV (Nubank, PicPay, bancos brasileiros...) e devolve as linhas com data, descrição e valor.
function parseCSV(text){
  const delim=detectCsvDelimiter(text);
  const rows=[];let row=[],cell="",quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(ch==='"'){
      if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted;
    }else if(ch===delim&&!quoted){
      row.push(cell);cell="";
    }else if((ch==="\n"||ch==="\r")&&!quoted){
      if(ch==="\r"&&text[i+1]==="\n")i++;
      row.push(cell); if(row.some(x=>x.trim()!==""))rows.push(row); row=[];cell="";
    }else cell+=ch;
  }
  row.push(cell);if(row.some(x=>x.trim()!==""))rows.push(row);
  if(rows.length<2) return [];
  const headers=rows[0].map(h=>normalizeHeader(h));
  const getIndex=(aliases)=>headers.findIndex(h=>aliases.includes(h));
  const iDate=getIndex(["date","data","data da compra","data da transacao","data transacao"]);
  const iDesc=getIndex(["title","descricao","descrição","description","estabelecimento","historico","histórico","nome"]);
  const iAmount=getIndex(["amount","valor","value"]);
  if(iDate<0||iDesc<0||iAmount<0) throw new Error("Não consegui identificar as colunas de data, descrição e valor.");
  return rows.slice(1).map(r=>{
    const rawAmount=(r[iAmount]||"").trim();
    return {
      date:normalizeDate(r[iDate]),
      description:(r[iDesc]||"").trim(),
      amount:parseBRL(rawAmount),
      rawAmount,
      sourceKey:`csv|${r[iDate]}|${r[iDesc]}|${rawAmount}`,
      cardName:""
    };
  }).filter(x=>x.date&&x.description&&Number.isFinite(x.amount));
}

// Padroniza o nome de uma coluna (minúsculas, sem acento) para reconhecê-la.
function normalizeHeader(h){return String(h).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/^["']|["']$/g,"")}

// Converte texto de valor (1.234,56 / -50,00 / R$ 10) em número.
function parseBRL(v){
  let s=String(v).trim().replace(/\s/g,"");
  if(!s)return NaN;
  const neg=/^-/.test(s); s=s.replace(/^[-+]/,"");
  s=s.replace(/R\$/gi,"");
  if(s.includes(",") && s.includes(".")) s=s.replace(/\./g,"").replace(",",".");
  else if(s.includes(",")) s=s.replace(",",".");
  const n=Number(s);
  return neg?-Math.abs(n):Math.abs(n);
}

// Converte DD/MM/AAAA ou AAAA-MM-DD para AAAA-MM-DD.
function normalizeDate(v){
  const s=String(v||"").trim();
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  const m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(m)return `${m[3]}-${m[2]}-${m[1]}`;
  const m2=s.match(/^(\d{2})-(\d{2})-(\d{4})$/);if(m2)return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return "";
}

// Procura "2/10" ou "parcela 2 de 10" na descrição para identificar a parcela.
function parseInstallment(desc){
  const s=desc;
  let m=s.match(/(?:parcela\s*)?(\d{1,2})\s*[\/de]\s*(\d{1,2})/i);
  if(!m)m=s.match(/(\d{1,2})\s*[\/]\s*(\d{1,2})/);
  return m?{no:Number(m[1]),total:Number(m[2])}:{no:1,total:1};
}

// Lê um arquivo OFX (extrato/fatura) e devolve as transações.
function parseOFX(text){
  const blocks=[...text.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)].map(m=>m[1]);
  if(!blocks.length) throw new Error("Não encontrei transações <STMTTRN> no OFX.");
  const cardName=text.match(/<ORG>([^<]+)/i)?.[1]||"Cartão importado";
  return blocks.map(b=>{
    const tag=name=>b.match(new RegExp(`<${name}>([^<\r\n]+)`,`i`))?.[1]?.trim()||"";
    const rawDate=tag("DTPOSTED").slice(0,8);
    const date=rawDate.length===8?`${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`:"";
    const amount=Number(tag("TRNAMT").replace(",","."));
    const desc=tag("MEMO")||tag("NAME")||"Transação";
    const fitid=tag("FITID");
    return {date,description:desc,amount,sourceKey:`ofx|${fitid||date+"|"+desc+"|"+amount}`,fitid,cardName};
  }).filter(x=>x.date&&Number.isFinite(x.amount));
}

// Linha de "pagamento da fatura" (não é gasto nem entrada: é o pagamento do cartão).
const isPaymentLine=desc=>/pagamento recebido|payment/i.test(desc);

// Qual sinal é "gasto" neste arquivo? Depende do banco: no CSV do Nubank as compras vêm POSITIVAS; no OFX de cartão e em
// extratos de conta elas vêm NEGATIVAS. Por isso vale o sinal da MAIORIA das linhas (sem contar pagamentos de fatura).
// Empate = compras positivas (o comportamento antigo). Devolve 1 (positivo é gasto) ou -1 (negativo é gasto).
function detectExpenseSign(rows){
  const real=rows.filter(r=>!isPaymentLine(r.description));
  const pos=real.filter(r=>r.amount>0).length, neg=real.filter(r=>r.amount<0).length;
  return neg>pos?-1:1;
}

// Lê o arquivo escolhido e classifica cada linha (gasto, pagamento de fatura, entrada/estorno).
async function parseImport(file){
  const text=await readFileAsText(file);
  const format=detectFormat(file,text);
  const rows=format==="ofx"?parseOFX(text):parseCSV(text);
  const selectedImportCard=$("importCard")?.value||"";
  const expenseSign=detectExpenseSign(rows);
  const mapped=rows.map(r=>{
    const installment=parseInstallment(r.description);
    const isCardPayment=isPaymentLine(r.description);
    const isExpense=!isCardPayment && Math.sign(r.amount)===expenseSign;
    const value=Math.abs(r.amount);
    const cardId=r.cardName?ensureImportedCard([r])?.id:selectedImportCard;
    return {...r,value,isExpense,isCardPayment,installmentNo:installment.no,installments:installment.total,format,cardId,paymentDate:(isExpense&&cardId)?nextCardPaymentDate(cardId,r.date):r.date,paymentStatus:(isExpense&&cardId)?"planned":"paid"};
  });
  return {format,rows:mapped,expenseSign};
}

// Muda o tipo de UMA linha da prévia ("expense" gasto, "income" entrada/estorno, "payment" pagamento da fatura)
// e recalcula quando ela será paga (gasto no cartão vence no mês seguinte; o resto vale na própria data).
function setImportRowType(r,type){
  r.isCardPayment=type==="payment";
  r.isExpense=type==="expense";
  r.paymentDate=(r.isExpense&&r.cardId)?nextCardPaymentDate(r.cardId,r.date):r.date;
  r.paymentStatus=(r.isExpense&&r.cardId)?"planned":"paid";
}

// Troca gasto <-> entrada em todas as linhas da prévia (pagamentos de fatura ficam como estão).
function flipImportRows(rows){
  rows.forEach(r=>{ if(!r.isCardPayment) setImportRowType(r,r.isExpense?"income":"expense"); });
}

// Diz se a linha já foi importada antes (para não duplicar).
function isDuplicate(r){
  return data.transactions.some(t=>t.importKey===r.sourceKey || (t.date===r.date && Math.abs(t.value-r.value)<0.005 && t.description.toLowerCase()===r.description.toLowerCase()));
}

// Recebe o arquivo da aba Importar. Backup .json é restaurado direto; CSV/OFX vira prévia.
async function handleFile(file){
  if(!file)return;
  selectedImport=file;$("selectedFile").textContent=`Selecionado: ${file.name}`;
  $("importStatus").classList.add("hidden");
  // Backup do próprio app (.json) solto aqui: restaura direto, em vez de tentar ler como extrato do banco
  if(/\.json$/i.test(file.name)||file.type==="application/json"){
    let parsed=null;
    try{ parsed=JSON.parse(await file.text()) }catch{}
    if(parsed && Array.isArray(parsed.transactions) && Array.isArray(parsed.cards) && Array.isArray(parsed.people)){
      if(await applyBackup(parsed,"arquivo solto em Importar")){
        $("importStatus").textContent="Esse arquivo era um backup do próprio app — os dados foram restaurados direto, sem passar pela importação de extrato.";
        $("importStatus").classList.remove("hidden");
      }
      selectedImport=null;$("selectedFile").textContent="Nenhum arquivo selecionado";
      return;
    }
    $("importStatus").textContent="Esse .json não tem o formato de um extrato nem de um backup deste app.";
    $("importStatus").classList.remove("hidden");
    return;
  }
  try{
    const result=await parseImport(file);
    const card=ensureImportedCard(result.rows);
    await fixOldWrongImports(result.rows);   // entradas que uma importação antiga gravou por engano (eram gastos)
    pendingImport=result.rows.filter(r=>!isDuplicate(r)).map(r=>({...r,cardId:card?.id||r.cardId||"",category:applyRule(r.description)}));
    const duplicates=result.rows.length-pendingImport.length;
    importPreviewInfo={format:result.format,duplicates,expenseSign:result.expenseSign};
    showImportPreview(result.format,pendingImport,duplicates,result.expenseSign);
  }catch(e){
    $("importStatus").textContent=`Erro ao ler arquivo: ${e.message}`;
    $("importStatus").classList.remove("hidden");
    $("importPreview").classList.add("hidden");
  }
}

// Cria o cartão detectado no OFX se ele ainda não existir.
function ensureImportedCard(rows){
  const name=rows.find(r=>r.cardName)?.cardName;
  if(!name)return null;
  let c=data.cards.find(x=>x.name.toLowerCase()===name.toLowerCase());
  if(!c){c={id:uid(),name:name,limit:0,closing:10,due:19};data.cards.push(c)}
  return c;
}

// Dados da prévia aberta (para redesenhá-la quando o usuário muda o tipo de uma linha).
let importPreviewInfo={format:"csv",duplicates:0,expenseSign:1};

// Importações feitas com a regra antiga podem ter gravado compras como ENTRADA ("Crédito importado"). Se este arquivo traz
// essas mesmas linhas como gasto, pergunta se pode apagar essas entradas (uma cópia fica no aparelho) para importar de novo certo.
async function fixOldWrongImports(rows){
  const expenses=rows.filter(r=>r.isExpense), ids=new Set();
  data.transactions.forEach(t=>{
    if(t.type!=="income"||t.source!=="imported-credit")return;
    if(expenses.some(r=>t.importKey===r.sourceKey||(t.date===r.date&&Math.abs(t.value-r.value)<0.005&&String(t.description).toLowerCase()===r.description.toLowerCase())))ids.add(t.id);
  });
  if(!ids.size)return;
  const ok=await askConfirm(`Encontrei ${ids.size} lançamento(s) deste arquivo que foram importados antes como ENTRADA por engano (eram gastos). Quer apagar essas entradas e importar de novo como gasto? Uma cópia delas fica guardada neste aparelho.`,{title:"Corrigir importação anterior",okText:"Apagar e importar como gasto",cancelText:"Manter como estão"});
  if(!ok)return;
  const removed=data.transactions.filter(t=>ids.has(t.id));
  try{localStorage.setItem("meu-controle-importacao-removida",JSON.stringify({at:new Date().toISOString(),items:removed}))}catch{}
  data.transactions=data.transactions.filter(t=>!ids.has(t.id));
  logActivity("import","Entradas importadas por engano foram apagadas",`${removed.length} lançamento(s) serão importados de novo como gasto`);
  save();
}

// Mostra a prévia da importação antes de confirmar. Cada linha tem um seletor de tipo (Gasto / Entrada / Pagamento do cartão).
function showImportPreview(format,rows,duplicates,expenseSign){
  if(expenseSign!==undefined)importPreviewInfo={format,duplicates,expenseSign};
  const sign=importPreviewInfo.expenseSign;
  const g=rows.filter(r=>r.isExpense).length, p=rows.filter(r=>r.isCardPayment).length, c=rows.length-g-p;
  $("importPreview").classList.remove("hidden");
  // No celular, a tabela larga esticava o cartão inteiro além da tela (o botão "Importar" ficava fora). Com min-width:0 o cartão
  // cabe na tela e só a tabela rola para os lados, dentro da própria caixa.
  $("importPreview").style.minWidth="0"; const cardBox=$("importPreview").closest("article"); if(cardBox)cardBox.style.minWidth="0";
  $("previewCount").textContent=`${rows.length} novos (${g} gasto(s), ${c} entrada(s), ${p} pagamento(s) de fatura) · ${duplicates} repetidos ignorados`;
  // Seletor de tipo bem estreito (rótulos curtos) para a tabela caber na tela do celular.
  const typeSelect=(r,i)=>`<select class="import-type" style="width:auto;min-width:68px;max-width:100px;padding:4px 2px;font-size:12px" data-i="${i}" aria-label="Tipo da linha"><option value="expense" ${r.isExpense?"selected":""}>Gasto</option><option value="income" ${!r.isExpense&&!r.isCardPayment?"selected":""}>Entrada</option><option value="payment" ${r.isCardPayment?"selected":""}>Fatura</option></select>`;
  const td='<td style="padding:6px 4px">';
  $("previewTable").innerHTML=rows.length?rows.map((r,i)=>`<tr>${td}${fmtDate(r.date)}</td>${td}${esc(r.description)}</td><td style="padding:6px 4px" class="${r.isExpense?"negative":"positive"}">${r.isExpense?"-":"+"} ${fmtMoney(r.value)}</td>${td}${typeSelect(r,i)}</td>${td}${r.isExpense?fmtDate(r.paymentDate):"—"}</td>${td}${r.installments>1?`${r.installmentNo}/${r.installments}`:"—"}</td></tr>`).join(""):'<tr><td colspan="6" class="empty">Nenhum lançamento novo.</td></tr>';
  const tabela=$("previewTable").closest("table"); if(tabela){tabela.style.minWidth="0";tabela.style.fontSize="12px";tabela.querySelectorAll("th").forEach(h=>{h.style.padding="6px 4px"})}
  document.querySelectorAll("#previewTable .import-type").forEach(sel=>{
    sel.onchange=()=>{ setImportRowType(pendingImport[Number(sel.dataset.i)],sel.value); showImportPreview(importPreviewInfo.format,pendingImport,importPreviewInfo.duplicates); };
  });
  const st=$("importStatus");
  st.textContent=`Formato detectado: ${format.toUpperCase()}. Neste arquivo, valores ${sign<0?"NEGATIVOS":"POSITIVOS"} foram tratados como gasto (é o sinal da maioria das linhas). Se estiver ao contrário, mude o Tipo de cada linha ou use o botão: `;
  const flip=document.createElement("button");
  flip.type="button";flip.className="btn";flip.textContent="Inverter gasto ↔ entrada em todas";
  flip.onclick=()=>{ flipImportRows(pendingImport); showImportPreview(importPreviewInfo.format,pendingImport,importPreviewInfo.duplicates); };
  st.append(flip);
  st.classList.remove("hidden");
}
