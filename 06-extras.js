/* ===== backup.js ===== */
// ====================================================================
// backup.js — backup e restauração
// Baixar, compartilhar, copiar e restaurar os dados.
// ====================================================================

// Texto JSON com todos os dados do app.
function backupPayload(){ return JSON.stringify(data,null,2); }

// Registra a data do último backup (some o lembrete).
function markBackedUp(){ data.lastBackupAt=Date.now(); save(); }

// Baixa o backup como arquivo .json.
function exportBackup(){
  const blob=new Blob([backupPayload()],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`meu-controle-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  markBackedUp();toast("Backup exportado");
}

// Abre o menu de compartilhar do aparelho com o arquivo de backup (ou baixa, se não houver suporte).
async function shareBackup(){
  try{
    const file=new File([backupPayload()],`meu-controle-backup-${today()}.json`,{type:"application/json"});
    if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:"Backup Meu Controle"}); markBackedUp(); return }
  }catch(e){ if(e && e.name==="AbortError") return }
  exportBackup();   // sem suporte a compartilhamento de arquivo: cai para o download normal
}

// Copia o backup como texto para colar em outro aparelho.
async function copyBackupText(){
  const text=backupPayload();
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){ await navigator.clipboard.writeText(text) }
    else{ const ta=document.createElement("textarea"); ta.value=text; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove() }
    markBackedUp();
    toast("Backup copiado. Cole em uma mensagem para você mesmo ou direto no outro aparelho.");
  }catch{
    $("backupExportText").value=text; $("backupExportText").classList.remove("hidden-file");
    askAlert("Não consegui copiar automaticamente. Selecione o texto que apareceu na caixa e copie manualmente.");
  }
}

// Junta o backup recebido (arquivo, texto colado...) aos dados atuais, preenchendo o que faltar, como o loadData() já faz ao abrir o app
async function applyBackup(x,sourceLabel){
  if(isDemoMode()){ askAlert("Saia do modo demonstração (aba Importar) antes de restaurar um backup."); return false; }
  if(!x || typeof x!=="object" || !Array.isArray(x.transactions) || !Array.isArray(x.cards) || !Array.isArray(x.people)){
    askAlert("Esse backup não tem o formato esperado (faltam lançamentos, cartões ou pessoas)."); return false;
  }
  if(!(await askConfirm("Restaurar este backup vai substituir TODOS os dados deste aparelho. Deseja continuar?",{title:"Restaurar backup",okText:"Restaurar",danger:true}))) return false;
  const merged=structuredClone(defaultData);
  merged.transactions=(x.transactions||[]).map(t=>normalizeTransaction({...t}));
  merged.cards=x.cards.length?x.cards:merged.cards;
  merged.people=x.people.some(p=>p.id==="self")?x.people:[{id:"self",name:"Você"},...x.people];
  // Backup antigo: junta com as categorias padrão e ordena (uma vez). Backup novo: mantém a ordem que você deixou.
  merged.categories=x.categoriesV2 ? (x.categories||[]) : [...new Set([...(x.categories||[]),...defaultData.categories])].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  merged.categoriesV2=true;
  merged.rules=x.rules||[];
  merged.importLog=x.importLog||[];
  merged.activityLog=x.activityLog||[];
  merged.lastBackupAt=x.lastBackupAt||null;
  merged.budgets=(x.budgets&&typeof x.budgets==="object")?x.budgets:{};   // limites mensais por categoria
  merged.recurring=Array.isArray(x.recurring)?x.recurring:[];            // modelos de lançamentos recorrentes
  data=merged;
  logActivity("restore",`Backup restaurado (${sourceLabel||"arquivo"})`,`${merged.transactions.length} lançamento(s) carregados`);
  save();
  toast(`Backup restaurado${sourceLabel?" ("+sourceLabel+")":""}`);
  return true;
}

// Restaura a partir de um arquivo .json escolhido.
function restoreBackup(){
  const f=$("backupInput").files[0];if(!f)return;
  const reader=new FileReader();
  reader.onload=async()=>{
    try{ await applyBackup(JSON.parse(reader.result),"arquivo") }
    catch(e){ askAlert("Não consegui ler esse arquivo como backup. Confira se é o .json exportado pelo próprio app.") }
  };
  reader.onerror=()=>askAlert("Não consegui abrir esse arquivo.");
  reader.readAsText(f);
  $("backupInput").value="";
}

// Restaura a partir do texto colado.
async function restoreFromText(){
  const raw=$("backupPasteText").value.trim();
  if(!raw){askAlert("Cole o texto do backup antes de restaurar.");return}
  try{
    if(await applyBackup(JSON.parse(raw),"texto colado")) $("backupPasteText").value="";
  }catch(e){ askAlert("Esse texto não é um backup válido. Confira se copiou tudo, do { inicial ao } final.") }
}

;
/* ===== recorrentes.js ===== */
// ====================================================================
// recorrentes.js — lançamentos recorrentes (aluguel, assinaturas, salário...)
// Você cadastra o modelo uma vez (aba Regras) e o app cria o lançamento de cada mês sozinho,
// do mês inicial até seis meses à frente. Cada mês é gerado uma única vez: se você excluir um
// lançamento gerado, ele NÃO volta. Mudar o modelo vale para os meses que ainda não foram gerados.
// ====================================================================

// Até quantos meses à frente do mês atual o app já deixa os lançamentos criados.
const RECURRING_HORIZON = 6;

// Meses (AAAA-MM) do modelo r que ainda precisam ser gerados, do mês inicial até upTo (ou até o mês final, se houver).
function recurringMonths(r,upTo){
  if(!r.active) return [];
  const end = r.endMonth || upTo;
  const done = r.generated||[];
  const out=[]; let m=r.startMonth, guard=0;
  while(m<=end && guard++<600){ if(!done.includes(m)) out.push(m); m=shiftMonthStr(m,1); }
  return out;
}

// Monta o lançamento de um mês a partir do modelo. Gasto: uma parte só, sua. Crédito: vence no mês seguinte (como no formulário).
function buildRecurringTransaction(r,m,now=today()){
  const date=shiftMonthDate(m,r.day,0), value=Number(r.value)||0;
  const base={id:uid(),createdAt:Date.now(),recurringId:r.id,date,description:r.description,value};
  if(r.type==="income") return {...base,type:"income",source:"normal"};
  const credit=isCreditMethod(r.method);
  return {
    ...base,type:"expense",method:r.method,cardId:credit?r.cardId:"",
    paymentDate:credit?nextCardPaymentDate(r.cardId,date):date,
    paymentStatus:(credit||date>now)?"planned":"paid",
    splits:[{id:uid(),category:r.category,amount:value,ownerId:"self",reimbursed:false}],
    installments:1,installmentNo:1
  };
}

// Cria os lançamentos que faltam de todos os modelos ativos. Devolve quantos criou (quem chama decide se precisa salvar).
function generateRecurring(now=today()){
  const upTo=shiftMonthStr(now.slice(0,7),RECURRING_HORIZON);
  let count=0, first=null; const changes=[];
  (data.recurring||[]).forEach(r=>{
    recurringMonths(r,upTo).forEach(m=>{
      const t=buildRecurringTransaction(r,m,now);
      if(r.startDate&&t.date<r.startDate) return;
      if(r.endDate&&t.date>r.endDate) return;
      t.createdAt+=count;   // mantém a ordem de criação
      data.transactions.push(t);
      (r.generated=r.generated||[]).push(m);
      changes.push({before:null,after:structuredClone(t)});
      count++; first=first||t;
    });
  });
  if(count) logActivity("create",`Recorrentes: ${count} lançamento(s) criado(s) automaticamente`,first?first.description+(count>1?" e outros":""):"",first?first.id:"",{changes});
  return count;
}

// Texto curto de "quando acontece", para a lista: "todo dia 5 · desde 10/2026 · até 12/2026".
function recurringWhen(r){
  if(r.startDate) return `todo dia ${r.day} · de ${fmtDate(r.startDate)}${r.endDate?` · até ${fmtDate(r.endDate)}`:" · sem data final"}`;
  return `todo dia ${r.day} · desde ${fmtMonthLabel(r.startMonth)}${r.endMonth?` · até ${fmtMonthLabel(r.endMonth)}`:" · sem data final"}`;
}

// Lista de modelos recorrentes (aba Regras).
function renderRecurring(){
  const box=$("recurringList"); if(!box) return;
  const list=data.recurring||[];
  box.innerHTML=list.length ? list.map(r=>{
    const kind=r.type==="income"?"Entrada":"Gasto";
    const how=r.type==="income"?"":` · ${esc(METHODS[r.method]||"")}${isCreditMethod(r.method)?" "+esc(data.cards.find(c=>c.id===r.cardId)?.name||""):""} · ${esc(r.category)}`;
    return `<div class="rule-row recur-row${r.active?"":" recur-paused"}"><div><b>${esc(r.description)}</b> <span class="tag">${kind}</span>${r.active?"":'<span class="tag">Pausado</span>'}<div class="muted">${fmtMoney(r.value)} · ${recurringWhen(r)}${how}</div><div class="muted">${(r.generated||[]).length} lançamento(s) já criado(s)</div></div><div class="row-actions"><button class="btn" onclick="toggleRecurring('${r.id}')">${r.active?"Pausar":"Retomar"}</button><button class="btn" onclick="openRecurringModal('${r.id}')">Editar</button><button class="btn ghost" onclick="deleteRecurring('${r.id}')">Excluir</button></div></div>`;
  }).join("") : '<div class="empty">Nenhum lançamento recorrente. Cadastre aluguel, assinaturas ou salário uma vez e o app cria todo mês.</div>';
}

// Aplica o modelo r (dia, valor, descrição, categoria, forma de pagamento) aos lançamentos já criados da lista. Devolve quantos mudaram.
// Gasto que você dividiu com outras pessoas não é mexido. Fica no histórico e dá para desfazer.
function applyRecurringToTransactions(r,list){
  const changes=[], value=Number(r.value)||0;
  list.forEach(t=>{
    if(t.type!==r.type) return;
    if(t.type==="expense"&&!(t.splits?.length===1&&t.splits[0].ownerId==="self")) return;
    const before=structuredClone(t);
    t.date=shiftMonthDate(t.date.slice(0,7),r.day,0); t.description=r.description; t.value=value;
    if(t.type==="expense"){
      const credit=isCreditMethod(r.method);
      t.method=r.method; t.cardId=credit?r.cardId:""; t.paymentDate=credit?nextCardPaymentDate(r.cardId,t.date):t.date;
      t.splits[0].category=r.category; t.splits[0].amount=value;
    }
    changes.push({before,after:structuredClone(t)});
  });
  if(changes.length) logActivity("edit",`Recorrente atualizado: ${r.description}`,`${changes.length} lançamento(s) já criado(s) foram ajustados`,"",{changes});
  return changes.length;
}

// Painel para criar ou editar um modelo recorrente.
function openRecurringModal(id=null){
  const r=id?data.recurring.find(x=>x.id===id):{type:"expense",description:"",value:"",day:Number(today().slice(8,10)),startMonth:today().slice(0,7),endMonth:"",method:"pix",cardId:data.cards[0]?.id||"",category:data.categories.includes("Contas")?"Contas":data.categories[0],active:true};
  if(!r) return;
  const methods=Object.entries(METHODS);
  openModal(id?"Editar recorrente":"Novo lançamento recorrente",`<form id="recurringForm" class="form-grid">
    <div><label>Tipo</label><select name="type" id="recType"><option value="expense" ${r.type==="expense"?"selected":""}>Gasto</option><option value="income" ${r.type==="income"?"selected":""}>Entrada</option></select></div>
    <div><label>Valor</label><input name="value" type="number" min="0.01" step="0.01" value="${esc(r.value)}" required></div>
    <div class="full"><label>Descrição</label><input name="description" value="${esc(r.description)}" placeholder="Ex.: Aluguel, Netflix, Salário" required></div>
    <div><label>Dia do mês</label><input name="day" type="number" min="1" max="31" value="${esc(r.day)}" required></div>
    <div><label>Começa em</label><input name="startMonth" type="month" value="${esc(r.startMonth)}" required></div>
    <div><label>Termina em (opcional)</label><input name="endMonth" type="month" value="${esc(r.endMonth||"")}"></div>
    <div class="rec-exp"><label>Categoria</label><select name="category">${categoriesOutrosLast(data.categories).map(c=>`<option ${c===r.category?"selected":""}>${esc(c)}</option>`).join("")}</select></div>
    <div class="rec-exp"><label>Forma de pagamento</label><select name="method" id="recMethod">${methods.map(([k,v])=>`<option value="${k}" ${k===r.method?"selected":""}>${v}</option>`).join("")}</select></div>
    <div class="rec-card"><label>Cartão</label><select name="cardId">${data.cards.map(c=>`<option value="${esc(c.id)}" ${c.id===r.cardId?"selected":""}>${esc(c.name)}</option>`).join("")}</select></div>
    <div class="full field-note">O app cria o lançamento de cada mês sozinho, até seis meses à frente. Se você excluir um já criado, ele não volta. Mudanças valem para os meses ainda não criados.</div>
    <div class="full row-actions end"><button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary">Salvar</button></div>
  </form>`);
  const sync=()=>{
    const exp=$("recType").value==="expense", credit=exp&&$("recMethod").value==="credit";
    document.querySelectorAll("#recurringForm .rec-exp").forEach(e=>e.classList.toggle("hidden",!exp));
    document.querySelectorAll("#recurringForm .rec-card").forEach(e=>e.classList.toggle("hidden",!credit));
  };
  $("recType").onchange=sync;$("recMethod").onchange=sync;sync();
  $("recurringForm").onsubmit=async e=>{
    e.preventDefault();
    const f=new FormData(e.target), type=f.get("type"), method=f.get("method")||"pix";
    const item={type,description:f.get("description").trim(),value:Math.round(Number(f.get("value"))*100)/100,day:Math.min(31,Math.max(1,Math.round(Number(f.get("day"))||1))),startMonth:f.get("startMonth"),endMonth:f.get("endMonth")||"",method:type==="expense"?method:"",cardId:type==="expense"&&isCreditMethod(method)?f.get("cardId"):"",category:type==="expense"?f.get("category"):""};
    if(!item.description){askAlert("Informe a descrição.");return}
    if(!(item.value>0)){askAlert("Informe um valor maior que zero.");return}
    if(!item.startMonth){askAlert("Informe o mês em que começa.");return}
    if(item.endMonth&&item.endMonth<item.startMonth){askAlert("O mês final não pode ser antes do mês inicial.");return}
    if(type==="expense"&&isCreditMethod(method)&&!item.cardId){askAlert("Cadastre ou selecione um cartão.");return}
    let atualizados=0;
    if(id){
      const model=data.recurring.find(x=>x.id===id), antes={...model};
      // datas exatas (criadas pelo formulário de lançamento) só valem se continuam dentro do mês escolhido aqui
      if(model.startDate&&model.startDate.slice(0,7)!==item.startMonth) item.startDate="";
      if(model.endDate&&model.endDate.slice(0,7)!==item.endMonth) item.endDate="";
      Object.assign(model,item);
      const mudou=["description","value","day","method","cardId","category"].some(k=>String(antes[k]??"")!==String(item[k]??""));
      const jaCriados=data.transactions.filter(t=>t.recurringId===id&&t.date.slice(0,7)>=today().slice(0,7));
      if(mudou&&type===antes.type&&jaCriados.length&&await askConfirm(`Aplicar as mudanças também aos ${jaCriados.length} lançamento(s) deste recorrente que já foram criados (do mês atual em diante)? Se escolher "Só os próximos", eles ficam como estão.`,{title:"Atualizar lançamentos já criados",okText:"Atualizar todos",cancelText:"Só os próximos"})) atualizados=applyRecurringToTransactions(model,jaCriados);
    }
    else data.recurring.push({id:uid(),...item,active:true,generated:[],createdAt:Date.now()});
    const n=generateRecurring();
    closeModal();save();
    toast(`Recorrente salvo${n?` · ${n} lançamento(s) criado(s)`:""}${atualizados?` · ${atualizados} já criado(s) atualizado(s)`:""}`);
  };
}

// Pausa ou retoma um modelo (pausado não cria lançamentos novos).
function toggleRecurring(id){
  const r=data.recurring.find(x=>x.id===id); if(!r) return;
  r.active=!r.active;
  const n=r.active?generateRecurring():0;
  save();toast(r.active?(n?`Retomado · ${n} lançamento(s) criado(s)`:"Retomado"):"Pausado");
}

// Exclui o modelo. Os lançamentos que ele já criou continuam na lista.
async function deleteRecurring(id){
  const r=data.recurring.find(x=>x.id===id); if(!r) return;
  if(!(await askConfirm(`"${r.description}" deixa de ser criado todo mês. Os lançamentos já criados continuam.`,{title:"Excluir recorrente",okText:"Excluir",danger:true}))) return;
  data.recurring=data.recurring.filter(x=>x.id!==id);
  save();toast("Recorrente excluído");
}

;
/* ===== graficos.js ===== */
// ====================================================================
// graficos.js — gráficos e orçamento do Resumo
// Evolução dos últimos 6 meses (barras), distribuição das saídas (rosca) e barras de orçamento por categoria.
// São desenhados em SVG puro (sem biblioteca), usando as cores do tema claro/escuro.
// ====================================================================

// Cores das fatias da rosca (funcionam nos dois temas).
const CHART_COLORS=["#007aff","#ff9500","#34c759","#ff3b30","#af52de","#5ac8fa","#ff2d55","#8e8e93"];   // cores do sistema da Apple
let trendMonthOffset=0;

function shiftTrendWindow(offset){trendMonthOffset+=offset;renderTrendChart()}

// Valor curto para eixos: R$ 850, R$ 1,2 mil, R$ 15 mil, R$ 1,5 mi.
function fmtCompact(v){
  const a=Math.abs(v), sign=v<0?"-":"";
  if(a>=1e6) return `${sign}R$ ${(a/1e6).toFixed(1).replace(".",",")} mi`;
  if(a>=1e3) return `${sign}R$ ${(a/1e3).toFixed(a>=1e4?0:1).replace(".",",").replace(/,0$/,"")} mil`;
  return `${sign}R$ ${Math.round(a)}`;
}

// Escolhe o passo "redondo" do eixo (1, 2, 2,5 ou 5 vezes uma potência de 10) e quantos passos cabem até o maior valor.
// Ex.: maior valor 4600 -> passo 2000, 3 passos, topo 6000 (eixo: 0, 2 mil, 4 mil, 6 mil).
function niceScale(max){
  const m=Math.max(max,1), raw=m/4, p=Math.pow(10,Math.floor(Math.log10(raw)));
  const step=[1,2,2.5,5,10].map(k=>k*p).find(v=>v>=raw-1e-9);
  const ticks=Math.max(1,Math.ceil(m/step-1e-9));
  return {step,ticks,top:step*ticks};
}
function niceMax(max){ return niceScale(max).top; }

// Atualiza os gráficos e o orçamento do Resumo.
function renderCharts(){ renderTrendChart(); renderDonutChart(); renderBudgets(); }

// Barras dos últimos 6 meses: entradas (verde) x gasto realmente seu (vermelho). Tocar num mês muda o mês visto.
function renderTrendChart(){
  const box=$("chartTrend"); if(!box) return;
  const endMonth=shiftMonthStr(month,trendMonthOffset),s=monthlySeries(endMonth,6),[startYear,startMonth]=s[0].month.split("-"),[endYear,endMonthNumber]=endMonth.split("-");
  const periodLabel=`${MONTHS_PT[Number(startMonth)-1].slice(0,3)}/${startYear.slice(2)}–${MONTHS_PT[Number(endMonthNumber)-1].slice(0,3)}/${endYear.slice(2)}`;
  if($("trendPeriodLabel")) $("trendPeriodLabel").textContent=periodLabel;
  if(s.every(x=>x.income===0&&x.own===0)){ box.innerHTML='<div class="empty">Sem entradas nem gastos nestes 6 meses.</div>'; return; }
  const W=420,H=250,L=50,R=6,T=12,B=46,plotW=W-L-R,plotH=H-T-B,gw=plotW/s.length,bw=Math.min(26,gw/2-5);
  const sc=niceScale(Math.max(...s.flatMap(x=>[x.income,x.own]))), top=sc.top;
  const y=v=>T+plotH-(v/top)*plotH;
  let svg=`<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Entradas e gasto realmente seu nos últimos 6 meses">`;
  for(let i=0;i<=sc.ticks;i++){ const v=sc.step*i; svg+=`<line class="c-grid" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end">${fmtCompact(v)}</text>`; }
  s.forEach((x,i)=>{
    const cx=L+i*gw+gw/2, sel=x.month===month, [yy,mm]=x.month.split("-");
    svg+=`<g class="c-month" data-m="${x.month}" tabindex="0" role="button" aria-label="${MONTHS_PT[Number(mm)-1]}/${yy}: entradas ${fmtMoney(x.income)}, gasto seu ${fmtMoney(x.own)}">`
      +`<title>${MONTHS_PT[Number(mm)-1]}/${yy}\nEntradas: ${fmtMoney(x.income)}\nGasto realmente seu: ${fmtMoney(x.own)}\nSaldo: ${fmtMoney(x.balance)}</title>`
      +`<rect class="c-hit${sel?" sel":""}" x="${cx-gw/2+3}" y="${T}" width="${gw-6}" height="${plotH+B-4}" rx="8"/>`
      +`<rect class="c-inc" x="${cx-bw-2}" y="${y(x.income)}" width="${bw}" height="${Math.max(0,T+plotH-y(x.income))}" rx="3"/>`
      +`<rect class="c-own" x="${cx+2}" y="${y(x.own)}" width="${bw}" height="${Math.max(0,T+plotH-y(x.own))}" rx="3"/>`
      +`<text class="${sel?"c-sel":""}" x="${cx}" y="${T+plotH+16}" text-anchor="middle">${MONTHS_PT[Number(mm)-1]}/${yy.slice(2)}</text>`
      +`<text class="${x.balance>=0?"c-pos":"c-neg"}" x="${cx}" y="${T+plotH+31}" text-anchor="middle">${fmtCompact(x.balance)}</text></g>`;
  });
  svg+="</svg>";
  box.innerHTML=svg+`<div class="chart-legend"><span><i style="background:var(--green)"></i>Entradas</span><span><i style="background:var(--red)"></i>Gasto realmente seu</span></div><div class="chart-note">Número embaixo de cada mês = saldo do mês. Toque num mês para vê-lo.</div>`;
  box.querySelectorAll("[data-m]").forEach(el=>{
    el.onclick=()=>{trendMonthOffset=0;setMonth(el.dataset.m)};
    el.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();trendMonthOffset=0;setMonth(el.dataset.m)}};
  });
}

