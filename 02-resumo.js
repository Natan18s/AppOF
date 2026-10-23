/* ===== ui.js ===== */
// ====================================================================
// ui.js — peças comuns da interface
// Aviso rápido (toast), painel (modal), troca de aba, mês visto e redesenho geral.
// ====================================================================

// Mostra o aviso rápido no canto da tela, com um botão de ação opcional (ex.: Desfazer).
function showToast(msg,actionLabel,actionFn){
  const t=$("toast");
  t.innerHTML = actionLabel ? `<span>${esc(msg)}</span><button type="button" class="toast-action">${esc(actionLabel)}</button>` : esc(msg);
  if(actionLabel){ t.querySelector(".toast-action").onclick=()=>{actionFn();t.classList.remove("show")} }
  t.classList.add("show");
  clearTimeout(showToast._h);
  showToast._h=setTimeout(()=>t.classList.remove("show"),actionLabel?6000:2200);
}

// Aviso rápido simples, sem botão.
const toast = msg => showToast(msg);

// ----- Botão "voltar" do celular -----
// Cada aba aberta e cada painel aberto ganham uma entrada no histórico do navegador. Assim o botão voltar fecha o painel
// ou volta para a aba anterior, em vez de sair do site (o tratamento do evento "popstate" fica em main.js).
let currentTab="dashboard";   // aba que está aberta
let modalHistory=false;       // true quando o painel aberto tem uma entrada própria no histórico
let ignorePop=0;              // quantos eventos "popstate" causados pelo próprio app devem ser ignorados

// Troca de aba: mostra a seção escolhida e esconde as outras. fromHistory=true quando veio do botão voltar (não cria entrada nova).
function switchTab(tab,fromHistory){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("hidden",p.id!==tab));
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  if(tab==="transactions") renderTransactions();
  if(tab==="rules") renderCategories();   // Categorias agora ficam dentro da aba Regras
  if(fromHistory!==true){
    if(modalHistory){ history.replaceState({tab},""); modalHistory=false; }   // o painel foi fechado por navegação: a entrada dele vira a da nova aba
    else if(tab!==currentTab) history.pushState({tab},"");
  }
  currentTab=tab;
  window.scrollTo(0,0);
}

// Muda o mês visto e sincroniza os três seletores de mês (Resumo, Lançamentos e Cartões).
function setMonth(m){ if(!m)return; month=m; ["dashboardMonth","txMonth","cardsMonth"].forEach(id=>{$(id).value=m}); renderAll(); }

// Redesenha todas as abas. Chamada por save() depois de qualquer mudança.
function renderAll(){ renderDashboard(); renderCharts(); renderTransactions(); renderCards(); renderPeople(); renderCategories(); renderRecurring(); renderRules(); renderImportCardOptions(); renderDemoBanner(); renderWelcome(); }

// Vai para a aba Lançamentos e destaca a linha do lançamento
function goToTransaction(id){
  const t=data.transactions.find(x=>x.id===id);
  if(!t){toast("Esse lançamento não existe mais.");return}
  closeModal("keep");   // fecha o painel sem mexer no histórico (switchTab ajusta)
  $("txSearch").value="";$("txType").value="";
  const inView=t.date.slice(0,7)===month||(t.type==="expense"&&(t.paymentDate||t.date).slice(0,7)===month);
  if(!inView) setMonth(t.date.slice(0,7));
  switchTab("transactions");
  renderTransactions();
  const row=$("tx-"+id);
  if(row){row.scrollIntoView({block:"center",behavior:"smooth"});row.classList.add("row-highlight");setTimeout(()=>row.classList.remove("row-highlight"),2800)}
}

// Abre o painel (janela) com título e conteúdo. Enquanto está aberto, só ele rola; a tela de trás fica parada.
function openModal(title, body){
  $("modalTitle").textContent=title;
  $("modalBody").innerHTML=body;
  $("modalBody").onclick=e=>{
    if(e.target.closest("button,a,input,select"))return;
    const row=e.target.closest("[data-tx-id]");
    if(row)goToTransaction(row.dataset.txId);
  };
  $("modal").classList.remove("hidden");
  document.documentElement.classList.add("modal-open");   // só o painel rola; a tela de trás fica parada
  $("modal").querySelector(".modal-box").scrollTop=0;
  if(!modalHistory){ history.pushState({tab:currentTab,modal:true},""); modalHistory=true; }   // o botão voltar do celular vai fechar este painel
}

// Fecha o painel e libera a rolagem da tela.
// mode="pop": veio do botão voltar (a entrada do histórico já saiu). mode="keep": navegação vai cuidar do histórico. Sem mode (✕, fora, Esc, salvar): remove a entrada do painel.
function closeModal(mode){
  $("modal").classList.add("hidden");
  document.documentElement.classList.remove("modal-open");
  if(!modalHistory||mode==="keep")return;
  modalHistory=false;
  if(mode!=="pop"){ ignorePop++; history.back(); }
}

