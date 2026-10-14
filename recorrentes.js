// ====================================================================
// recorrentes.js — lançamentos recorrentes (aluguel, assinaturas, salário...)
// Você cadastra o modelo uma vez (aba Regras) e o app cria o lançamento de cada mês sozinho,
// do mês inicial até o mês seguinte ao atual. Cada mês é gerado uma única vez: se você excluir um
// lançamento gerado, ele NÃO volta. Mudar o modelo vale para os meses que ainda não foram gerados.
// ====================================================================

// Até quantos meses à frente do mês atual o app já deixa os lançamentos criados (1 = mês seguinte, bom para planejar).
const RECURRING_HORIZON = 1;

// Meses (AAAA-MM) do modelo r que ainda precisam ser gerados, do mês inicial até upTo (ou até o mês final, se houver).
function recurringMonths(r,upTo){
  if(!r.active) return [];
  const end = (r.endMonth && r.endMonth<upTo) ? r.endMonth : upTo;
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
    paymentDate:credit?nextMonthPaymentDate(r.cardId,date):date,
    paymentStatus:(credit||date>now)?"planned":"paid",
    splits:[{id:uid(),category:r.category,amount:value,ownerId:"self",reimbursed:false}],
    installments:1,installmentNo:1
  };
}

// Cria os lançamentos que faltam de todos os modelos ativos. Devolve quantos criou (quem chama decide se precisa salvar).
function generateRecurring(now=today()){
  const upTo=shiftMonthStr(now.slice(0,7),RECURRING_HORIZON);
  let count=0, first=null;
  (data.recurring||[]).forEach(r=>{
    recurringMonths(r,upTo).forEach(m=>{
      const t=buildRecurringTransaction(r,m,now);
      t.createdAt+=count;   // mantém a ordem de criação
      data.transactions.push(t);
      (r.generated=r.generated||[]).push(m);
      count++; first=first||t;
    });
  });
  if(count) logActivity("create",`Recorrentes: ${count} lançamento(s) criado(s) automaticamente`,first?first.description+(count>1?" e outros":""):"",first?first.id:"");
  return count;
}

// Texto curto de "quando acontece", para a lista: "todo dia 5 · desde 10/2026 · até 12/2026".
function recurringWhen(r){
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

// Painel para criar ou editar um modelo recorrente.
function openRecurringModal(id=null){
  const r=id?data.recurring.find(x=>x.id===id):{type:"expense",description:"",value:"",day:Number(today().slice(8,10)),startMonth:today().slice(0,7),endMonth:"",method:"pix",cardId:data.cards[0]?.id||"",category:data.categories.includes("Contas")?"Contas":data.categories[0],active:true};
  if(!r) return;
  const methods=Object.entries(METHODS).filter(([k])=>k!=="installment");
  openModal(id?"Editar recorrente":"Novo lançamento recorrente",`<form id="recurringForm" class="form-grid">
    <div><label>Tipo</label><select name="type" id="recType"><option value="expense" ${r.type==="expense"?"selected":""}>Gasto</option><option value="income" ${r.type==="income"?"selected":""}>Entrada</option></select></div>
    <div><label>Valor</label><input name="value" type="number" min="0.01" step="0.01" value="${esc(r.value)}" required></div>
    <div class="full"><label>Descrição</label><input name="description" value="${esc(r.description)}" placeholder="Ex.: Aluguel, Netflix, Salário" required></div>
    <div><label>Dia do mês</label><input name="day" type="number" min="1" max="31" value="${esc(r.day)}" required></div>
    <div><label>Começa em</label><input name="startMonth" type="month" value="${esc(r.startMonth)}" required></div>
    <div><label>Termina em (opcional)</label><input name="endMonth" type="month" value="${esc(r.endMonth||"")}"></div>
    <div class="rec-exp"><label>Categoria</label><select name="category">${data.categories.map(c=>`<option ${c===r.category?"selected":""}>${esc(c)}</option>`).join("")}</select></div>
    <div class="rec-exp"><label>Forma de pagamento</label><select name="method" id="recMethod">${methods.map(([k,v])=>`<option value="${k}" ${k===r.method?"selected":""}>${v}</option>`).join("")}</select></div>
    <div class="rec-card"><label>Cartão</label><select name="cardId">${data.cards.map(c=>`<option value="${esc(c.id)}" ${c.id===r.cardId?"selected":""}>${esc(c.name)}</option>`).join("")}</select></div>
    <div class="full field-note">O app cria o lançamento de cada mês sozinho, até o mês seguinte. Se você excluir um já criado, ele não volta. Mudanças valem para os meses ainda não criados.</div>
    <div class="full row-actions end"><button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary">Salvar</button></div>
  </form>`);
  const sync=()=>{
    const exp=$("recType").value==="expense", credit=exp&&$("recMethod").value==="credit";
    document.querySelectorAll("#recurringForm .rec-exp").forEach(e=>e.classList.toggle("hidden",!exp));
    document.querySelectorAll("#recurringForm .rec-card").forEach(e=>e.classList.toggle("hidden",!credit));
  };
  $("recType").onchange=sync;$("recMethod").onchange=sync;sync();
  $("recurringForm").onsubmit=e=>{
    e.preventDefault();
    const f=new FormData(e.target), type=f.get("type"), method=f.get("method")||"pix";
    const item={type,description:f.get("description").trim(),value:Math.round(Number(f.get("value"))*100)/100,day:Math.min(31,Math.max(1,Math.round(Number(f.get("day"))||1))),startMonth:f.get("startMonth"),endMonth:f.get("endMonth")||"",method:type==="expense"?method:"",cardId:type==="expense"&&isCreditMethod(method)?f.get("cardId"):"",category:type==="expense"?f.get("category"):""};
    if(!item.description){askAlert("Informe a descrição.");return}
    if(!(item.value>0)){askAlert("Informe um valor maior que zero.");return}
    if(!item.startMonth){askAlert("Informe o mês em que começa.");return}
    if(item.endMonth&&item.endMonth<item.startMonth){askAlert("O mês final não pode ser antes do mês inicial.");return}
    if(type==="expense"&&isCreditMethod(method)&&!item.cardId){askAlert("Cadastre ou selecione um cartão.");return}
    if(id){ Object.assign(data.recurring.find(x=>x.id===id),item); }
    else data.recurring.push({id:uid(),...item,active:true,generated:[],createdAt:Date.now()});
    const n=generateRecurring();
    closeModal();save();
    toast(n?`Recorrente salvo · ${n} lançamento(s) criado(s)`:"Recorrente salvo");
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