// Rosca com a distribuição das saídas do mês (as 6 maiores categorias + "Outras").
function renderDonutChart(){
  const box=$("chartDonut"); if(!box) return;
  const all=categoryTotals(month), total=all.reduce((s,x)=>s+x.value,0);
  if(!total){ box.innerHTML='<div class="empty">Sem saídas neste mês.</div>'; return; }
  const items=all.slice(0,6), rest=all.slice(6).reduce((s,x)=>s+x.value,0);
  if(rest>0) items.push({category:"Outras",value:rest,other:true});
  const r=70,C=2*Math.PI*r; let acc=0;
  let svg=`<svg class="chart-svg donut" viewBox="0 0 200 200" role="img" aria-label="Distribuição das saídas do mês por categoria"><circle class="c-ring" cx="100" cy="100" r="${r}" fill="none" stroke-width="34"/>`;
  items.forEach((it,i)=>{
    const len=it.value/total*C;
    svg+=`<circle cx="100" cy="100" r="${r}" fill="none" stroke="${CHART_COLORS[i%CHART_COLORS.length]}" stroke-width="34" stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-acc}" transform="rotate(-90 100 100)"><title>${esc(it.category)}: ${fmtMoney(it.value)}</title></circle>`;
    acc+=len;
  });
  svg+=`<text class="c-center" x="100" y="98" text-anchor="middle">${fmtCompact(total)}</text><text x="100" y="116" text-anchor="middle">no mês</text></svg>`;
  const legend=items.map((it,i)=>`<button type="button" class="legend-item" ${it.other?"disabled":`data-cat="${esc(it.category)}"`}><i style="background:${CHART_COLORS[i%CHART_COLORS.length]}"></i><span>${esc(it.category)}</span><b>${pctText(it.value/total*100)}</b></button>`).join("");
  box.innerHTML=`<div class="donut-wrap">${svg}<div class="donut-legend">${legend}</div></div>`;
  box.querySelectorAll("[data-cat]").forEach(el=>el.onclick=()=>showCategoryDetail(el.dataset.cat));
}