// ----- Lista de escolha do app (no lugar da lista nativa dos <select>) -----
// Em alguns celulares a lista nativa abre fora da tela. Por isso o CSS desliga o toque direto nos <select> e o bloco abaixo abre uma
// lista própria, colada embaixo da tela. O <select> continua na página: guarda o valor e recebe o evento "change" como antes.
let selSheet=null;   // lista aberta agora (null = nenhuma)

// Fecha a lista. mode="pop": veio do botão voltar (a entrada do histórico já saiu). Devolve true se havia lista aberta.
function closeSelectSheet(mode){
  if(!selSheet)return false;
  selSheet.remove(); selSheet=null;
  if(mode!=="pop"){ ignorePop++; history.back(); }
  return true;
}

// Abre a lista com as opções do <select> escolhido; tocar numa opção grava o valor e fecha.
function openSelectSheet(sel){
  if(selSheet)return;
  const name=(sel.closest("div")?.querySelector("label")?.textContent||sel.getAttribute("aria-label")||"Escolha uma opção").trim();
  selSheet=document.createElement("div"); selSheet.className="sel-sheet";
  selSheet.innerHTML=`<div class="sel-box" role="listbox" aria-label="${esc(name)}"><div class="sel-title">${esc(name)}</div>${[...sel.options].map((o,i)=>{
    const on=i===sel.selectedIndex;
    return `<button type="button" class="sel-opt${on?" on":""}" data-i="${i}" role="option" aria-selected="${on}"${o.disabled?" disabled":""}><span>${esc(o.textContent)}</span>${on?"<b>✓</b>":""}</button>`;
  }).join("")}</div>`;
  selSheet.onclick=e=>{
    const b=e.target.closest(".sel-opt");
    if(b&&!b.disabled){
      sel.selectedIndex=Number(b.dataset.i);
      sel.dispatchEvent(new Event("input",{bubbles:true})); sel.dispatchEvent(new Event("change",{bubbles:true}));
      closeSelectSheet();
    } else if(!b&&e.target===selSheet) closeSelectSheet();   // tocar fora da lista fecha
  };
  document.body.appendChild(selSheet);
  history.pushState({tab:currentTab,sheet:true},"");   // o botão voltar do celular vai fechar só esta lista
}

// Toque num <select> visível (do painel aberto ou da tela) abre a lista própria. O toque é achado pela posição, pois o CSS desliga o toque no <select>.
document.addEventListener("click",e=>{
  if(selSheet||!e.clientX&&!e.clientY||document.documentElement.classList.contains("confirm-open"))return;
  const area=$("modal").classList.contains("hidden")?document:$("modal");
  for(const s of area.querySelectorAll("select")){
    if(s.disabled||!s.offsetParent)continue;
    const r=s.getBoundingClientRect();
    if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){ e.preventDefault(); e.stopPropagation(); openSelectSheet(s); return; }
  }
},true);
document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&selSheet){ e.preventDefault(); e.stopImmediatePropagation(); closeSelectSheet(); } },true);   // Esc fecha só a lista

// ----- Caixa de confirmação/aviso do próprio app (no lugar do confirm()/alert() do navegador) -----
// Uso: if(await askConfirm("Mensagem",{title:"Título",okText:"Excluir",danger:true})) {...}   (devolve true/false)
// askAlert("Mensagem") mostra só um aviso com botão OK (não precisa de await).
// Como o painel (modal), a caixa ganha uma entrada no histórico: o botão voltar do celular FECHA a caixa (cancela) em vez de trocar de aba.
const confirmStack=[];   // caixas abertas agora (a de cima é a última)

// Usada pelo botão voltar (main.js): fecha a caixa de cima, se houver. Devolve true se fechou alguma.
function closeTopConfirm(){
  const top=confirmStack[confirmStack.length-1];
  if(!top)return false;
  top.cancel();
  return true;
}

