/* ===== sheet-drag.js ===== */
// ====================================================================
// sheet-drag.js — arrastar categorias na Planilha do mês
// Segure uma categoria por ~0,3 s e arraste para cima/baixo; as outras se ajeitam sozinhas.
// A ordem é a mesma da aba Categorias (data.categories), então vale para o app todo.
// ====================================================================

let sheetDragMoved=false;   // true logo depois de um arrasto (evita abrir um lançamento sem querer)
let sheetDrag=null;         // arrasto em andamento: {cat, rows, ghost, target, x, y, raf}

// Liga o "segurar e arrastar" às células de categoria da planilha (chamado por renderSheet depois de desenhar).
function initSheetDrag(root){
  root.querySelectorAll(".sheet-cat[data-cat]").forEach(cell=>{
    cell.addEventListener("pointerdown",e=>sheetPress(e,cell));
    cell.addEventListener("contextmenu",e=>e.preventDefault());   // evita o menu do toque longo
  });
}

// Começa a contar o toque longo. Se o dedo se mexer antes disso (ou seja, o usuário está rolando a tela), cancela.
function sheetPress(e,cell){
  if(e.pointerType==="mouse"&&e.button!==0)return;
  const id=e.pointerId, sx=e.clientX, sy=e.clientY;
  let active=false;
  const stop=()=>{clearTimeout(timer);document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",up);document.removeEventListener("pointercancel",abort)};
  const timer=setTimeout(()=>{active=true;sheetBegin(cell,sx,sy)},320);
  const move=ev=>{ if(ev.pointerId!==id)return; if(!active){ if(Math.hypot(ev.clientX-sx,ev.clientY-sy)>10)stop(); } else sheetMove(ev.clientX,ev.clientY); };
  const up=ev=>{ if(ev.pointerId!==id)return; const was=active; stop(); if(was) sheetEnd(true); };
  const abort=ev=>{ if(ev.pointerId!==id)return; const was=active; stop(); if(was) sheetEnd(false); };
  document.addEventListener("pointermove",move);
  document.addEventListener("pointerup",up);
  document.addEventListener("pointercancel",abort);
}

// Impede a rolagem da tela enquanto uma categoria está sendo arrastada.
const sheetBlockTouch=e=>e.preventDefault();

// Início do arrasto: cria a "sombra" que acompanha o dedo e marca a categoria sendo movida.
function sheetBegin(cell,x,y){
  const cat=cell.dataset.cat;
  const rows=[...document.querySelectorAll("#sheetView tr[data-g]")];
  const ghost=document.createElement("div");
  ghost.className="sheet-ghost"; ghost.textContent="⠿ "+cat; document.body.appendChild(ghost);
  sheetDrag={cat,rows,ghost,target:null,x,y,raf:0};
  rows.filter(r=>r.dataset.g===cat).forEach(r=>r.classList.add("sheet-dragging"));
  document.body.classList.add("sheet-drag-on");
  document.addEventListener("touchmove",sheetBlockTouch,{passive:false});
  if(navigator.vibrate)navigator.vibrate(25);   // vibração curta avisa que pegou
  sheetMove(x,y);
  sheetLoop();
}

// Movimento do dedo/mouse: guarda a posição e leva a sombra junto.
function sheetMove(x,y){
  const d=sheetDrag; if(!d)return;
  d.x=x; d.y=y;
  d.ghost.style.left=(x+12)+"px"; d.ghost.style.top=(y-20)+"px";
}

// Grupos de linhas (uma categoria = um grupo) com a posição atual na tela.
function sheetGroups(){
  const map=new Map();
  sheetDrag.rows.forEach(r=>{ const g=r.dataset.g; if(!map.has(g))map.set(g,[]); map.get(g).push(r); });
  return [...map].map(([cat,rs])=>({cat,rows:rs,first:rs[0],last:rs[rs.length-1],top:rs[0].getBoundingClientRect().top,bottom:rs[rs.length-1].getBoundingClientRect().bottom}));
}

// Descobre onde a categoria cairia (antes/depois de qual categoria) e mostra a linha azul de destino.
function sheetUpdateTarget(){
  const d=sheetDrag; if(!d)return;
  document.querySelectorAll("#sheetView .sheet-drop-before,#sheetView .sheet-drop-after").forEach(el=>el.classList.remove("sheet-drop-before","sheet-drop-after"));
  const gs=sheetGroups(); let target=null;
  for(const g of gs){ if(d.y<=g.bottom){ target={cat:g.cat,pos:d.y<(g.top+g.bottom)/2?"before":"after",g}; break; } }
  if(!target){ const g=gs[gs.length-1]; target={cat:g.cat,pos:"after",g}; }   // abaixo da última categoria
  if(target.cat===d.cat){ d.target=null; return; }                             // soltar sobre si mesma não muda nada
  d.target=target;
  if(target.pos==="before") target.g.first.classList.add("sheet-drop-before");
  else target.g.rows.forEach(r=>r.querySelectorAll("td.sheet-cat,td.sheet-sub").forEach(td=>td.classList.add("sheet-drop-after")));
  if(target.pos==="after") target.g.last.classList.add("sheet-drop-after");
}

// Repete a cada quadro: rola a tela sozinha perto das bordas e atualiza o destino.
function sheetLoop(){
  const d=sheetDrag; if(!d)return;
  const h=window.innerHeight;
  if(d.y<80) window.scrollBy(0,-Math.ceil((80-d.y)/6));
  else if(d.y>h-80) window.scrollBy(0,Math.ceil((d.y-(h-80))/6));
  sheetUpdateTarget();
  d.raf=requestAnimationFrame(sheetLoop);
}

// Fim do arrasto: limpa a tela e, se soltou num destino válido (commit), muda a ordem das categorias.
function sheetEnd(commit){
  const d=sheetDrag; if(!d)return;
  sheetDrag=null;
  cancelAnimationFrame(d.raf);
  d.ghost.remove();
  document.removeEventListener("touchmove",sheetBlockTouch);
  document.body.classList.remove("sheet-drag-on");
  document.querySelectorAll("#sheetView .sheet-dragging,#sheetView .sheet-drop-before,#sheetView .sheet-drop-after").forEach(el=>el.classList.remove("sheet-dragging","sheet-drop-before","sheet-drop-after"));
  sheetDragMoved=true; setTimeout(()=>{sheetDragMoved=false},500);
  if(commit&&d.target) moveCategoryTo(d.cat,d.target.cat,d.target.pos);
}

// Tira a categoria do lugar atual e coloca antes ("before") ou depois ("after") da categoria de referência. As outras se ajeitam.
function moveCategoryTo(cat,ref,pos){
  const arr=data.categories, from=arr.indexOf(cat);
  if(from<0)return;
  arr.splice(from,1);
  const to=arr.indexOf(ref);
  if(to<0) arr.push(cat); else arr.splice(pos==="after"?to+1:to,0,cat);
  save();   // salva e redesenha (Resumo e aba Categorias já mostram a nova ordem)
}

;
/* ===== transactions.js ===== */
// ====================================================================
// transactions.js — aba Lançamentos
// Tabela de lançamentos e seleção em massa (alterar data de pagamento/excluir). O formulário fica em transaction-form.js.
// ====================================================================

// Etiquetas de categoria (com valor) de um gasto.
function categoryLabels(t){
  const splits=t.splits||[];
  if(!splits.length) return "—";
  return splits.map(s=>`<span class="tag">${esc(s.category)} · ${fmtMoney(s.amount)}</span>`).join(" ");
}

// Quanto cada pessoa paga em um gasto (Você, João...).
function peopleLabels(t){
  if(t.type!=="expense") return "—";
  const people={};
  (t.splits||[]).forEach(s=>{const p=s.ownerId==="self"?"Você":data.people.find(x=>x.id===s.ownerId)?.name||"Outra pessoa";people[p]=(people[p]||0)+Number(s.amount||0)});
  return Object.entries(people).map(([p,v])=>`${esc(p)}: ${fmtMoney(v)}`).join("<br>");
}

// Texto da forma de pagamento (Pix, Débito, Crédito · Nubank...).
function paymentLabel(t){
  if(t.type==="card_payment") return "Crédito";
  const card=t.cardId?esc(data.cards.find(c=>c.id===t.cardId)?.name||"Cartão"):"";
  if(t.method&&METHODS[t.method]) return isCreditMethod(t.method)?`${METHODS[t.method]}${card?" · "+card:""}`:METHODS[t.method];
  return card||"Pix / débito / dinheiro";
}

// Data de pagamento previsto/realizado com a cor do status.
function paymentDateLabel(t){
  if(t.type!=="expense") return "—";
  const d=t.paymentDate||t.date;
  const status=t.paymentStatus||"planned";
  return `<span class="${status==="paid"?"pay-paid":"pay-planned"}"><b>${fmtDate(d)}</b><br><small>${status==="paid"?"Pago":"Previsto"}</small></span>`;
}

// Marca ou desmarca um lançamento na seleção.
function toggleSelect(id,checked){if(checked)selectedTxIds.add(id);else selectedTxIds.delete(id);updateBulkBar();}

// Marca ou desmarca todos os lançamentos visíveis (gastos e entradas).
function toggleSelectAll(e){
  const checks=[...document.querySelectorAll(".tx-check")];
  checks.forEach(c=>{c.checked=e.target.checked;if(c.checked)selectedTxIds.add(c.value);else selectedTxIds.delete(c.value)});
  updateBulkBar();
}

// Mostra ou esconde a barra de ações em massa conforme há lançamentos selecionados.
function updateBulkBar(){
  $("selectedCount").textContent=selectedTxIds.size;
  $("bulkBar").classList.toggle("hidden",selectedTxIds.size===0);
}

// Desenha a tabela da aba Lançamentos, aplicando mês, busca e tipo. Um gasto também aparece no mês do pagamento previsto.
function renderTransactions(){
  // 1) Lê os filtros da tela: mês, texto da busca e tipo (gasto/entrada)
  const m=$("txMonth").value||month,q=($("txSearch").value||"").toLowerCase(),type=$("txType").value;
  // mostra o gasto no mês da compra e também no mês do pagamento previsto (ex.: compra no crédito paga no mês seguinte)
  const inMonth=t=>t.date.slice(0,7)===m || (t.type==="expense" && (t.paymentDate||t.date).slice(0,7)===m);
  let arr=data.transactions.filter(t=>inMonth(t) && (!type||t.type===type));
  if(q) arr=arr.filter(t=>(t.description+" "+(t.splits||[]).map(s=>s.category).join(" ")+" "+(t.notes||"")).toLowerCase().includes(q));
  arr.sort(byNewest);
  // 2) Mantém marcados só os lançamentos que continuam visíveis e atualiza o "Selecionar" do cabeçalho
  const visibleIds=new Set(arr.map(t=>t.id));
  [...selectedTxIds].forEach(id=>{if(!visibleIds.has(id))selectedTxIds.delete(id)});
  $("selectAllTx").checked=arr.length>0 && arr.every(t=>selectedTxIds.has(t.id));
  // 3) Desenha uma linha da tabela para cada lançamento
  $("txTable").innerHTML=arr.length ? arr.map(t=>{
    const par=t.installments>1?`${t.installmentNo||1}/${t.installments}`:"—";
    const val=t.type==="expense"?`- ${fmtMoney(t.value)}`:`+ ${fmtMoney(t.value)}`;
    const cls=t.type==="expense"?"negative":"positive";
    return `<tr id="tx-${t.id}">
      <td class="select-col"><input class="tx-check" type="checkbox" aria-label="Selecionar lançamento" value="${t.id}" ${selectedTxIds.has(t.id)?"checked":""} onchange="toggleSelect('${t.id}',this.checked)"></td>
      <td class="c-date" data-label="Data">${fmtDate(t.date)}</td><td class="c-desc"><b>${esc(t.description)}</b>${t.notes?`<div class="muted">${esc(t.notes)}</div>`:""}${t.type==="expense"&&t.date.slice(0,7)!==m?`<div><span class="tag">Compra de ${fmtMonthLabel(t.date)} · pagamento neste mês</span></div>`:""}</td>
      <td class="${t.type==="expense"||t.source==="reimbursement"?"":"c-empty"}" data-label="Categoria">${t.type==="expense"?categoryLabels(t):t.source==="reimbursement"?'<span class="pill">Reembolso</span>':"—"}</td>
      <td data-label="Forma">${paymentLabel(t)}</td><td data-label="Responsável">${peopleLabels(t)}</td><td data-label="Pag. previsto">${paymentDateLabel(t)}</td><td class="${par==="—"?"c-empty":""}" data-label="Parcela">${par}</td>
      <td class="right c-val ${cls}">${val}</td>
      <td class="c-act"><div class="row-actions">${t.type!=="card_payment"?`<button class="btn" onclick="editTransaction('${t.id}')">Editar</button>`:""}<button class="btn ghost" onclick="removeTransaction('${t.id}')">Excluir</button></div></td>
    </tr>`;
  }).join("") : '<tr><td colspan="10" class="empty">Nenhum lançamento encontrado.</td></tr>';
  // 4) Mostra ou esconde a barra de ações em massa
  updateBulkBar();
}

// Painel para definir a data/status de pagamento de todos os gastos selecionados.
function openBulkPaymentModal(){
  const ids=[...selectedTxIds], expenses=ids.map(id=>data.transactions.find(t=>t.id===id)).filter(t=>t?.type==="expense");
  if(!expenses.length){askAlert("Selecione pelo menos um gasto. A data de pagamento previsto só vale para gastos.");return}
  const suggested=expenses.length===1?(expenses[0].paymentDate||nextCardPaymentDate(expenses[0].cardId,expenses[0].date)):(month+"-19");
  openModal("Definir pagamento previsto",`<form id="bulkPayForm"><p>Você selecionou <b>${expenses.length}</b> gasto(s). A data abaixo será aplicada a todos.${ids.length>expenses.length?" As entradas selecionadas serão ignoradas.":""}</p><div><label>Data de pagamento</label><input name="paymentDate" type="date" value="${suggested}" required></div><div style="margin-top:10px"><label>Status</label><select name="status"><option value="planned">Pagamento previsto</option><option value="paid">Já pago</option></select></div><div class="row-actions end" style="margin-top:15px"><button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary">Aplicar aos selecionados</button></div></form>`);
  $("bulkPayForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),changes=expenses.map(t=>{const before=structuredClone(t);t.paymentDate=f.get("paymentDate");t.paymentStatus=f.get("status");return{before,after:structuredClone(t)}});logActivity("bulk",`Pagamento previsto definido em ${expenses.length} gasto(s)`,`Data ${fmtDate(f.get("paymentDate"))} · ${f.get("status")==="paid"?"já pago":"previsto"} · ${expenses.slice(0,3).map(t=>t.description).join(", ")}${expenses.length>3?"…":""}`,"",{changes});selectedTxIds.clear();closeModal();save();toast(`Pagamento previsto aplicado a ${expenses.length} gasto(s)`) };
}

// Remove a previsão de pagamento dos gastos selecionados (volta para a data da compra, como pago).
function clearBulkPaymentDate(){
  const expenses=[...selectedTxIds].map(id=>data.transactions.find(t=>t.id===id)).filter(t=>t?.type==="expense");
  if(!expenses.length){toast("Selecione pelo menos um gasto.");return}
  const changes=expenses.map(t=>{const before=structuredClone(t);t.paymentDate=t.date;t.paymentStatus="paid";return{before,after:structuredClone(t)}});logActivity("bulk",`Previsão de pagamento removida de ${expenses.length} gasto(s)`,expenses.slice(0,3).map(t=>t.description).join(", ")+(expenses.length>3?"…":""),"",{changes});selectedTxIds.clear();save();toast("Previsão de pagamento removida");
}

// Exclui de uma vez todos os lançamentos selecionados, com confirmação e opção de desfazer.
async function bulkDelete(){
  const items=[...selectedTxIds].map(id=>data.transactions.find(t=>t.id===id)).filter(Boolean);
  if(!items.length)return;
  if(!(await askConfirm(`Excluir ${items.length} lançamento(s) selecionado(s)? Logo depois você poderá desfazer.`,{title:"Excluir lançamentos",okText:"Excluir",danger:true})))return;
  const ids=new Set(items.map(t=>t.id));
  data.transactions=data.transactions.filter(t=>!ids.has(t.id));
  logActivity("delete",`${items.length} lançamento(s) excluído(s) de uma vez`,items.slice(0,3).map(t=>t.description).join(", ")+(items.length>3?"…":""),"",{changes:items.map(t=>({before:structuredClone(t),after:null}))});
  lastDeleted=items;
  selectedTxIds.clear();
  save();
  showToast(`${items.length} lançamento(s) excluído(s)`,"Desfazer",undoDelete);
}
