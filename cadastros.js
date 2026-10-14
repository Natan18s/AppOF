// ====================================================================
// cadastros.js — Cartões, Pessoas, Categorias e Regras (Categorias, Pessoas e Regras aparecem juntas na aba Regras)
// Telas de cadastro e seus painéis de criar/editar/excluir.
// ====================================================================

// Desenha a aba Cartões: compras do mês, pagamento previsto, fechamento, vencimento e limite.
function renderCards(){
  const purchases=txForMonth(month), toPayMonth=scheduledPaymentsForMonth(month);
  $("cardsGrid").innerHTML=data.cards.map(c=>{
    const total=purchases.filter(t=>t.type==="expense"&&t.cardId===c.id).reduce((s,t)=>s+t.value,0);
    const toPay=toPayMonth.filter(t=>t.cardId===c.id).reduce((s,t)=>s+t.value,0);
    const pct=c.limit ? Math.min(100,total/c.limit*100):0;
    return `<article class="card-mini"><h3>${esc(c.name)}</h3><div class="muted">Compras no mês</div><div class="big">${fmtMoney(total)}</div><div class="muted">Pagamento previsto no mês: <b>${fmtMoney(toPay)}</b></div><div class="muted">Fecha dia ${c.closing} · vence dia ${c.due}</div>${c.limit?`<div class="bar-row"><div class="bar-label"><span>Limite</span><span>${fmtMoney(c.limit)}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`:""}<div class="row-actions"><button class="btn" onclick="openCardModal('${c.id}')">Editar</button><button class="btn ghost" onclick="deleteCard('${c.id}')">Excluir</button></div></article>`;
  }).join("");
}

// Lista as pessoas e quanto cada uma ainda te deve.
function renderPeople(){
  const pendingBy={};
  data.transactions.filter(t=>t.type==="expense").forEach(t=>(t.splits||[]).forEach(s=>{
    if(s.ownerId!=="self"&&s.reimbursed!==true) pendingBy[s.ownerId]=(pendingBy[s.ownerId]||0)+Number(s.amount||0);
  }));
  $("peopleList").innerHTML=data.people.map(p=>`<div class="person-card"><div><b>${esc(p.name)}</b><div class="muted">${p.id==="self"?"Você":`A receber: ${fmtMoney(pendingBy[p.id]||0)}`}</div></div>${p.id!=="self"?`<button class="btn ghost" onclick="deletePerson('${p.id}')">Excluir</button>`:""}</div>`).join("");
}

// Lista as regras automáticas palavra → categoria.
function renderRules(){
  $("rulesList").innerHTML=data.rules.length ? data.rules.map(r=>`<div class="rule-row"><div><b>${esc(r.keyword)}</b> → ${esc(r.category)}</div><button class="btn ghost" onclick="deleteRule('${r.id}')">Excluir</button></div>`).join(""):'<div class="empty">Nenhuma regra.</div>';
}

// Sugere a categoria de uma descrição olhando as regras (padrão: Outros).
function applyRule(description){
  const d=description.toLowerCase();
  const rule=data.rules.find(r=>d.includes(r.keyword.toLowerCase()));
  return rule?.category || "Outros";
}

// Lista as categorias (aba Regras). Segure uma categoria e arraste para mudar a ordem; a alça ⠿ arrasta na hora.
// A ordem daqui é a ordem usada nos formulários e na Planilha do mês.
function renderCategories(){
  const box=$("categoriesList");
  box.innerHTML=data.categories.map((c,i)=>`<div class="category-row" data-cat="${esc(c)}"><div class="category-name"><span class="cat-grip" title="Segure e arraste para mudar a ordem" aria-hidden="true">⠿</span><span class="tag">#${i+1}</span><b>${esc(c)}</b>${Number(data.budgets?.[c])>0?`<span class="tag">Limite ${fmtMoney(data.budgets[c])}/mês</span>`:""}</div><div class="row-actions"><button class="btn" onclick="editCategory(${i})">Editar</button><button class="btn ghost" onclick="deleteCategory(${i})">Excluir</button></div></div>`).join("");
  initCategoryDrag(box);   // liga o "segurar e arrastar" nas linhas
}

// ----- Arrastar categorias na lista da aba Regras (mesma ideia da Planilha do mês, em sheet-drag.js) -----
let catDrag=null;   // arrasto em andamento: {name, row, rows, ghost, target, x, y, raf}

// Liga o arrasto às linhas de categoria. Nos botões Editar/Excluir o toque funciona normal.
function initCategoryDrag(root){
  root.querySelectorAll(".category-row[data-cat]").forEach(row=>{
    row.addEventListener("pointerdown",e=>{
      if(e.target.closest("button"))return;
      catPress(e,row,!!e.target.closest(".cat-grip"));   // na alça começa na hora; no resto da linha, só depois de segurar ~0,3 s
    });
    row.addEventListener("contextmenu",e=>e.preventDefault());   // evita o menu do toque longo
  });
}