function askConfirm(message,opts={}){
  const {title="Confirmar",okText="Confirmar",cancelText="Cancelar",danger=false,alertOnly=false}=opts;
  return new Promise(resolve=>{
    const wrap=document.createElement("div");
    wrap.className="confirm-overlay";
    wrap.innerHTML=`<div class="confirm-box" role="alertdialog" aria-modal="true"><h3></h3><p></p><div class="confirm-actions">${alertOnly?"":`<button type="button" class="btn ghost cf-cancel"></button>`}<button type="button" class="btn ${danger?"danger":"primary"} cf-ok"></button></div></div>`;
    wrap.querySelector("h3").textContent=title;
    wrap.querySelector("p").textContent=message;   // textContent: nunca interpreta HTML
    wrap.querySelector(".cf-ok").textContent=okText;
    const cancel=wrap.querySelector(".cf-cancel");if(cancel)cancel.textContent=cancelText;

    let closed=false;
    const entry={cancel:()=>close(alertOnly,"pop")};   // chamado pelo botão voltar: a entrada do histórico já saiu
    // mode "pop": veio do botão voltar. Sem mode (botões, fora, Esc): remove a entrada do histórico e só então devolve a resposta.
    const close=(result,mode)=>{
      if(closed)return;closed=true;
      document.removeEventListener("keydown",onKey,true);
      wrap.remove();
      const i=confirmStack.indexOf(entry);if(i>=0)confirmStack.splice(i,1);
      if(!confirmStack.length)document.documentElement.classList.remove("confirm-open");
      if(mode==="pop"){resolve(result);return}
      let fin=false;
      const finish=()=>{if(fin)return;fin=true;window.removeEventListener("popstate",finish);resolve(result)};
      window.addEventListener("popstate",finish);
      setTimeout(finish,300);   // segurança: se o navegador não avisar, segue mesmo assim
      ignorePop++;history.back();
    };
    const onKey=e=>{
      if(e.key==="Escape"&&confirmStack[confirmStack.length-1]===entry){e.preventDefault();e.stopImmediatePropagation();close(alertOnly)}   // Esc cancela e não fecha o painel que está atrás
    };
    document.addEventListener("keydown",onKey,true);
    wrap.addEventListener("click",e=>{if(e.target===wrap)close(alertOnly)});   // tocar fora = cancelar
    wrap.querySelector(".cf-ok").onclick=()=>close(true);
    if(cancel)cancel.onclick=()=>close(false);

    confirmStack.push(entry);
    history.pushState({tab:currentTab,confirm:true},"");   // o botão voltar do celular vai fechar esta caixa
    document.documentElement.classList.add("confirm-open");   // a tela de trás fica parada
    document.body.appendChild(wrap);
    (danger&&cancel?cancel:wrap.querySelector(".cf-ok")).focus();   // em exclusões, o foco começa em Cancelar (evita apagar sem querer)
  });
}
function askAlert(message,title="Aviso"){return askConfirm(message,{title,okText:"OK",alertOnly:true})}

;
/* ===== dashboard.js ===== */
// ====================================================================
// dashboard.js — aba Resumo
// Cards do topo, barras (com % sobre as entradas do mês), fluxo de caixa, pendências, histórico e painéis de detalhe.
// ====================================================================

// Nota mostrada quando o mês não tem entradas (sem entradas não dá para calcular a porcentagem).
const NO_INCOME_NOTE='<div class="field-note">Sem entradas neste mês: a porcentagem aparece quando houver entradas.</div>';
// Quanto um valor representa das ENTRADAS do mês, em % (devolve null se não há entradas).
function pctOfIncome(value,income){ return income>0 ? value/income*100 : null; }
// Texto da porcentagem com 2 casas decimais e vírgula (ex.: "23,33%"), "<0,01%" para valores minúsculos ou "—" quando não dá para calcular.
function pctText(p){ if(p===null) return "—"; if(p>0&&p<0.01) return "<0,01%"; return p.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})+"%"; }
// Largura da barra (0 a 100). Com entradas, 100% da barra = todas as entradas do mês; sem entradas, compara com o maior valor.
function barWidth(value,income,fallbackMax){ return income>0 ? Math.min(100,value/income*100) : (fallbackMax>0 ? value/fallbackMax*100 : 0); }

