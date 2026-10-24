/* ===== transaction-form.js ===== */
// ====================================================================
// transaction-form.js — formulário de gasto/entrada
// Formulário com divisão por pessoa, salvar/editar/excluir lançamento, desfazer e reembolsos. Parcelas = "Repetir esta despesa mensalmente".
// ====================================================================

// "Para onde foi" um gasto: categorias, forma/cartão, pagamento previsto e pessoas envolvidas
function expenseDestination(t){
  const cats=[...new Set((t.splits||[]).map(s=>s.category))].join(", ");
  const others=[...new Set((t.splits||[]).filter(s=>s.ownerId!=="self").map(s=>data.people.find(p=>p.id===s.ownerId)?.name||"outra pessoa"))];
  const way=t.cardId?(data.cards.find(c=>c.id===t.cardId)?.name||"Cartão"):(METHODS[t.method]||"Pix / débito / dinheiro");
  const parts=[`Categoria: ${cats||"—"}`,`Forma: ${way}`,`Pagamento ${t.paymentStatus==="paid"?"feito":"previsto"} em ${fmtDate(t.paymentDate||t.date)}`];
  if(others.length) parts.push(`Com: ${others.join(", ")}`);
  return parts.join(" · ");
}

// Data sugerida num lançamento novo: hoje, ou o dia 1 do mês visto se não for o mês atual.
function defaultEntryDate(){ return today().slice(0,7)===month ? today() : `${month}-01`; }   // abre o calendário no mês que está sendo visto

// Divisão padrão de um gasto novo: tudo para "Você", com a categoria sugerida pelas regras.
function makeDefaultSplit(amount, description, existing){
  return existing || [{id:uid(),category:applyRule(description),amount:Number(amount)||0,ownerId:"self",reimbursed:false}];
}