// Barras de orçamento: quanto do limite mensal de cada categoria já foi usado (só o gasto que é realmente seu).
function renderBudgets(){
  const box=$("budgetList"); if(!box) return;
  const st=budgetStatus(month), over=st.filter(x=>x.level==="over").length, warn=st.filter(x=>x.level==="warn").length;
  $("budgetSummary").textContent=st.length?(over?`${over} estourado(s)`:warn?`${warn} em atenção`:"tudo dentro do limite"):"";
  $("budgetSummary").className=over?"negative":warn?"attention":"muted";
  box.innerHTML=st.length?st.map(x=>{
    const color=x.level==="over"?"var(--red)":x.level==="warn"?"var(--attn)":"var(--green)";
    const tag=x.level==="over"?'<span class="tag budget-tag over">Estourou</span>':x.level==="warn"?'<span class="tag budget-tag warn">Atenção</span>':"";
    return `<div class="bar-row bar-click" data-cat="${esc(x.category)}" title="Ver lançamentos"><div class="bar-label"><span>${esc(x.category)} ${tag}</span><b>${fmtMoney(x.spent)} de ${fmtMoney(x.limit)} (${Math.round(x.pct)}%)</b></div><div class="bar"><i style="width:${Math.min(100,x.pct)}%;background:${color}"></i></div></div>`;
  }).join(""):'<div class="empty">Nenhum orçamento definido. Na aba Regras, ao criar ou editar uma categoria, informe o "Limite mensal" para acompanhar aqui.</div>';
  box.querySelectorAll("[data-cat]").forEach(el=>el.onclick=()=>showCategoryDetail(el.dataset.cat));
}