// Desenha a aba Resumo: os 4 cards do topo, categorias, cartões, empréstimos, fluxo de caixa, pendências e histórico.
function renderDashboard(){
  // ETAPA 1 — Números do mês (só cálculos, nada é desenhado ainda)
  const txPurchase=txForMonth(month);          // usado só para as Entradas (dinheiro que entrou de fato neste mês)
  const sched=scheduledPaymentsForMonth(month); // gastos cujo PAGAMENTO previsto cai neste mês (é essa data que manda no Resumo)
  const incB=incomeBreakdownForMonth(month);
  const income=incB.total;
  const gross=sched.reduce((s,t)=>s+t.value,0);
  const own=sched.reduce((s,t)=>s+ownAmount(t),0);   // sua parte, no mês em que o cartão vence (não no mês da compra)
  const scheduled=gross;
  const loanReceivable=loanReceivableForMonth(month);
  const loanGiven=loanGivenForMonth(month);
  const projected=income-own;   // Saldo previsto = Entradas - Gasto realmente seu

  // ETAPA 2 — Os 4 cards do topo: Entradas, Saídas previstas, Gasto realmente seu e Saldo previsto
  $("mIncome").textContent=fmtMoney(income);
  $("mScheduled").textContent=fmtMoney(scheduled);
  $("mOwn").textContent=fmtMoney(own);
  $("mBalance").textContent=fmtMoney(projected);
  $("mBalance").className=""+(projected>=0?"positive":"negative");
  // Quanto saídas e gasto próprio representam das entradas (texto pequeno dentro dos cards)
  $("mScheduledPct").textContent=income>0?`${pctText(pctOfIncome(scheduled,income))} das entradas`:"";
  $("mOwnPct").textContent=income>0?`${pctText(pctOfIncome(own,income))} das entradas`:"";

  // Cards de empréstimos: o que ainda deve voltar e o que foi emprestado no mês
  $("mLoanReceivable").textContent=fmtMoney(loanReceivable);
  $("mLoanGiven").textContent=fmtMoney(loanGiven);

  // Gastos por categoria (clicável: abre a lista de lançamentos da categoria)
  const cat={}; sched.forEach(t=>(t.splits||[]).forEach(s=>cat[s.category]=(cat[s.category]||0)+Number(s.amount||0)));
  const catArr=Object.entries(cat).sort((a,b)=>b[1]-a[1]);
  const max=catArr[0]?.[1]||1;
  $("categoryTotal").textContent=gross>0?`Total do mês: ${fmtMoney(gross)}`:"";
  $("categoryBars").innerHTML=catArr.length ? catArr.slice(0,10).map(([k,v])=>{const p=pctOfIncome(v,income);return `<div class="bar-row bar-click" data-cat="${esc(k)}" title="Ver lançamentos"><div class="bar-label"><span>${esc(k)} (${pctText(p)})</span><b>${fmtMoney(v)}</b></div><div class="bar"><i style="width:${barWidth(v,income,max)}%"></i></div></div>`}).join("") : '<div class="empty">Sem gastos neste mês.</div>';
  $("categoryBars").querySelectorAll("[data-cat]").forEach(el=>el.onclick=()=>showCategoryDetail(el.dataset.cat));
  if(income<=0&&catArr.length)$("categoryBars").insertAdjacentHTML("beforeend",NO_INCOME_NOTE);

  // Cartões (clicável: abre as compras do cartão)
  const cardsCat={}; sched.filter(t=>t.cardId).forEach(t=>cardsCat[t.cardId]=(cardsCat[t.cardId]||0)+t.value);
  const cArr=Object.entries(cardsCat).sort((a,b)=>b[1]-a[1]);
  $("cardBars").innerHTML=cArr.length ? cArr.map(([id,v])=>{
    const c=data.cards.find(x=>x.id===id), p=pctOfIncome(v,income);
    return `<div class="bar-row bar-click" data-card="${esc(id)}" title="Ver compras"><div class="bar-label"><span>${esc(c?.name||"Cartão")} (${pctText(p)})</span><b>${fmtMoney(v)}</b></div><div class="bar"><i style="width:${barWidth(v,income,cArr[0][1])}%"></i></div></div>`;
  }).join("") : '<div class="empty">Sem compras em cartão neste mês.</div>';
  $("cardBars").querySelectorAll("[data-card]").forEach(el=>el.onclick=()=>showCardDetail(el.dataset.card));
  if(income<=0&&cArr.length)$("cardBars").insertAdjacentHTML("beforeend",NO_INCOME_NOTE);

  // Pagamentos previstos do mês separados por status
  const isPaid=t=>t.paymentStatus==="paid";
  const paidSum=sched.filter(isPaid).reduce((s,t)=>s+t.value,0);
  const pendingSum=scheduled-paidSum;
  const paidPct=scheduled>0?Math.round(paidSum/scheduled*100):0, pendingPct=scheduled>0?100-paidPct:0;
  $("paymentStatusBars").innerHTML=scheduled>0
    ? `<div class="bar-row"><div class="bar-label"><span>Saídas previstas já pagas (${paidPct}%)</span><b class="positive">${fmtMoney(paidSum)}</b></div><div class="bar"><i style="width:${paidPct}%;background:#15803d"></i></div></div><div class="bar-row"><div class="bar-label"><span>Saídas previstas não pagas (${pendingPct}%)</span><b class="warning">${fmtMoney(pendingSum)}</b></div><div class="bar"><i style="width:${pendingPct}%;background:#b45309"></i></div></div>`
    : '<div class="empty">Nenhuma saída prevista neste mês.</div>';

  // Fluxo de caixa com filtro (Todos / Pagos / Não pagos); clicar no item leva ao lançamento
  const flows=sched.slice().sort((a,b)=>a.paymentDate.localeCompare(b.paymentDate)||(a.createdAt||0)-(b.createdAt||0));
  const shownFlows=flows.filter(t=>cashFilter==="all"||(cashFilter==="paid"?isPaid(t):!isPaid(t)));
  const cashItems=[];
  if(cashFilter==="all") txPurchase.filter(t=>t.type==="income").forEach(t=>cashItems.push({txId:t.id,date:t.date,type:"income",title:t.description,value:t.value,status:t.source==="reimbursement"?(t.sourceCategory===LOAN_CATEGORY?"Empréstimo devolvido":"Reembolso"):"Entrada"}));
  shownFlows.forEach(t=>cashItems.push({txId:t.id,id:t.id,paid:isPaid(t),date:t.paymentDate,type:"expense",title:t.description,value:t.value,status:isPaid(t)?"Pago":"Previsto",card:t.cardId?data.cards.find(c=>c.id===t.cardId)?.name:""}));
  cashItems.sort((a,b)=>a.date.localeCompare(b.date));
  document.querySelectorAll("[data-cash-filter]").forEach(b=>b.classList.toggle("primary",b.dataset.cashFilter===cashFilter));
  $("cashflowList").innerHTML=cashItems.length ? cashItems.map(x=>`<div class="cashflow-item"><div class="cashflow-main"><span class="cashflow-dot ${x.type}"></span><div><div class="cashflow-link" onclick="goToTransaction('${x.txId}')" title="Ver em Lançamentos"><b>${esc(x.title)}</b><div class="muted">${fmtDate(x.date)} · ${esc(x.status)}${x.card?` · ${esc(x.card)}`:""}</div></div>${x.id?`<button class="btn ghost" style="margin-top:6px;padding:4px 9px;font-size:12px" onclick="togglePaid('${x.id}')">${x.paid?"Voltar para previsto":"Marcar como pago"}</button>`:""}</div></div><strong class="${x.type==="expense"?"negative":"positive"}">${x.type==="expense"?"-":"+"} ${fmtMoney(x.value)}</strong></div>`).join("") : '<div class="empty">Nenhuma entrada ou saída prevista neste mês.</div>';
  const sub=shownFlows.reduce((sum,t)=>sum+t.value,0);
  $("cashflowSubtotal").innerHTML=cashFilter==="all"?"":`Subtotal ${cashFilter==="paid"?"das saídas já pagas":"das saídas não pagas"}: <b>${fmtMoney(sub)}</b>`;

  // Pendências de reembolso: só as do mês visto (pelo mês do pagamento previsto, o mesmo critério do fluxo de caixa)
  const pend=[];
  data.transactions.filter(t=>t.type==="expense" && (t.paymentDate||t.date).slice(0,7)===month).forEach(t=>(t.splits||[]).forEach((s,idx)=>{
    if(s.ownerId!=="self" && s.reimbursed!==true) pend.push({t,s,idx});
  }));
  const pendTotal=pend.reduce((s,{s:x})=>s+Number(x.amount||0),0);
  $("receivableBadge").textContent=pend.length?`${pend.length} · ${fmtMoney(pendTotal)}`:"nenhuma";
  $("receivableList").innerHTML=pend.length ? pend.map(({t,s,idx})=>{
    const p=data.people.find(x=>x.id===s.ownerId);
    return `<div class="reimbursed-row" data-tx-id="${esc(t.id)}" title="Ver em Lançamentos"><div><b>${esc(p?.name||"Outra pessoa")}</b> · ${fmtMoney(s.amount)}${s.category===LOAN_CATEGORY?' <span class="tag">Empréstimo</span>':""}<div class="muted">${esc(t.description)} · compra ${fmtDate(t.date)} · pagamento ${fmtDate(t.paymentDate||t.date)}</div></div><button class="btn" onclick="markReimbursement('${t.id}',${idx})">Marcar como recebido</button></div>`;
  }).join("") : '<div class="empty">Nenhum reembolso pendente neste mês.</div>';
  $("receivableList").onclick=e=>{
    if(e.target.closest("button"))return;
    const row=e.target.closest("[data-tx-id]");
    if(row)goToTransaction(row.dataset.txId);
  };

  // Últimos lançamentos: registro do que foi feito (independe do mês), do mais novo para o mais antigo
  const log=data.activityLog||[];
  const fmtWhen=at=>{const d=new Date(at);return d.toLocaleDateString("pt-BR")+" "+d.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})};
  $("activityBadge").textContent=String(log.length);
  $("activityList").innerHTML=log.length ? log.slice(0,100).map(a=>{
    const exists=a.txId&&data.transactions.some(t=>t.id===a.txId);
    const undoable=!!a.undo?.changes?.length&&!a.undoneAt;
    return `<div class="activity-item${exists?" clickable":""}"${exists?` onclick="goToTransaction('${a.txId}')" title="Ver em Lançamentos"`:""}><span class="activity-icon">${ACTIVITY_ICONS[a.kind]||"•"}</span><div class="activity-main"><b>${esc(a.text)}</b><div class="muted">${esc(a.detail||"")}</div></div><div class="activity-meta"><div class="activity-when muted">${fmtWhen(a.at)}</div>${undoable?`<button class="btn activity-undo" type="button" onclick="event.stopPropagation();undoActivity('${esc(a.id)}')">Desfazer</button>`:a.undoneAt?'<span class="activity-undone">Desfeito</span>':""}</div></div>`;
  }).join("")+(log.length>100?`<div class="muted" style="padding:8px 0">Mostrando os 100 mais recentes de ${log.length}.</div>`:"") : '<div class="empty">Nenhuma atividade registrada ainda. O que você lançar, editar ou excluir daqui para frente aparece aqui.</div>';

  // Planilha do mês (gastos por categoria + entradas + saldo)
  renderSheet();
}