// Monta o HTML do formulário de gasto ou entrada (novo ou edição).
function transactionForm(t=null,type="expense"){
  const isExpense=type==="expense";
  const splits=(t?.splits?.length?t.splits:makeDefaultSplit(t?.value||0,t?.description||"")).map(s=>({...s}));
  const method=t?.method||"pix";
  const status=t?.paymentStatus||(isCreditMethod(method)?"planned":"paid");
  const lock=t?'data-lock="1" disabled':"";
  return `<form id="txForm"><div class="form-grid">
    <div><label>Data da compra / lançamento</label><input name="date" id="txDate" type="date" value="${t?.date||defaultEntryDate()}" required></div>
    <div><label>${t?.installments>1?"Valor desta parcela":"Valor total"}</label><input name="value" id="txValue" type="number" min="0" step="0.01" value="${t?.value??""}" required></div>
    <div class="full"><label>Descrição</label><input name="description" id="txDescription" value="${esc(t?.description||"")}" placeholder="Ex.: Mercado, Uber, conta de luz..." required></div>
    ${isExpense?`
      <div><label>Forma de pagamento</label><select name="method" id="txMethod">${Object.entries(METHODS).map(([k,v])=>`<option value="${k}" ${k===method?"selected":""}>${v}</option>`).join("")}</select></div>
      <div id="grpCard"><label>Cartão</label><select name="cardId" id="txCard"><option value="">Selecione o cartão</option>${data.cards.map(c=>`<option value="${c.id}" ${t?.cardId===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select></div>
      <div id="grpStatus"><label>Status do pagamento</label><select name="paymentStatus" id="txStatus"><option value="planned" ${status!=="paid"?"selected":""}>Previsto / ainda não pago</option><option value="paid" ${status==="paid"?"selected":""}>Já pago</option></select><div class="field-note">Pix, débito e dinheiro começam como "Já pago"; mude para "Previsto" se for uma despesa futura.</div></div>
    `:`
      <div><label>Origem</label><select name="incomeSource"><option value="normal" ${t?.source!=="reimbursement"?"selected":""}>Entrada normal</option><option value="reimbursement" ${t?.source==="reimbursement"?"selected":""}>Reembolso recebido</option></select></div>
    `}</div>
    ${!t?.recurringId?`<div class="full recurring-card-wrap" id="grpRecurring">
      <label class="recurring-card" for="txRecurring"><input type="checkbox" id="txRecurring" name="recurring"><span><b>Repetir esta ${isExpense?"despesa":"entrada"} mensalmente</b><small>${isExpense?"Registra suas parcelas e cria um lançamento por mês durante o período escolhido.":"Cria um lançamento por mês durante o período escolhido."}</small></span></label>
      <div class="form-grid recurring-dates hidden" id="recurringDates">
        <div><label>Todo dia</label><input name="recurringDay" id="recurringDay" type="number" min="1" max="31" step="1" value="${Number((t?.date||defaultEntryDate()).slice(8,10))}"><div class="field-note">Dia do mês em que acontece.</div></div>
        <div><label>A partir de</label><input name="recurringStartDate" id="recurringStartDate" type="date" value="${t?.date||defaultEntryDate()}"></div>
        <div><label>Até (opcional)</label><input name="recurringEndDate" id="recurringEndDate" type="date"><div class="field-note">Deixe vazio para manter a recorrência em até 6 meses.</div></div>
      </div>
    </div>`:`<div class="field-note full">Este lançamento foi criado por uma recorrência. Para mudar os próximos meses, edite o recorrente na aba Regras.</div>`}
    ${isExpense?`<div class="split-header"><div><b>Divisão do gasto por pessoa</b><div class="field-note">O valor total fica com Você. Ao adicionar pessoas, o app divide o valor sozinho; se você mudar o valor de uma pessoa, o restante é recalculado entre as outras.</div></div><div class="split-actions"><button type="button" class="btn" id="addSplit">Adicionar pessoas</button></div></div><div id="splitList">${splits.map((s,i)=>splitRow(s,i,data.categories,data.people)).join("")}</div><div class="split-total"><span>Total dividido</span><span id="splitSum">${fmtMoney(splits.reduce((a,x)=>a+Number(x.amount||0),0))}</span></div><div class="field-note" id="splitHint"></div>`:""}
    <div class="row-actions end" style="margin-top:15px"><button type="button" class="btn ghost" id="cancelTx">Cancelar</button><button class="btn primary">Salvar</button></div>
  </form>`;
}

// HTML da coluna "Status" de uma linha da divisão: "Não gera reembolso" para Você, ou A receber / Já recebi para outra pessoa.
function splitStatusCell(ownerId,reimbursed){
  return `<div class="fld-head"><label>Status</label></div>${ownerId==="self"?`<div class="field-note">Não gera reembolso</div>`:`<select class="split-status" aria-label="Status do reembolso"><option value="pending" ${reimbursed!==true?"selected":""}>A receber</option><option value="received" ${reimbursed===true?"selected":""}>Já recebi</option></select>`}`;
}

// HTML de uma linha da divisão do gasto (categoria, valor, quem paga e status).
// Todo campo tem um cabeçalho (.fld-head) de mesma altura; Categoria e Quem paga? ganham o atalho de criar na hora (.mini-create ocupa o lugar do select).
function splitRow(s,i,categories,people){
  return `<div class="split" data-index="${i}">
    <div class="category"><div class="fld-head"><label>Categoria</label><button type="button" class="mini-link new-cat">+ Criar categoria</button></div><div class="mini-create hidden"><input class="mini-input" type="text" maxlength="40" placeholder="Nome da categoria" aria-label="Nome da nova categoria"><button type="button" class="btn primary mini-ok" title="Salvar">✓</button><button type="button" class="btn mini-cancel" title="Cancelar">✕</button></div><select class="split-category" aria-label="Categoria">${categoriesOutrosLast(categories).map(c=>`<option ${c===s.category?"selected":""}>${esc(c)}</option>`).join("")}</select></div>
    <div><div class="fld-head"><label>Valor</label></div><input class="split-amount" aria-label="Valor desta parte" type="number" min="0" step="0.01" value="${Number(s.amount||0)}"></div>
    <div class="owner"><div class="fld-head"><label>Quem paga?</label><button type="button" class="mini-link new-person">+ Criar pessoa</button></div><div class="mini-create hidden"><input class="mini-input" type="text" maxlength="40" placeholder="Nome da pessoa" aria-label="Nome da nova pessoa"><button type="button" class="btn primary mini-ok" title="Salvar">✓</button><button type="button" class="btn mini-cancel" title="Cancelar">✕</button></div><select class="split-owner" aria-label="Quem paga">${people.map(p=>`<option value="${p.id}" ${s.ownerId===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select></div>
    <div class="person">${splitStatusCell(s.ownerId,s.reimbursed)}</div>
    <button type="button" class="btn ghost remove-split" title="Remover">✕</button>
  </div>`;
}

// Divisão automática: as linhas que você não mexeu (sem data-manual) dividem igualmente o que sobra do valor total.
// Ao mudar o valor total só elas se ajustam; se todas foram ajustadas à mão, todas mudam na mesma proporção.
function recalcSplits(){
  const rows=[...document.querySelectorAll("#splitList .split")]; if(!rows.length)return;
  const total=Math.round(Number($("txValue").value||0)*100);
  const amt=r=>Math.round(Number(r.querySelector(".split-amount").value||0)*100);
  const setAmt=(r,c)=>{r.querySelector(".split-amount").value=(c/100).toFixed(2)};
  const free=rows.filter(r=>!r.dataset.manual), locked=rows.filter(r=>r.dataset.manual);
  if(free.length){
    const rest=Math.max(0,total-locked.reduce((n,r)=>n+amt(r),0)), each=Math.floor(rest/free.length);
    free.forEach((r,i)=>setAmt(r,i===free.length-1?rest-each*(free.length-1):each));   // a última leva o centavo que sobrar
  }else{
    const sum=rows.reduce((n,r)=>n+amt(r),0); let acc=0;
    rows.forEach((r,i)=>{const c=i===rows.length-1?total-acc:(sum?Math.round(amt(r)*total/sum):Math.floor(total/rows.length));acc+=c;setAmt(r,c)});
  }
  updateSplitTotal();
}

// Volta tudo para a divisão igual entre as pessoas (ao adicionar ou remover alguém).
function distributeEqual(){ document.querySelectorAll("#splitList .split").forEach(r=>delete r.dataset.manual); recalcSplits(); }

// Abre o formulário de gasto/entrada e liga os comportamentos automáticos (cartão, status, divisão). Recorrência ao fim de cada bloco.
function syncRecurringDateFields(){
  if(!$("txRecurring"))return;
  const enabled=$("txRecurring").checked;
  $("recurringDates").classList.toggle("hidden",!enabled);
  $("recurringStartDate").required=enabled;
  $("recurringDay").required=enabled;
}

// Lê e valida os campos de recorrência do formulário. Devolve {startDate,endDate,day} ou null (já avisou o usuário).
function readRecurringFields(f){
  const startDate=f.get("recurringStartDate"),endDate=f.get("recurringEndDate")||"",day=Math.round(Number(f.get("recurringDay"))||0);
  if(!startDate){askAlert("Informe a data inicial da recorrência.");return null}
  if(endDate&&endDate<startDate){askAlert("A data final não pode ser antes da data inicial.");return null}
  if(!(day>=1&&day<=31)){askAlert("Informe o dia do mês da recorrência (de 1 a 31).");return null}
  return {startDate,endDate,day};
}

// Monta o modelo recorrente a partir dos campos validados (extra = campos próprios de gasto).
function buildRecurringModel(type,rec,base,extra={}){
  return {id:uid(),type,description:base.description,value:base.value,day:rec.day,startMonth:rec.startDate.slice(0,7),endMonth:rec.endDate?rec.endDate.slice(0,7):"",startDate:rec.startDate,endDate:rec.endDate,...extra,active:true,generated:[],createdAt:Date.now()};
}

function openTransactionModal(type="expense",tx=null){
  openModal(tx?(type==="expense"?"Editar gasto":"Editar entrada"):(type==="expense"?"Novo gasto":"Nova entrada"),transactionForm(tx,type));
  let recurringStartTouched=false;
  // Gasto: liga os comportamentos automáticos do formulário (forma de pagamento, status e divisão)
  if(type==="expense"){
    const list=$("splitList");
    statusTouched=!!tx;
    // show(): mostra ou esconde um grupo de campos (e desativa os inputs dele quando escondido)
    const show=(id,on)=>{const g=$(id);g.classList.toggle("hidden",!on);g.querySelectorAll("input,select").forEach(i=>{i.disabled=!on||i.dataset.lock==="1"})};
    // refreshMethod(): ao trocar a forma de pagamento, mostra/esconde o cartão e ajusta o status padrão.
    // Crédito não pede data de vencimento: o app calcula pelo fechamento do cartão ao salvar.
    const refreshMethod=()=>{
      const credit=isCreditMethod($("txMethod").value);
      show("grpCard",credit);   // Pix/Dinheiro/Débito: o cartão some (não é validado); o status continua editável
      if(!statusTouched)$("txStatus").value=credit?"planned":"paid";   // padrão automático, mas o usuário pode mudar
      if(credit&&!$("txCard").value&&data.cards.length===1)$("txCard").value=data.cards[0].id;
    };
    // addPerson(): adiciona uma pessoa à divisão do gasto e redistribui o valor
    const addPerson=()=>{
      const rows=[...list.querySelectorAll(".split")],used=new Set(rows.map(r=>r.querySelector(".split-owner").value));
      const cand=data.people.find(p=>!used.has(p.id))||data.people.find(p=>p.id!=="self")||data.people[0];
      const cat=rows[0]?.querySelector(".split-category").value||"Outros";
      list.insertAdjacentHTML("beforeend",splitRow({id:uid(),category:cat,amount:0,ownerId:cand.id,reimbursed:false},rows.length,data.categories,data.people));
      bindSplitRow(list.lastElementChild);
      distributeEqual();   // recalcula o valor entre todas as pessoas
      if(data.people.length<2)toast("Use \"Criar pessoa\" (acima de Quem paga?) para cadastrar quem divide o gasto.");
    };
    // Ligações dos botões e campos do formulário (cada alteração recalcula a divisão)
    $("addSplit").onclick=addPerson;
    [...list.children].forEach(bindSplitRow);
    $("txMethod").addEventListener("change",refreshMethod);
    $("txStatus").addEventListener("change",()=>{statusTouched=true});
    $("txValue").addEventListener("input",recalcSplits);
    $("txDescription").addEventListener("input",e=>{if(!tx){const first=$("splitList").querySelector(".split-category");if(first&&first.value==="Outros")first.value=applyRule(e.target.value)}});
    if(tx){   // edição: se as partes não eram iguais, ficam como "ajustadas à mão" (mudar o valor total mantém a proporção)
      const amts=[...list.querySelectorAll(".split-amount")].map(i=>Number(i.value));
      if(!amts.every(v=>Math.abs(v-amts[0])<0.02)) list.querySelectorAll(".split").forEach(r=>{r.dataset.manual="1"});
    }else distributeEqual();
    refreshMethod();updateSplitTotal();
  }
  if($("txRecurring")){
    let recurringDayTouched=false;
    const dayOf=iso=>Number((iso||"").slice(8,10))||1;
    $("txRecurring").addEventListener("change",syncRecurringDateFields);
    $("txDate").addEventListener("change",()=>{   // enquanto você não mexer nos campos da recorrência, eles acompanham a data do lançamento
      if(!recurringStartTouched)$("recurringStartDate").value=$("txDate").value;
      if(!recurringDayTouched)$("recurringDay").value=dayOf($("txDate").value);
    });
    $("recurringStartDate").addEventListener("input",()=>{recurringStartTouched=true;if(!recurringDayTouched)$("recurringDay").value=dayOf($("recurringStartDate").value)});
    $("recurringDay").addEventListener("input",()=>{recurringDayTouched=true});
  }
  // Cancelar fecha o painel; enviar o formulário salva como gasto ou como entrada
  $("cancelTx").onclick=closeModal;
  $("txForm").onsubmit=e=>{e.preventDefault();type==="expense"?saveExpenseFromForm(tx?.id||null):saveIncomeFromForm(tx?.id||null)};
}

// Liga os botões e campos de uma linha da divisão (remover, editar valor, trocar pessoa).
function bindSplitRow(row){
  row.querySelector(".remove-split").onclick=()=>{
    if(document.querySelectorAll("#splitList .split").length<=1){askAlert("O gasto precisa ter pelo menos uma parte.");return}
    row.remove();distributeEqual();
  };
  row.querySelector(".split-amount").addEventListener("input",updateSplitTotal);   // enquanto digita: só mostra o total
  row.querySelector(".split-amount").addEventListener("change",()=>{row.dataset.manual="1";recalcSplits()});   // ao terminar: esta pessoa fica fixa e as outras dividem o resto
  row.querySelector(".split-owner").addEventListener("change",updateSplitStatus);
  bindInlineCreate(row.querySelector(".category"),".new-cat",".split-category",createCategoryInline);   // "+ Criar categoria"
  bindInlineCreate(row.querySelector(".owner"),".new-person",".split-owner",createPersonInline);       // "+ Criar pessoa"
}

// Liga o "criar na hora" de uma coluna: o link troca o select por uma caixinha de nome (✓ salva, ✕ ou Esc cancela, Enter salva).
function bindInlineCreate(box,linkSel,selectSel,creator){
  const link=box.querySelector(linkSel),mini=box.querySelector(".mini-create"),input=mini.querySelector(".mini-input"),sel=box.querySelector(selectSel);
  const open=on=>{mini.classList.toggle("hidden",!on);sel.classList.toggle("hidden",on);link.classList.toggle("hidden",on);if(on){input.value="";input.focus()}};
  const ok=()=>{if(creator(input.value.trim(),sel))open(false)};
  link.onclick=()=>open(true);
  mini.querySelector(".mini-cancel").onclick=()=>open(false);
  mini.querySelector(".mini-ok").onclick=ok;
  input.addEventListener("keydown",e=>{
    if(e.key==="Enter"){e.preventDefault();ok()}                       // Enter salva (sem enviar o formulário do gasto)
    else if(e.key==="Escape"){e.preventDefault();e.stopPropagation();open(false)}   // Esc cancela só a caixinha (não fecha o painel)
  });
}

// Cria uma categoria sem sair do formulário: salva, coloca em todas as linhas da divisão e seleciona na linha atual. Devolve true se deu certo.
function createCategoryInline(name,sel){
  if(!name){toast("Digite o nome da categoria.");return false}
  const found=data.categories.find(c=>c.toLowerCase()===name.toLowerCase());
  const finalName=found||name;
  if(!found){data.categories.push(name);save()}   // save() redesenha as abas de trás; o formulário aberto não é afetado
  document.querySelectorAll("#splitList .split-category").forEach(s=>{
    if(![...s.options].some(o=>o.value===finalName)){const o=document.createElement("option");o.value=o.textContent=finalName;const outros=[...s.options].find(x=>x.value==="Outros");s.insertBefore(o,outros||null)}   // "Outros" continua por último
  });
  sel.value=finalName;
  toast(found?"Essa categoria já existia: selecionada.":"Categoria criada");
  return true;
}

// Cria uma pessoa sem sair do formulário: salva, coloca em todas as linhas da divisão e seleciona na linha atual. Devolve true se deu certo.
function createPersonInline(name,sel){
  if(!name){toast("Digite o nome da pessoa.");return false}
  let p=data.people.find(x=>x.name.toLowerCase()===name.toLowerCase());
  const existed=!!p;
  if(!p){p={id:uid(),name};data.people.push(p);save()}
  document.querySelectorAll("#splitList .split-owner").forEach(s=>{
    if(![...s.options].some(o=>o.value===p.id)){const o=document.createElement("option");o.value=p.id;o.textContent=p.name;s.appendChild(o)}
  });
  sel.value=p.id;
  sel.dispatchEvent(new Event("change"));   // atualiza o Status (A receber / Já recebi) da linha
  toast(existed?"Essa pessoa já existia: selecionada.":"Pessoa criada");
  return true;
}

// Mostra ou esconde o status "A receber / Já recebi" conforme quem paga a parte.
function updateSplitStatus(e){const row=e.target.closest(".split"),owner=e.target.value,person=row.querySelector(".person");person.innerHTML=splitStatusCell(owner,false)}

// Atualiza o total dividido e avisa se a soma das partes difere do valor total.
function updateSplitTotal(){if(!$("splitList"))return;const total=[...document.querySelectorAll(".split-amount")].reduce((s,i)=>s+Number(i.value||0),0),target=Number($("txValue")?.value||0);$("splitSum").textContent=fmtMoney(total);const diff=target-total;$("splitHint").textContent=Math.abs(diff)<0.005?"Divisão correta.":`Diferença: ${fmtMoney(Math.abs(diff))} ${diff>0?"a distribuir":"a mais"}.`;$("splitHint").style.color=Math.abs(diff)<0.005?"var(--green)":"var(--red)"}

// Lê as linhas da divisão do formulário e devolve a lista de partes.
function collectSplits(){return [...document.querySelectorAll("#splitList .split")].map(row=>({id:uid(),category:row.querySelector(".split-category").value,amount:Number(row.querySelector(".split-amount").value||0),ownerId:row.querySelector(".split-owner").value,reimbursed:row.querySelector(".split-owner").value==="self"?false:row.querySelector(".split-status")?.value==="received"}));}

// Valida e salva o gasto do formulário (novo, edição ou recorrente).
function saveExpenseFromForm(existingId){
  const f=new FormData($("txForm")),value=Number(f.get("value")||0),splits=collectSplits(),sum=splits.reduce((s,x)=>s+x.amount,0);
  const method=f.get("method")||"pix",credit=isCreditMethod(method),date=f.get("date");
  const wantsRecurring=$("txRecurring")?.checked;   // vale também ao editar: o lançamento vira o primeiro da recorrência
  if(!value){askAlert("Informe um valor.");return}
  if(Math.abs(sum-value)>0.005){askAlert("A soma das partes precisa ser exatamente igual ao valor total.");return}
  if(credit&&!f.get("cardId")){askAlert("Selecione o cartão.");return}
  let rec=null;
  if(wantsRecurring){
    rec=readRecurringFields(f); if(!rec)return;
    if(splits.length!==1||splits[0].ownerId!=="self"||Math.abs(splits[0].amount-value)>0.005){askAlert("Para repetir, o gasto precisa ter uma única divisão atribuída a Você.");return}
  }
  // Vencimento do crédito: calculado pelo fechamento do cartão. Na edição, se a data da compra e o cartão não mudaram, mantém o vencimento já gravado.
  let paymentDate=date;
  if(credit){
    const old=existingId?data.transactions.find(t=>t.id===existingId):null;
    paymentDate=(old&&old.cardId===f.get("cardId")&&old.date===date&&old.paymentDate)?old.paymentDate:nextCardPaymentDate(f.get("cardId"),date);
  }
  // Pix/Débito/Dinheiro: o campo de cartão fica de fora; pagamento = data da compra
  const base={date,description:f.get("description"),value,method,cardId:credit?f.get("cardId"):"",paymentDate,paymentStatus:f.get("paymentStatus")||(credit?"planned":"paid"),type:"expense",splits};   // sem "notes": o formulário não tem mais Observação (a antiga é preservada na edição)
  const recExtra={method:base.method,cardId:base.cardId,category:splits[0].category};
  if(existingId){
    const old=data.transactions.find(t=>t.id===existingId);
    const updated={...old,...base};
    let model=null;
    if(rec){   // editar + repetir: este lançamento é o primeiro da recorrência (o mês dele não é criado de novo)
      model=buildRecurringModel("expense",rec,base,recExtra); model.generated=[date.slice(0,7)]; updated.recurringId=model.id;
      (data.recurring=data.recurring||[]).push(model);
    }
    data.transactions=data.transactions.map(t=>t.id===existingId?updated:t);
    logActivity("edit",`Gasto editado: ${base.description}`,`${fmtMoney(base.value)} · ${expenseDestination(updated)}`,existingId,{changes:[{before:structuredClone(old),after:structuredClone(updated)}]});
    const count=model?generateRecurring():0;
    toast(model?(count?`Gasto atualizado · recorrência salva · ${count} lançamento(s) criado(s)`:"Gasto atualizado · recorrência salva"):"Gasto atualizado");
  }else if(rec){
    (data.recurring=data.recurring||[]).push(buildRecurringModel("expense",rec,base,recExtra));
    const count=generateRecurring();
    logActivity("create",`Gasto recorrente: ${base.description}`,`${fmtMoney(value)} · todo dia ${rec.day} · de ${fmtDate(rec.startDate)} ${rec.endDate?`até ${fmtDate(rec.endDate)}`:"em diante"}`);
    toast(count?`Recorrência salva · ${count} lançamento(s) criado(s)`:"Recorrência salva");
  }else{
    const nt={...base,id:uid(),createdAt:Date.now(),installments:1,installmentNo:1};
    data.transactions.push(nt);
    logActivity("create",`Novo gasto: ${base.description}`,`${fmtMoney(value)} · ${expenseDestination(nt)}`,nt.id,{changes:[{before:null,after:structuredClone(nt)}]});
    toast("Gasto salvo");
  }
  closeModal();save();
}

// Valida e salva a entrada do formulário (nova ou edição).
function saveIncomeFromForm(existingId){
  const f=new FormData($("txForm")),value=Number(f.get("value")||0);
  const wantsRecurring=$("txRecurring")?.checked;   // vale também ao editar: o lançamento vira o primeiro da recorrência
  if(!value){askAlert("Informe um valor.");return}
  let rec=null;
  if(wantsRecurring){
    rec=readRecurringFields(f); if(!rec)return;
    if(f.get("incomeSource")==="reimbursement"){askAlert("Reembolsos não podem ser registrados como entradas recorrentes.");return}
  }
  const base={date:f.get("date"),description:f.get("description"),value,type:"income",source:f.get("incomeSource")||"normal"};   // sem "notes": a observação antiga é preservada na edição
  const where=`${base.source==="reimbursement"?"Reembolso recebido":"Entrada normal"} · entra em ${fmtDate(base.date)} (${fmtMonthLabel(base.date)})`;
  if(existingId){
    const old=data.transactions.find(t=>t.id===existingId);
    const updated={...old,...base};
    let model=null;
    if(rec){
      model=buildRecurringModel("income",rec,base); model.generated=[base.date.slice(0,7)]; updated.recurringId=model.id;
      (data.recurring=data.recurring||[]).push(model);
    }
    data.transactions=data.transactions.map(t=>t.id===existingId?updated:t);
    logActivity("edit",`Entrada editada: ${base.description}`,`${fmtMoney(value)} · ${where}`,existingId,{changes:[{before:structuredClone(old),after:structuredClone(updated)}]});
    const count=model?generateRecurring():0;
    toast(model?(count?`Entrada atualizada · recorrência salva · ${count} lançamento(s) criado(s)`:"Entrada atualizada · recorrência salva"):"Entrada atualizada");
  }else if(rec){
    (data.recurring=data.recurring||[]).push(buildRecurringModel("income",rec,base));
    const count=generateRecurring();
    logActivity("create",`Entrada recorrente: ${base.description}`,`${fmtMoney(value)} · todo dia ${rec.day} · de ${fmtDate(rec.startDate)} ${rec.endDate?`até ${fmtDate(rec.endDate)}`:"em diante"}`);
    toast(count?`Recorrência salva · ${count} lançamento(s) criado(s)`:"Recorrência salva");
  }else{
    const nt={...base,id:uid(),createdAt:Date.now()};
    data.transactions.push(nt);
    logActivity("create",`Nova entrada: ${base.description}`,`${fmtMoney(value)} · ${where}`,nt.id,{changes:[{before:null,after:structuredClone(nt)}]});
    toast("Entrada registrada");
  }
  closeModal();save();
}

// Abre o formulário para editar um lançamento.
function editTransaction(id){
  const t=data.transactions.find(x=>x.id===id);if(!t)return;
  if(t.type==="expense")openTransactionModal("expense",t);
  else if(t.type==="income")openTransactionModal("income",t);
  else askAlert("Pagamento de cartão importado é um ajuste da fatura e, nesta versão, deve ser excluído/reimportado se necessário.");
}

// Exclui um lançamento (com confirmação e opção de desfazer).
async function removeTransaction(id){
  const t=data.transactions.find(x=>x.id===id); if(!t)return;
  if(!(await askConfirm(`"${t.description}" · ${fmtMoney(t.value)}. Logo depois você poderá desfazer.`,{title:"Excluir este lançamento?",okText:"Excluir",danger:true})))return;
  data.transactions=data.transactions.filter(x=>x.id!==id);
  logActivity("delete",`Excluído: ${t.description}`,`${t.type==="income"?"Entrada":t.type==="expense"?"Gasto":"Pagamento de cartão"} de ${fmtMoney(t.value)} · data ${fmtDate(t.date)}`,id,{changes:[{before:structuredClone(t),after:null}]});
  lastDeleted=[t];
  save();
  showToast("Lançamento excluído","Desfazer",undoDelete);
}

// Desfaz a última exclusão (de um ou de vários lançamentos).
function undoDelete(){
  if(!lastDeleted||!lastDeleted.length)return;
  const back=lastDeleted;
  back.forEach(t=>data.transactions.push(t));
  logActivity("create",back.length>1?`Exclusão desfeita: ${back.length} lançamentos`:`Exclusão desfeita: ${back[0].description}`,back.length>1?back.slice(0,3).map(t=>t.description).join(", ")+(back.length>3?"…":""):fmtMoney(back[0].value),back.length===1?back[0].id:"");
  lastDeleted=null;
  save();
  toast("Exclusão desfeita");
}

// Marca uma parte como reembolsada e cria automaticamente uma entrada com o valor recebido.
function markReimbursement(txId,splitIndex){
  const t=data.transactions.find(x=>x.id===txId);if(!t)return;
  const s=t.splits?.[splitIndex];if(!s||s.ownerId==="self")return;
  if(s.reimbursed)return;
  const beforeExpense=structuredClone(t);
  s.reimbursed=true;
  const p=data.people.find(x=>x.id===s.ownerId);
  const isLoan=s.category===LOAN_CATEGORY;
  const inc={id:uid(),createdAt:Date.now(),date:today(),description:`${isLoan?"Empréstimo devolvido":"Reembolso"}: ${t.description}`,value:Number(s.amount),type:"income",source:"reimbursement",sourceCategory:s.category,notes:`Recebido de ${p?.name||"outra pessoa"}`,linkedTransactionId:txId,linkedSplitId:s.id};
  data.transactions.push(inc);
  logActivity("received",`${isLoan?"Empréstimo devolvido":"Reembolso recebido"} de ${p?.name||"outra pessoa"}: ${fmtMoney(s.amount)}`,`Referente a "${t.description}" (${s.category}) · entrou como entrada em ${fmtDate(inc.date)}`,inc.id,{changes:[{before:beforeExpense,after:structuredClone(t)},{before:null,after:structuredClone(inc)}]});
  save();toast("Reembolso registrado");
}

;