;
/* ===== exportar.js ===== */
// ====================================================================
// exportar.js — relatórios: CSV (Excel/Planilhas) e impressão/PDF do Resumo
// ====================================================================

// Protege uma célula do CSV: se tiver ; " ou quebra de linha, coloca entre aspas.
function csvCell(v){ const s=String(v??""); return /[;"\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }

// Número com vírgula decimal (padrão do Excel em português): 1234.5 vira 1234,50.
function csvMoney(n){ return (Number(n)||0).toFixed(2).replace(".",","); }

// Monta o texto do CSV (separador ponto e vírgula) com uma linha por lançamento.
function buildCsv(transactions){
  const head=["Data","Tipo","Descrição","Categoria","Forma","Cartão","Pagamento previsto","Status","Valor total","Seu valor","A receber de outras pessoas","Parcela","Observação"];
  const rows=transactions.slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.createdAt||0)-(b.createdAt||0)).map(t=>{
    const card=t.cardId?(data.cards.find(c=>c.id===t.cardId)?.name||""):"";
    if(t.type==="expense") return [t.date,"Gasto",t.description,[...new Set((t.splits||[]).map(s=>s.category))].join(" / "),METHODS[t.method]||"",card,t.paymentDate||t.date,t.paymentStatus==="paid"?"Pago":"Previsto",csvMoney(t.value),csvMoney(ownAmount(t)),csvMoney(receivableAmount(t)),t.installments>1?`${t.installmentNo||1}/${t.installments}`:"",t.notes||""];
    if(t.type==="income") return [t.date,incomeOrigin(t)==="normal"?"Entrada":"Reembolso",t.description,"","","","","",csvMoney(t.value),"","","",t.notes||""];
    return [t.date,"Pagamento de cartão",t.description,"","",card,"","",csvMoney(t.value),"","","",t.notes||""];
  });
  return [head,...rows].map(r=>r.map(csvCell).join(";")).join("\r\n");
}