// Começa o arrasto (na hora ou após segurar). Se o dedo se mexer antes de segurar o tempo todo, é rolagem da tela e cancela.
function catPress(e,row,immediate){
  if(e.pointerType==="mouse"&&e.button!==0)return;
  const id=e.pointerId,sx=e.clientX,sy=e.clientY;
  let active=false;
  const stop=()=>{clearTimeout(timer);document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",up);document.removeEventListener("pointercancel",abort)};
  const start=()=>{active=true;catBegin(row,sx,sy)};
  const timer=immediate?0:setTimeout(start,320);
  const move=ev=>{if(ev.pointerId!==id)return;if(!active){if(Math.hypot(ev.clientX-sx,ev.clientY-sy)>10)stop()}else catMove(ev.clientX,ev.clientY)};
  const up=ev=>{if(ev.pointerId!==id)return;const was=active;stop();if(was)catEnd(true)};
  const abort=ev=>{if(ev.pointerId!==id)return;const was=active;stop();if(was)catEnd(false)};
  document.addEventListener("pointermove",move);
  document.addEventListener("pointerup",up);
  document.addEventListener("pointercancel",abort);
  if(immediate)start();
}

// Impede a rolagem da tela enquanto uma categoria está sendo arrastada.
const catBlockTouch=e=>e.preventDefault();

// Início do arrasto: cria a "sombra" que acompanha o dedo e marca a linha sendo movida.
function catBegin(row,x,y){
  const name=row.dataset.cat;
  const ghost=document.createElement("div");
  ghost.className="sheet-ghost";ghost.textContent="⠿ "+name;document.body.appendChild(ghost);
  catDrag={name,row,rows:[...document.querySelectorAll("#categoriesList .category-row")],ghost,target:null,x,y,raf:0};
  row.classList.add("cat-dragging");
  document.body.classList.add("sheet-drag-on");
  document.addEventListener("touchmove",catBlockTouch,{passive:false});
  if(navigator.vibrate)navigator.vibrate(25);   // vibração curta avisa que pegou
  catMove(x,y);
  catLoop();
}

// Movimento do dedo/mouse: guarda a posição e leva a sombra junto.
function catMove(x,y){
  const d=catDrag;if(!d)return;
  d.x=x;d.y=y;
  d.ghost.style.left=(x+12)+"px";d.ghost.style.top=(y-20)+"px";
}

// Descobre onde a categoria cairia (antes/depois de qual linha) e mostra a linha azul de destino.
function catUpdateTarget(){
  const d=catDrag;if(!d)return;
  d.rows.forEach(r=>r.classList.remove("cat-drop-before","cat-drop-after"));
  let target=null;
  for(const r of d.rows){const b=r.getBoundingClientRect();if(d.y<=b.bottom){target={row:r,pos:d.y<(b.top+b.bottom)/2?"before":"after"};break}}
  if(!target){target={row:d.rows[d.rows.length-1],pos:"after"}}   // abaixo da última categoria
  if(target.row===d.row){d.target=null;return}                    // soltar sobre si mesma não muda nada
  d.target={cat:target.row.dataset.cat,pos:target.pos};
  target.row.classList.add(target.pos==="before"?"cat-drop-before":"cat-drop-after");
}

// Repete a cada quadro: rola a tela sozinha perto das bordas e atualiza o destino.
function catLoop(){
  const d=catDrag;if(!d)return;
  const h=window.innerHeight;
  if(d.y<80)window.scrollBy(0,-Math.ceil((80-d.y)/6));
  else if(d.y>h-80)window.scrollBy(0,Math.ceil((d.y-(h-80))/6));
  catUpdateTarget();
  d.raf=requestAnimationFrame(catLoop);
}

// Fim do arrasto: limpa a tela e, se soltou num destino válido, muda a ordem (moveCategoryTo está em sheet-drag.js e salva).
function catEnd(commit){
  const d=catDrag;if(!d)return;
  catDrag=null;
  cancelAnimationFrame(d.raf);
  d.ghost.remove();
  document.removeEventListener("touchmove",catBlockTouch);
  document.body.classList.remove("sheet-drag-on");
  d.rows.forEach(r=>r.classList.remove("cat-dragging","cat-drop-before","cat-drop-after"));
  if(commit&&d.target)moveCategoryTo(d.name,d.target.cat,d.target.pos);
}

// Painel para criar ou renomear uma categoria (renomear atualiza lançamentos e regras).
function openCategoryModal(index=null){
  const old=index!==null?data.categories[index]:"", limit=Number(data.budgets?.[old])>0?data.budgets[old]:"";
  openModal(index!==null?"Editar categoria":"Nova categoria",`<form id="categoryForm"><label>Nome da categoria</label><input name="name" value="${esc(old)}" placeholder="Ex.: Assinaturas" required>
    <label style="margin-top:12px">Limite mensal (opcional)</label><input name="limit" type="number" min="0" step="0.01" value="${esc(limit)}" placeholder="Ex.: 300">
    <div class="field-note">Com um limite, o Resumo mostra quanto dele você já usou (só o seu gasto) e avisa ao passar de 80% e de 100%. Deixe vazio para não ter limite.</div>
    <div class="row-actions end" style="margin-top:15px"><button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary">Salvar</button></div></form>`);
  $("categoryForm").onsubmit=e=>{
    e.preventDefault();
    const f=new FormData(e.target),name=f.get("name").trim(),newLimit=Math.round((Number(f.get("limit"))||0)*100)/100;
    if(!name)return;
    if(data.categories.some((c,i)=>c.toLowerCase()===name.toLowerCase()&&i!==index)){askAlert("Essa categoria já existe.");return}
    if(index===null)data.categories.push(name);
    else{
      const oldName=data.categories[index];
      data.categories[index]=name;
      data.rules.forEach(r=>{if(r.category===oldName)r.category=name});
      (data.recurring||[]).forEach(r=>{if(r.category===oldName)r.category=name});
      data.transactions.forEach(t=>(t.splits||[]).forEach(s=>{if(s.category===oldName)s.category=name}));
      if(oldName!==name)delete data.budgets[oldName];   // o limite é regravado abaixo com o nome novo
    }
    if(newLimit>0)data.budgets[name]=newLimit;else delete data.budgets[name];
    closeModal();save();toast("Categoria salva");
  };
}

// Atalho para editar a categoria de posição i.
function editCategory(i){openCategoryModal(i)}

// Exclui uma categoria, se nenhum lançamento a estiver usando.
async function deleteCategory(i){const name=data.categories[i];if(data.transactions.some(t=>(t.splits||[]).some(s=>s.category===name))||(data.recurring||[]).some(r=>r.category===name)){askAlert("Essa categoria está sendo usada em lançamentos ou em recorrentes. Edite-os ou mova-os para outra categoria antes de excluir.");return}if(await askConfirm(`Excluir a categoria "${name}"?`,{title:"Excluir categoria",okText:"Excluir",danger:true})){data.categories.splice(i,1);delete data.budgets[name];save();toast("Categoria excluída")}}

// Painel para criar ou editar um cartão.
function openCardModal(id=null){
  const c=id?data.cards.find(x=>x.id===id):{name:"",limit:0,closing:10,due:19};
  openModal(id?"Editar cartão":"Novo cartão",`<form id="cardForm" class="form-grid">
    <div class="full"><label>Nome</label><input name="name" value="${esc(c.name)}" required></div>
    <div><label>Limite</label><input name="limit" type="number" min="0" step=".01" value="${c.limit||0}"></div>
    <div><label>Fechamento</label><input name="closing" type="number" min="1" max="31" value="${c.closing||10}"></div>
    <div><label>Vencimento</label><input name="due" type="number" min="1" max="31" value="${c.due||19}"></div>
    <div class="full row-actions end"><button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary">Salvar</button></div>
  </form>`);
  $("cardForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),obj={id:id||uid(),name:f.get("name"),limit:Number(f.get("limit")||0),closing:Number(f.get("closing")),due:Number(f.get("due"))};if(id)data.cards=data.cards.map(x=>x.id===id?obj:x);else data.cards.push(obj);closeModal();save();toast("Cartão salvo")};
}

// Exclui um cartão, se não houver lançamentos nele.
async function deleteCard(id){if(data.transactions.some(t=>t.cardId===id)){askAlert("Este cartão possui lançamentos. Exclua ou mova os lançamentos antes de remover o cartão.");return}if(await askConfirm("Excluir este cartão?",{title:"Excluir cartão",okText:"Excluir",danger:true})){data.cards=data.cards.filter(c=>c.id!==id);save()}}

// Painel para cadastrar uma pessoa nas divisões.
function openPersonModal(){
  openModal("Nova pessoa",`<form id="personForm"><label>Nome</label><input name="name" placeholder="Ex.: João" required><div class="row-actions end" style="margin-top:15px"><button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary">Salvar</button></div></form>`);
  $("personForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);data.people.push({id:uid(),name:f.get("name")});closeModal();save();toast("Pessoa adicionada")};
}

// Exclui uma pessoa, se não estiver ligada a lançamentos.
async function deletePerson(id){if(data.transactions.some(t=>(t.splits||[]).some(s=>s.ownerId===id))){askAlert("Esta pessoa está vinculada a lançamentos.");return}if(await askConfirm("Excluir esta pessoa?",{title:"Excluir pessoa",okText:"Excluir",danger:true})){data.people=data.people.filter(p=>p.id!==id);save()}}

// Painel para criar uma regra automática de categoria.
function openRuleModal(){
  openModal("Nova regra automática",`<form id="ruleForm" class="form-grid"><div><label>Palavra ou trecho</label><input name="keyword" placeholder="ex.: uber" required></div><div><label>Categoria</label><select name="category">${data.categories.map(c=>`<option>${esc(c)}</option>`).join("")}</select></div><div class="full row-actions end"><button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary">Salvar</button></div></form>`);
  $("ruleForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);data.rules.push({id:uid(),keyword:f.get("keyword"),category:f.get("category")});closeModal();save();toast("Regra criada")};
}

// Exclui uma regra automática.
async function deleteRule(id){if(await askConfirm("Excluir esta regra?",{title:"Excluir regra",okText:"Excluir",danger:true})){data.rules=data.rules.filter(r=>r.id!==id);save()}}