// Tabela de gastos usada nos painéis de detalhe (categoria, cartão, gasto realmente seu).
function detailTable(rows,valueOf){
  if(!rows.length) return '<div class="empty">Nenhum lançamento.</div>';
  const body=rows.map(t=>{
    const v=valueOf(t), par=t.installments>1?`${t.installmentNo||1}/${t.installments}`:"—";
    const sub=Math.abs(v-t.value)>0.004?`<div class="muted">de ${fmtMoney(t.value)}</div>`:"";
    return `<tr data-tx-id="${esc(t.id)}"><td class="c-date" data-label="Data">${fmtDate(t.date)}</td><td class="c-desc"><b>${esc(t.description)}</b>${t.notes?`<div class="muted">${esc(t.notes)}</div>`:""}</td><td data-label="Forma">${paymentLabel(t)}</td><td data-label="Responsável">${peopleLabels(t)}</td><td data-label="Pag. previsto">${paymentDateLabel(t)}</td><td class="${par==="—"?"c-empty":""}" data-label="Parcelas">${par}</td><td class="right negative c-val">- ${fmtMoney(v)}${sub}</td></tr>`;
  }).join("");
  return `<div class="table-wrap detail-table"><table><thead><tr><th>Data</th><th>Descrição</th><th>Forma</th><th>Responsável</th><th>Pagamento previsto</th><th>Parcelas</th><th class="right">Valor</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

// Painel com os lançamentos de uma categoria no mês visto.
function showCategoryDetail(cat){
  const partOf=t=>(t.splits||[]).filter(s=>s.category===cat).reduce((a,x)=>a+Number(x.amount||0),0);
  const rows=scheduledPaymentsForMonth(month).filter(t=>(t.splits||[]).some(s=>s.category===cat)).sort(byNewest);
  const total=rows.reduce((s,t)=>s+partOf(t),0);
  openModal(`${cat} · compras de ${fmtMonthLabel(month)}`,`<div class="muted" style="margin-bottom:8px">${rows.length} lançamento(s) · total <b>${fmtMoney(total)}</b></div>`+detailTable(rows,partOf));
}

// Tabela de entradas usada no painel de detalhe das entradas.
function incomeDetailTable(rows){
  if(!rows.length) return '<div class="empty">Nenhuma entrada.</div>';
  const body=rows.map(t=>`<tr data-tx-id="${esc(t.id)}"><td class="c-date" data-label="Data">${fmtDate(t.date)}</td><td class="c-desc"><b>${esc(t.description)}</b>${t.notes?`<div class="muted">${esc(t.notes)}</div>`:""}</td><td class="right positive c-val">+ ${fmtMoney(t.value)}</td></tr>`).join("");
  return `<div class="table-wrap detail-table"><table><thead><tr><th>Data</th><th>Descrição</th><th class="right">Valor</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

// Painel com as entradas do mês (todas ou de uma origem).
function showIncomeDetail(origin){
  const titles={all:"Todas as entradas",normal:"Salário e outras entradas",loan:"Devolução de empréstimos cedidos",reimb:"Outros reembolsos recebidos"};
  const rows=txForMonth(month).filter(t=>t.type==="income"&&(origin==="all"||incomeOrigin(t)===origin)).sort(byNewest);
  const total=rows.reduce((s,t)=>s+t.value,0);
  openModal(`${titles[origin]} · ${fmtMonthLabel(month)}`,`<div class="muted" style="margin-bottom:8px">${rows.length} lançamento(s) · total <b>${fmtMoney(total)}</b></div>`+incomeDetailTable(rows));
}

// Painel com os gastos que compõem o "Gasto realmente seu".
function showOwnDetail(){
  const rows=scheduledPaymentsForMonth(month).filter(t=>ownAmount(t)>0.004).sort(byNewest);
  const total=rows.reduce((s,t)=>s+ownAmount(t),0);
  openModal(`Gasto realmente seu · ${fmtMonthLabel(month)}`,`<div class="muted" style="margin-bottom:8px">${rows.length} lançamento(s) · sua parte <b>${fmtMoney(total)}</b></div>`+detailTable(rows,ownAmount));
}

// Painel com as compras de um cartão no mês visto.
function showCardDetail(id){
  const c=data.cards.find(x=>x.id===id);
  const rows=scheduledPaymentsForMonth(month).filter(t=>t.cardId===id).sort(byNewest);
  const total=rows.reduce((s,t)=>s+t.value,0);
  openModal(`${c?.name||"Cartão"} · compras de ${fmtMonthLabel(month)}`,`<div class="muted" style="margin-bottom:8px">${rows.length} lançamento(s) · total <b>${fmtMoney(total)}</b></div>`+detailTable(rows,t=>t.value));
}

// ====================================================================
// Planilha do mês: mesma visão da planilha de controle (despesas por categoria, entradas e saldo)
// ====================================================================

// Data curta DD/MM a partir de AAAA-MM-DD.
const shortDate=d=>d.slice(8,10)+"/"+d.slice(5,7);

// Clique numa linha da planilha: abre o lançamento (ignorado logo depois de arrastar uma categoria).
function sheetRowClick(id){ if(sheetDragMoved)return; goToTransaction(id); }

// Desenha a "Planilha do mês": para cada categoria, as despesas com pagamento previsto no mês, o subtotal, depois as entradas e o saldo.
// Cada categoria tem uma cor (clara/escura alternadas) e pode ser arrastada para mudar a ordem (sheet-drag.js).
function renderSheet(){
  const box=$("sheetView"); if(!box)return;
  const sched=scheduledPaymentsForMonth(month);
  const incomes=txForMonth(month).filter(t=>t.type==="income");
  if(!sched.length&&!incomes.length){ box.innerHTML='<div class="empty">Sem lançamentos neste mês.</div>'; return; }

  // 1) Despesas agrupadas por categoria (cada divisão do gasto entra na sua categoria, pelo valor cheio)
  const byCat={};
  sched.forEach(t=>(t.splits||[]).forEach(s=>{ (byCat[s.category]=byCat[s.category]||[]).push({t,s}); }));
  const cats=[...data.categories.filter(c=>byCat[c]),...Object.keys(byCat).filter(c=>!data.categories.includes(c))];   // segue a ordem da aba Categorias
  let totalOut=0, html="";
  cats.forEach((cat,gi)=>{
    const items=byCat[cat].sort((a,b)=>(a.t.paymentDate||a.t.date).localeCompare(b.t.paymentDate||b.t.date)||a.t.description.localeCompare(b.t.description,"pt-BR"));
    const sub=items.reduce((sum,x)=>sum+Number(x.s.amount||0),0); totalOut+=sub;
    items.forEach(({t,s},i)=>{
      const pd=t.paymentDate||t.date, par=t.installments>1?` ${t.installmentNo||1}/${t.installments}`:"";
      const who=s.ownerId!=="self"?` <span class="tag">${esc(data.people.find(p=>p.id===s.ownerId)?.name||"Outra pessoa")}</span>`:"";
      html+=`<tr class="sheet-row sheet-g${gi%2}" data-g="${esc(cat)}"${i===0?" data-gfirst":""} onclick="sheetRowClick('${t.id}')" title="Ver em Lançamentos">${i===0?`<td class="sheet-cat" rowspan="${items.length}" data-cat="${esc(cat)}" onclick="event.stopPropagation()" title="Segure e arraste para mudar a ordem"><span class="grip">⠿</span> ${esc(cat)}<div class="sheet-cat-sub">${fmtMoney(sub)}</div></td>`:""}<td>${esc(t.description)}${par}${who}</td><td class="sheet-date">${shortDate(pd)}${t.paymentStatus==="paid"?' <span class="positive" title="Já pago">✓</span>':""}</td><td class="right">${fmtMoney(s.amount)}</td>${i===0?`<td class="sheet-sub right" rowspan="${items.length}">${fmtMoney(sub)}</td>`:""}</tr>`;
    });
  });
  html+=`<tr class="sheet-total sheet-out"><td colspan="3">Total gasto no mês</td><td colspan="2" class="right">${fmtMoney(totalOut)}</td></tr>`;

  // 2) Entradas em três grupos: salário/normais, extras (reembolsos) e devolução de empréstimos
  const groups=[["normal","Entradas do salário e outras"],["reimb","Entradas extras (reembolsos)"],["loan","Entradas de empréstimos cedidos"]];
  let totalIn=0, gj=0;
  groups.forEach(([key,label])=>{
    const items=incomes.filter(t=>incomeOrigin(t)===key).sort((a,b)=>a.date.localeCompare(b.date)||a.description.localeCompare(b.description,"pt-BR"));
    if(!items.length)return;
    const sub=items.reduce((sum,t)=>sum+t.value,0); totalIn+=sub;
    items.forEach((t,i)=>{
      html+=`<tr class="sheet-row sheet-in-g${gj%2}" onclick="sheetRowClick('${t.id}')" title="Ver em Lançamentos">${i===0?`<td class="sheet-cat sheet-cat-in" rowspan="${items.length}">${label}<div class="sheet-cat-sub">${fmtMoney(sub)}</div></td>`:""}<td>${esc(t.description)}</td><td class="sheet-date">${shortDate(t.date)}</td><td class="right">${fmtMoney(t.value)}</td>${i===0?`<td class="sheet-sub right" rowspan="${items.length}">${fmtMoney(sub)}</td>`:""}</tr>`;
    });
    gj++;
  });
  html+=`<tr class="sheet-total sheet-in"><td colspan="3">Soma das entradas</td><td colspan="2" class="right">${fmtMoney(totalIn)}</td></tr>`;

  // 3) Saldo do mês = entradas - total gasto (valores cheios, como na planilha)
  const bal=totalIn-totalOut;
  html+=`<tr class="sheet-total sheet-bal"><td colspan="3">Saldo do mês</td><td colspan="2" class="right">${fmtMoney(bal)}</td></tr>`;

  box.innerHTML=`<div class="table-wrap sheet"><table class="sheet-table"><thead><tr><th>Categoria</th><th>Despesas e descrição</th><th>Pagamento previsto</th><th class="right">Valor previsto (R$)</th><th class="right sheet-th-sub">Soma por categoria</th></tr></thead><tbody>${html}</tbody></table></div><div class="field-note">💡 Segure uma categoria por meio segundo e arraste para mudar a ordem (a mesma ordem da aba Categorias). Os valores são cheios (incluem a parte de outras pessoas, marcada com o nome); por isso o Saldo do mês aqui pode ser menor que o "Saldo previsto" do topo. ✓ = já pago.</div>`;
  initSheetDrag(box);   // liga o "segurar e arrastar" nas categorias (sheet-drag.js)
}

// ====================================================================
// Cards do topo clicáveis: cada um abre a lista de lançamentos que formam o valor
// ====================================================================

// Abre o painel do card tocado: income (entradas), scheduled (saídas previstas), own (gasto realmente seu) ou balance (saldo previsto).
function showMetricDetail(kind){
  if(kind==="income") showIncomeDetail("all");
  else if(kind==="scheduled") showScheduledDetail();
  else if(kind==="own") showOwnDetail();
  else if(kind==="balance") showBalanceDetail();
}

// Painel com todas as saídas previstas do mês (valor cheio).
function showScheduledDetail(){
  const rows=scheduledPaymentsForMonth(month).sort(byNewest);
  const total=rows.reduce((s,t)=>s+t.value,0);
  openModal(`Saídas previstas · ${fmtMonthLabel(month)}`,`<div class="muted" style="margin-bottom:8px">${rows.length} lançamento(s) · total <b>${fmtMoney(total)}</b> (valor cheio, incluindo a parte de outras pessoas)</div>`+detailTable(rows,t=>t.value));
}

// Painel do Saldo previsto: mostra a conta (Entradas - Gasto realmente seu) e as duas listas que formam o resultado.
function showBalanceDetail(){
  const inc=txForMonth(month).filter(t=>t.type==="income").sort(byNewest);
  const own=scheduledPaymentsForMonth(month).filter(t=>ownAmount(t)>0.004).sort(byNewest);
  const ti=inc.reduce((s,t)=>s+t.value,0), to=own.reduce((s,t)=>s+ownAmount(t),0), bal=ti-to;
  openModal(`Saldo previsto · ${fmtMonthLabel(month)}`,
    `<div class="bal-grid"><div class="loan-box"><span>Entradas</span><strong class="positive">${fmtMoney(ti)}</strong></div><div class="loan-box"><span>Gasto realmente seu</span><strong class="negative">${fmtMoney(to)}</strong></div><div class="loan-box"><span>Saldo previsto</span><strong class="${bal>=0?"positive":"negative"}">${fmtMoney(bal)}</strong></div></div>`+
    `<h3>Entradas (${inc.length})</h3>`+incomeDetailTable(inc)+`<h3>Gasto realmente seu (${own.length})</h3>`+detailTable(own,ownAmount));
}

// Filtro do fluxo de caixa: all (todos), paid (já pagos) ou pending (não pagos).
function setCashFilter(f){ cashFilter=f; renderDashboard(); }

// Alterna um gasto entre "previsto" e "pago".
function togglePaid(id){
  const t=data.transactions.find(x=>x.id===id); if(!t||t.type!=="expense")return;
  const before=structuredClone(t);
  t.paymentStatus=t.paymentStatus==="paid"?"planned":"paid";
  logActivity(t.paymentStatus==="paid"?"paid":"unpaid",`${t.paymentStatus==="paid"?"Marcado como pago":"Voltou para previsto"}: ${t.description}`,`${fmtMoney(t.value)} · pagamento em ${fmtDate(t.paymentDate||t.date)}`,t.id,{changes:[{before,after:structuredClone(t)}]});
  save(); toast(t.paymentStatus==="paid"?"Marcado como pago":"Voltou para previsto");   // save() recalcula o Resumo
}

;