// Baixa um texto como arquivo (com BOM para o Excel entender os acentos).
function downloadText(name,text,type="text/csv;charset=utf-8"){
  const blob=new Blob(["\ufeff"+text],{type});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

// Exporta os lançamentos do mês visto (pela data da compra ou do pagamento) ou todos.
function exportCsv(scope){
  const list=scope==="all"?data.transactions:data.transactions.filter(t=>t.date.slice(0,7)===month||(t.type==="expense"&&(t.paymentDate||t.date).slice(0,7)===month));
  if(!list.length){toast("Nenhum lançamento para exportar.");return}
  downloadText(scope==="all"?`meu-controle-lancamentos-${today()}.csv`:`meu-controle-${month}.csv`,buildCsv(list));
  toast(`${list.length} lançamento(s) exportado(s)`);
}

// Abre a impressão do navegador (dá para "Salvar como PDF") com o Resumo do mês, com todos os blocos abertos.
let printOpened=[];
function printReport(){
  switchTab("dashboard");
  setTimeout(()=>window.print(),150);
}
window.addEventListener("beforeprint",()=>{ printOpened=[...document.querySelectorAll("#dashboard details:not([open])")]; printOpened.forEach(d=>d.open=true); });
window.addEventListener("afterprint",()=>{ printOpened.forEach(d=>d.open=false); printOpened=[]; });

;
