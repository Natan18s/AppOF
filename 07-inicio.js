/* ===== demo.js ===== */
// ====================================================================
// demo.js — Modo demonstração
// Troca os seus dados por dados FICTÍCIOS de exemplo (para mostrar o app sem expor a vida financeira).
// Os dados reais ficam guardados à parte (DEMO_STASH_KEY) e voltam quando você sai da demonstração.
// ====================================================================

// Gerador de números repetível (mesma "sorte" sempre), para a demonstração ser igual a cada vez.
function demoRandom(seed){ let x=seed; return ()=>{ x=(x*1664525+1013904223)%4294967296; return x/4294967296; }; }

// Monta um conjunto completo de dados fictícios: 6 meses de entradas, gastos, compra em várias parcelas no crédito, divisão com amigos, empréstimo, recorrentes e orçamentos.
function buildDemoData(now=today()){
  const prev=data;
  const d=structuredClone(defaultData);
  d.people=[{id:"self",name:"Você"},{id:"ana",name:"Ana"},{id:"joao",name:"João"}];
  d.cards=[{id:"nubank",name:"Nubank",limit:3000,closing:10,due:19},{id:"picpay",name:"PicPay",limit:1500,closing:10,due:19}];
  d.rules=[{id:"r1",keyword:"uber",category:"Transporte"},{id:"r2",keyword:"mercado",category:"Casa"},{id:"r3",keyword:"farmácia",category:"Saúde"}];
  d.budgets={Casa:2500,Lazer:280,Transporte:250,Saúde:70};   // mistura de situações: ok, atenção e estourado
  d.recurring=[
    {id:"rc-sal",type:"income",description:"Salário",value:4500,day:5,startMonth:shiftMonthStr(now.slice(0,7),-5),endMonth:"",method:"",cardId:"",category:"",active:true,generated:[],createdAt:1},
    {id:"rc-alu",type:"expense",description:"Aluguel",value:1200,day:8,startMonth:shiftMonthStr(now.slice(0,7),-5),endMonth:"",method:"pix",cardId:"",category:"Casa",active:true,generated:[],createdAt:2},
    {id:"rc-net",type:"expense",description:"Netflix",value:39.9,day:15,startMonth:shiftMonthStr(now.slice(0,7),-5),endMonth:"",method:"credit",cardId:"nubank",category:"Lazer",active:true,generated:[],createdAt:3}
  ];
  data=d;   // as funções de montagem leem o "data" global; devolvemos o original no final
  try{
    generateRecurring(now);
    const rnd=demoRandom(7), cur=now.slice(0,7);
    const mk=(date,description,value,category,method,extra={})=>{
      const credit=isCreditMethod(method), cardId=credit?(extra.cardId||"nubank"):"";
      const t={id:uid(),createdAt:Date.now()+d.transactions.length,type:"expense",date,description,value,method,cardId,
        paymentDate:credit?nextCardPaymentDate(cardId,date):date,paymentStatus:(credit||date>now)?"planned":"paid",
        splits:extra.splits||[{id:uid(),category,amount:value,ownerId:"self",reimbursed:false}],installments:extra.installments||1,installmentNo:extra.installmentNo||1};
      d.transactions.push(t); return t;
    };
    const money=(min,max)=>Math.round((min+rnd()*(max-min))*100)/100;
    for(let i=-5;i<=0;i++){
      const m=shiftMonthStr(cur,i), day=n=>shiftMonthDate(m,n,0);
      mk(day(3),"Mercado",money(180,320),"Casa","pix");
      mk(day(12),"Mercado",money(150,260),"Casa","debit");
      mk(day(22),"Mercado",money(120,240),"Casa","pix");
      for(const n of [4,9,17,25]) mk(day(n),"Uber",money(14,42),"Transporte","credit",{cardId:"picpay"});
      mk(day(11),"Restaurante",money(55,120),"Lazer","credit");
      mk(day(20),"Cinema",money(40,70),"Lazer","credit");
      mk(day(14),"Farmácia",money(25,90),"Saúde","pix");
      mk(day(1),"Conta de luz",money(90,150),"Contas","pix");
      mk(day(6),"Internet",99.9,"Contas","pix");
    }
    // Uma compra parcelada (celular, 6x) começando há 3 meses
    const start=shiftMonthStr(cur,-3), per=200;
    for(let k=1;k<=6;k++){
      const date=shiftMonthDate(start,10,k-1), pay=shiftMonthDate(shiftMonthStr(start,k),19,0);
      const t=mk(date,"Celular novo",per,"Compras","credit",{installments:6,installmentNo:k});
      t.paymentDate=pay; t.paymentStatus=pay>now?"planned":"paid";
    }
    // Um jantar dividido com amigos (parte da Ana já devolvida, a do João ainda pendente)
    mk(shiftMonthDate(cur,5,0),"Jantar com amigos",240,"Lazer","pix",{splits:[
      {id:uid(),category:"Lazer",amount:80,ownerId:"self",reimbursed:false},
      {id:uid(),category:"Lazer",amount:80,ownerId:"ana",reimbursed:true},
      {id:uid(),category:"Lazer",amount:80,ownerId:"joao",reimbursed:false}]});
    // Um empréstimo cedido ao João
    mk(shiftMonthDate(shiftMonthStr(cur,-1),18,0),"Empréstimo ao João",300,LOAN_CATEGORY,"pix",{splits:[{id:uid(),category:LOAN_CATEGORY,amount:300,ownerId:"joao",reimbursed:false}]});
    d.transactions=d.transactions.map(normalizeTransaction);
    d.activityLog=[{id:uid(),at:Date.now(),kind:"import",text:"Dados de demonstração carregados",detail:"Tudo aqui é fictício",txId:""}];
  } finally { data=prev; }
  d.demoMode=true;
  return d;
}

// Está no modo demonstração agora?
function isDemoMode(){ return !!(data&&data.demoMode); }

// Faixa no topo avisando que os dados são fictícios, com o botão de sair.
function renderDemoBanner(){
  const b=$("demoBanner"); if(!b) return;
  b.classList.toggle("hidden",!isDemoMode());
  b.innerHTML=isDemoMode()?'<span>🧪 <b>Modo demonstração</b> — os dados são fictícios. Seus dados reais estão guardados e voltam ao sair.</span><button type="button" class="btn" id="exitDemoBtn">Sair da demonstração</button>':"";
  if(isDemoMode()) $("exitDemoBtn").onclick=exitDemo;
  const start=$("startDemo"), exit=$("exitDemo");
  if(start) start.classList.toggle("hidden",isDemoMode());
  if(exit) exit.classList.toggle("hidden",!isDemoMode());
}

// Ativa a demonstração: guarda os dados reais à parte e carrega os fictícios.
async function startDemo(){
  if(isDemoMode()){ askAlert("Você já está no modo demonstração."); return; }
  const ok=await askConfirm("O app vai mostrar dados fictícios de exemplo. Os seus dados reais ficam guardados à parte e voltam quando você sair da demonstração. O que você mexer na demonstração não afeta os seus dados.",{title:"Ativar modo demonstração",okText:"Ativar"});
  if(!ok) return;
  try{ localStorage.setItem(DEMO_STASH_KEY,JSON.stringify(data)); }
  catch(e){ askAlert("Não há espaço para guardar seus dados reais com segurança, então a demonstração não foi ativada. Faça um backup e tente de novo."); return; }
  data=buildDemoData();
  selectedTxIds.clear();
  setMonth(today().slice(0,7));   // desenha tudo
  save();switchTab("dashboard");toast("Modo demonstração ativado");
}

// Sai da demonstração e devolve os dados reais (ou um app vazio, se não havia nada guardado).
async function exitDemo(){
  const raw=localStorage.getItem(DEMO_STASH_KEY);
  const ok=await askConfirm(raw?"Sair da demonstração e voltar aos seus dados reais?":"Sair da demonstração? Não há dados reais guardados, então o app volta vazio.",{title:"Sair da demonstração",okText:"Sair",danger:!raw});
  if(!ok) return;
  if(raw){ localStorage.setItem(DB_KEY,raw); } else { localStorage.removeItem(DB_KEY); }
  localStorage.removeItem(DEMO_STASH_KEY);
  data=loadData();
  selectedTxIds.clear();
  setMonth(today().slice(0,7));
  save();switchTab("dashboard");toast("Você voltou aos seus dados");
}

// Cartão de boas-vindas do Resumo: aparece só enquanto não há nenhum lançamento (e fora da demonstração).
function renderWelcomeCard(el,prefix,visible,emptyState=false){
  if(!el)return;
  el.classList.toggle("hidden",!visible);
  if(!visible){el.innerHTML="";return}
  const demo=isDemoMode();
  const intro=emptyState?"Ainda não há lançamentos. Comece registrando o primeiro gasto ou entrada. Se quiser só conhecer o app, veja-o com dados de exemplo.":"Registre um gasto ou uma entrada, ou explore o app com dados fictícios de exemplo.";
  el.innerHTML=`<h2>👋 Bem-vindo ao Meu Controle!</h2><p class="muted">${intro} ${demo?"Você está vendo dados fictícios; seus dados reais ficam guardados.":"Seus dados reais ficam guardados e voltam ao sair da demonstração."}</p><div class="row-actions"><button class="btn primary" id="${prefix}Expense">Registrar gasto</button><button class="btn" id="${prefix}Income">Registrar entrada</button><button class="btn" id="${prefix}Demo">${demo?"Sair dos dados de exemplo":"Ver com dados de exemplo"}</button></div>`;
  $(`${prefix}Expense`).onclick=()=>openTransactionModal("expense");
  $(`${prefix}Income`).onclick=()=>openTransactionModal("income");
  $(`${prefix}Demo`).onclick=demo?exitDemo:startDemo;
}

function renderWelcome(){
  renderWelcomeCard($("welcomeCard"),"welcome",!isDemoMode()&&data.transactions.length===0,true);
  renderWelcomeCard($("tutorialWelcomeCard"),"tutorialWelcome",true);
}

;

;
/* ===== bloqueio.js ===== */
// ====================================================================
// bloqueio.js — bloqueio do app por PIN (4 a 8 números)
// O PIN NÃO fica guardado: só um "resumo" (hash PBKDF2 com sal) dele, numa chave própria do localStorage (LOCK_KEY),
// fora dos dados e do backup. Ele impede que outra pessoa ABRA o app neste aparelho; não criptografa os dados guardados no navegador.
// ====================================================================

const LOCK_KEY = "meu-controle-lock";   // {salt, hash, iter, autoSec}
const LOCK_ITER = 150000;               // quantas voltas o PBKDF2 dá (quanto mais, mais difícil de adivinhar por força bruta)
const LOCK_AUTO_OPTIONS = [[0,"Assim que eu sair do app"],[60,"Depois de 1 minuto fora"],[300,"Depois de 5 minutos fora"],[900,"Depois de 15 minutos fora"]];
let lockFails = 0, lockUntil = 0, lockHiddenAt = 0;   // tentativas erradas, até quando está esperando e quando o app saiu da tela

const lockB64 = u8 => btoa(String.fromCharCode(...u8));
const lockUnB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

// O navegador consegue calcular o hash? (precisa de conexão segura: https ou localhost)
function lockSupported(){ return typeof crypto !== "undefined" && !!crypto.subtle; }

// "Resumo" do PIN com um sal (texto aleatório) usando PBKDF2-SHA256.
async function lockHash(pin, saltB64, iter = LOCK_ITER){
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: lockUnB64(saltB64), iterations: iter, hash: "SHA-256" }, key, 256);
  return lockB64(new Uint8Array(bits));
}

// Configuração do bloqueio guardada (ou null se não há PIN).
function lockConfig(){ try{ return JSON.parse(localStorage.getItem(LOCK_KEY) || "null"); }catch{ return null; } }
function lockEnabled(){ const c = lockConfig(); return !!(c && c.hash); }
const lockPinValid = pin => /^\d{4,8}$/.test(pin);

// Grava um PIN novo (com sal novo). autoSec = segundos fora do app até bloquear.
async function setPin(pin, autoSec){
  const salt = lockB64(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await lockHash(pin, salt);
  localStorage.setItem(LOCK_KEY, JSON.stringify({ salt, hash, iter: LOCK_ITER, autoSec: Number(autoSec) || 0 }));
}

// O PIN digitado confere? (true também quando não há PIN)
async function checkPin(pin){
  const c = lockConfig(); if(!c) return true;
  return (await lockHash(pin, c.salt, c.iter)) === c.hash;
}

// Mostra a tela de bloqueio e esconde o app.
function lockNow(){
  if(!lockEnabled()) return;
  document.documentElement.classList.add("locked");
  $("lockPin").value = ""; $("lockMsg").textContent = "";
  setTimeout(() => $("lockPin").focus(), 60);
}

// Tenta abrir com o PIN digitado. Depois de 5 erros seguidos, espera um pouco (30 s, 60 s...) antes de aceitar outra tentativa.
async function tryUnlock(){
  const msg = t => { $("lockMsg").textContent = t; };
  const wait = Math.ceil((lockUntil - Date.now()) / 1000);
  if(wait > 0){ msg(`Muitas tentativas. Aguarde ${wait} s.`); return; }
  const pin = $("lockPin").value; if(!pin) return;
  let ok = false;
  try{ ok = await checkPin(pin); }catch{ msg("Este navegador não consegue verificar o PIN. Abra o app pelo endereço https."); return; }
  $("lockPin").value = "";
  if(ok){ lockFails = 0; document.documentElement.classList.remove("locked"); msg(""); return; }
  lockFails++;
  if(lockFails >= 5){ lockUntil = Date.now() + 30000 * Math.min(8, lockFails - 4); msg(`PIN incorreto. Aguarde ${Math.ceil((lockUntil - Date.now()) / 1000)} s para tentar de novo.`); }
  else msg(`PIN incorreto (${lockFails} de 5).`);
  $("lockPin").focus();
}

// Esqueci o PIN: não existe recuperação (não há conta). A saída é apagar os dados do aparelho e restaurar um backup.
async function forgotPin(){
  const ok = await askConfirm("Sem o PIN não dá para abrir os dados deste aparelho. A única saída é APAGAR tudo e remover o PIN; depois você pode restaurar um backup, se tiver um. Quer apagar tudo?", { title: "Esqueci o PIN", okText: "Apagar tudo", danger: true });
  if(!ok) return;
  localStorage.removeItem(DB_KEY); localStorage.removeItem(DEMO_STASH_KEY); localStorage.removeItem(LOCK_KEY);
  location.reload();
}

// Painel para ativar, alterar ou desativar o PIN. mode: "set" | "change" | "off".
function openPinModal(mode){
  const needCur = mode !== "set", needNew = mode !== "off";
  const field = (name, label, ac) => `<div><label>${label}</label><input name="${name}" type="password" inputmode="numeric" maxlength="8" autocomplete="${ac}" required></div>`;
  openModal(mode === "set" ? "Ativar PIN" : mode === "change" ? "Alterar PIN" : "Desativar PIN", `<form id="pinForm" class="form-grid" autocomplete="off">
    ${needCur ? field("cur", "PIN atual", "off") : ""}
    ${needNew ? field("p1", "Novo PIN (4 a 8 números)", "new-password") + field("p2", "Repetir o PIN", "new-password") : ""}
    ${mode === "set" ? `<div class="full"><label>Bloquear quando eu sair do app</label><select name="auto">${LOCK_AUTO_OPTIONS.map(([s, t]) => `<option value="${s}" ${s === 60 ? "selected" : ""}>${t}</option>`).join("")}</select></div>` : ""}
    <div class="full field-note">${mode === "set" ? "Anote o PIN: não existe recuperação. Se esquecer, só apagando os dados do aparelho (restaure um backup depois)." : mode === "off" ? "O app volta a abrir direto, sem PIN." : "O novo PIN substitui o atual."}</div>
    <div class="full row-actions end"><button type="button" class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary">Salvar</button></div>
  </form>`);
  $("pinForm").onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target);
    if(needCur && !(await checkPin(f.get("cur") || ""))){ askAlert("PIN atual incorreto."); return; }
    if(needNew){
      if(!lockPinValid(f.get("p1"))){ askAlert("O PIN precisa ter de 4 a 8 números."); return; }
      if(f.get("p1") !== f.get("p2")){ askAlert("Os dois PINs não são iguais."); return; }
      await setPin(f.get("p1"), mode === "set" ? f.get("auto") : (lockConfig()?.autoSec ?? 60));
    } else localStorage.removeItem(LOCK_KEY);
    closeModal(); renderLockSettings();
    toast(mode === "off" ? "PIN desativado" : mode === "set" ? "PIN ativado" : "PIN alterado");
  };
}

// Card "Segurança" da aba Importar.
function renderLockSettings(){
  const box = $("lockSettings"); if(!box) return;
  if(!lockSupported()){ box.innerHTML = '<p class="muted">Este navegador não permite o bloqueio por PIN (precisa de conexão segura, https).</p>'; return; }
  const c = lockConfig();
  if(!c || !c.hash){
    box.innerHTML = '<p class="muted">O app abre direto, sem PIN.</p><div class="row-actions"><button class="btn primary" id="lockOn">Ativar PIN</button></div>';
    $("lockOn").onclick = () => openPinModal("set");
    return;
  }
  box.innerHTML = `<p class="muted">🔒 PIN ativo.</p><label for="lockAuto">Bloquear quando eu sair do app</label><select id="lockAuto">${LOCK_AUTO_OPTIONS.map(([s, t]) => `<option value="${s}" ${s === (c.autoSec ?? 60) ? "selected" : ""}>${t}</option>`).join("")}</select>
    <div class="row-actions" style="margin-top:10px"><button class="btn primary" id="lockNowBtn">Bloquear agora</button><button class="btn" id="lockChange">Alterar PIN</button><button class="btn ghost" id="lockOff">Desativar</button></div>`;
  $("lockAuto").onchange = e => { const cfg = lockConfig(); cfg.autoSec = Number(e.target.value); localStorage.setItem(LOCK_KEY, JSON.stringify(cfg)); toast("Salvo"); };
  $("lockNowBtn").onclick = lockNow;
  $("lockChange").onclick = () => openPinModal("change");
  $("lockOff").onclick = () => openPinModal("off");
}

// Liga a tela de bloqueio (chamado uma vez pelo main.js). A classe "locked" já foi posta no <html> pelo script do <head>, antes de qualquer coisa aparecer.
function initLock(){
  const root = document.documentElement;
  if(!lockEnabled()) root.classList.remove("locked");
  $("lockForm").onsubmit = e => { e.preventDefault(); tryUnlock(); };
  $("forgotPin").onclick = forgotPin;
  // Ao sair do app, anota a hora; ao voltar, bloqueia se ficou fora tempo demais.
  document.addEventListener("visibilitychange", () => {
    if(!lockEnabled()) return;
    if(document.visibilityState === "hidden") lockHiddenAt = Date.now();
    else if(lockHiddenAt && (Date.now() - lockHiddenAt) / 1000 >= (lockConfig().autoSec ?? 60)) lockNow();
  });
  renderLockSettings();
  if(root.classList.contains("locked")) setTimeout(() => $("lockPin").focus(), 80);
}

;
/* ===== integridade.js ===== */
// ====================================================================
// integridade.js — "Verificar dados": procura inconsistências nos dados guardados e corrige as que são seguras.
// ====================================================================

const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
const hasExtraDecimals = n => Math.abs(Number(n) - round2(n)) > 1e-9;

// Examina os dados e devolve uma lista de problemas: {level:"fix"|"warn", text}. "fix" = o app corrige sozinho; "warn" = você precisa olhar.
function checkDataIntegrity(){
  const issues = [], add = (level, text) => issues.push({ level, text });
  const cats = new Set(data.categories), people = new Set(data.people.map(p => p.id)), cards = new Set(data.cards.map(c => c.id));
  const seen = new Map(), missingCats = new Set();
  data.transactions.forEach(t => {
    seen.set(t.id, (seen.get(t.id) || 0) + 1);
    const label = `"${t.description || "(sem descrição)"}" (${t.date})`;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(t.date || "")) add("warn", `${label}: data inválida.`);
    if(hasExtraDecimals(t.value)) add("fix", `${label}: valor com mais de 2 casas decimais.`);
    if(t.type !== "expense") return;
    const splits = t.splits || [];
    if(splits.some(s => hasExtraDecimals(s.amount))) add("fix", `${label}: parte da divisão com mais de 2 casas decimais.`);
    const sum = splits.reduce((s, x) => s + Number(x.amount || 0), 0);
    if(Math.abs(sum - Number(t.value)) > 0.005) add("warn", `${label}: a soma das partes (${fmtMoney(sum)}) não é igual ao valor (${fmtMoney(t.value)}). Edite o lançamento.`);
    splits.forEach(s => {
      if(!cats.has(s.category)) missingCats.add(s.category);
      if(!people.has(s.ownerId)) add("warn", `${label}: a pessoa de uma das partes não existe mais.`);
    });
    if(isCreditMethod(t.method) && !cards.has(t.cardId)) add("warn", `${label}: o cartão deste lançamento não existe mais.`);
  });
  [...seen].filter(([, n]) => n > 1).forEach(([id]) => add("warn", `Há ${seen.get(id)} lançamentos com o mesmo identificador (${id.slice(0, 8)}…).`));
  (data.recurring || []).forEach(r => {
    if(r.type === "expense" && !cats.has(r.category)) missingCats.add(r.category);
    if(r.type === "expense" && isCreditMethod(r.method) && !cards.has(r.cardId)) add("warn", `Recorrente "${r.description}": o cartão não existe mais.`);
  });
  missingCats.forEach(c => add("fix", `A categoria "${c}" é usada, mas não está na lista de categorias.`));
  Object.keys(data.budgets || {}).filter(c => !cats.has(c)).forEach(c => add("fix", `Há um limite mensal para "${c}", categoria que não existe mais.`));
  return issues;
}

// Corrige o que é seguro: arredonda para 2 casas (só diferenças menores que 1 centavo), recoloca categorias que faltam na lista e remove limites de categorias que não existem. Devolve quantas correções fez.
function fixDataIntegrity(){
  let n = 0;
  data.transactions.forEach(t => {
    const v = round2(t.value); if(v !== t.value && Math.abs(v - t.value) < 0.005){ t.value = v; n++; }
    (t.splits || []).forEach(s => { const a = round2(s.amount); if(a !== s.amount && Math.abs(a - s.amount) < 0.005){ s.amount = a; n++; } });
  });
  const used = new Set();
  data.transactions.forEach(t => (t.splits || []).forEach(s => used.add(s.category)));
  (data.recurring || []).forEach(r => { if(r.type === "expense") used.add(r.category); });
  used.forEach(c => { if(c && !data.categories.includes(c)){ data.categories.push(c); n++; } });
  Object.keys(data.budgets || {}).forEach(c => { if(!data.categories.includes(c)){ delete data.budgets[c]; n++; } });
  return n;
}

// Painel com o resultado da verificação (e o botão de corrigir).
function openIntegrityModal(){
  const issues = checkDataIntegrity(), fixable = issues.filter(i => i.level === "fix").length;
  openModal("Verificar dados", issues.length
    ? `<p class="muted">${issues.length} ponto(s) encontrado(s) em ${data.transactions.length} lançamento(s).</p><div class="integrity-list">${issues.slice(0, 60).map(i => `<div class="integrity-item ${i.level}"><span class="tag">${i.level === "fix" ? "Corrige sozinho" : "Precisa de você"}</span> ${esc(i.text)}</div>`).join("")}${issues.length > 60 ? `<div class="muted">… e mais ${issues.length - 60}.</div>` : ""}</div>
       <div class="row-actions end" style="margin-top:14px"><button class="btn ghost" onclick="closeModal()">Fechar</button>${fixable ? '<button class="btn primary" id="fixIntegrity">Corrigir o que for seguro</button>' : ""}</div>`
    : `<p>✅ Tudo certo: ${data.transactions.length} lançamento(s) verificados, sem inconsistências.</p><div class="row-actions end"><button class="btn primary" onclick="closeModal()">Fechar</button></div>`);
  const b = $("fixIntegrity");
  if(b) b.onclick = () => { const n = fixDataIntegrity(); save(); toast(`${n} correção(ões) feita(s)`); openIntegrityModal(); };
}

;
/* ===== main.js ===== */
// ====================================================================
// main.js — ligações e inicialização
// Liga os botões e campos aos comportamentos e desenha o app. É o ÚLTIMO script carregado.
// ====================================================================

// ----- Tema (claro/escuro) -----
$("themeToggle").onclick=()=>applyTheme(currentTheme()==="dark"?"light":"dark",true);
applyTheme(currentTheme(),false);

// ----- Carrega os dados salvos neste aparelho -----
data = loadData();

// Cria os lançamentos recorrentes que já deveriam existir (aluguel, assinaturas...) e pede ao navegador para guardar os dados com mais cuidado.
if(generateRecurring()){ try{ localStorage.setItem(DB_KEY,JSON.stringify(data)) }catch{} }
requestPersistentStorage();

// ----- Navegação: abas, botões que levam a outra aba e seletor de mês (com setas ‹ ›) -----
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
document.querySelectorAll("[data-tab-link]").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tabLink)));
["dashboardMonth","txMonth","cardsMonth"].forEach(id=>{$(id).value=month;$(id).addEventListener("change",e=>setMonth(e.target.value))});
document.querySelectorAll("[data-month-step]").forEach(b=>b.addEventListener("click",()=>setMonth(shiftMonthStr(month,Number(b.dataset.monthStep)))));

// ----- Aba Lançamentos: busca, filtro, seleção em massa e botões de novo gasto/entrada -----
$("txSearch").addEventListener("input",renderTransactions);
$("txType").addEventListener("change",renderTransactions);
$("selectAllTx").addEventListener("change",toggleSelectAll);
$("quickExpense").onclick=()=>openTransactionModal("expense");
$("quickIncome").onclick=()=>openTransactionModal("income");
$("newExpense").onclick=()=>openTransactionModal("expense");
$("newIncome").onclick=()=>openTransactionModal("income");
$("newCard").onclick=()=>openCardModal();
$("newPerson").onclick=()=>openPersonModal();
$("newRule").onclick=()=>openRuleModal();
$("newCategory").onclick=()=>openCategoryModal();
$("newRecurring").onclick=()=>openRecurringModal();
// Aba Importar: relatórios e modo demonstração
$("exportCsvMonth").onclick=()=>exportCsv("month");
$("exportCsvAll").onclick=()=>exportCsv("all");
$("printReport").onclick=printReport;
$("startDemo").onclick=startDemo;
$("checkData").onclick=openIntegrityModal;
initLock();   // tela de bloqueio por PIN (se ativada)
$("exitDemo").onclick=exitDemo;
// Cards do topo do Resumo: clique (ou Enter/Espaço) abre a lista de lançamentos do card
document.querySelectorAll(".metric[data-metric]").forEach(el=>{
  el.addEventListener("click",()=>showMetricDetail(el.dataset.metric));
  el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();showMetricDetail(el.dataset.metric)}});
});
$("bulkPaymentDate").onclick=()=>openBulkPaymentModal();
$("trendPrev").onclick=()=>shiftTrendWindow(-1);
$("trendNext").onclick=()=>shiftTrendWindow(1);
$("bulkClearPayment").onclick=clearBulkPaymentDate;
$("bulkDelete").onclick=bulkDelete;
$("clearSelection").onclick=()=>{selectedTxIds.clear();renderTransactions()};

// ----- Painel (modal): fechar no ✕, clicando fora ou com Esc -----
$("closeModal").onclick=closeModal;
$("modal").addEventListener("touchmove",e=>{if(e.target.id==="modal")e.preventDefault()},{passive:false});
$("modal").addEventListener("click",e=>{if(e.target.id==="modal")closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape" && !$("modal").classList.contains("hidden")) closeModal()});

// ----- Aba Importar: arquivo, arrastar e soltar, confirmar -----
$("confirmImport").onclick=()=>{
  if(!pendingImport.length){toast("Nada novo para importar.");return}
  const imported=[];
  const addImported=t=>{const transaction=normalizeTransaction(t);data.transactions.push(transaction);imported.push({before:null,after:structuredClone(transaction)})};
  pendingImport.forEach(r=>{
    if(r.isCardPayment){
      addImported({id:uid(),date:r.date,description:r.description,value:r.value,type:"card_payment",cardId:r.cardId,importKey:r.sourceKey});
    }else if(r.isExpense){
      addImported({
        id:uid(),date:r.date,description:r.description,value:r.value,type:"expense",cardId:r.cardId,
        paymentDate:r.paymentDate||r.date,paymentStatus:r.paymentStatus||"paid",
        splits:[{id:uid(),category:r.category||"Outros",amount:r.value,ownerId:"self",reimbursed:false}],
        installments:r.installments||1,installmentNo:r.installmentNo||1,importKey:r.sourceKey
      });
    }else{
      addImported({id:uid(),date:r.date,description:r.description,value:r.value,type:"income",source:"imported-credit",notes:"Crédito importado",importKey:r.sourceKey});
    }
  });
  data.importLog.push({id:uid(),file:selectedImport?.name||"",date:new Date().toISOString(),count:pendingImport.length});
  logActivity("import",`Importação: ${selectedImport?.name||"arquivo"}`,`${pendingImport.length} lançamento(s) novos importados`,"",{changes:imported});
  pendingImport=[];selectedImport=null;$("importPreview").classList.add("hidden");$("selectedFile").textContent="Nenhum arquivo selecionado";save();toast("Importação concluída");
};
$("cancelImport").onclick=()=>{pendingImport=[];$("importPreview").classList.add("hidden")};
$("pickFile").onclick=()=>$("fileInput").click();
$("fileInput").onchange=e=>handleFile(e.target.files[0]);
["dragenter","dragover"].forEach(ev=>$("dropZone").addEventListener(ev,e=>{e.preventDefault();$("dropZone").classList.add("drag")}));
["dragleave","drop"].forEach(ev=>$("dropZone").addEventListener(ev,e=>{e.preventDefault();$("dropZone").classList.remove("drag")}));
$("dropZone").addEventListener("drop",e=>handleFile(e.dataTransfer.files[0]));

// ----- Backup -----
$("exportBackup").onclick=exportBackup;
$("shareBackup").onclick=shareBackup;
$("copyBackupText").onclick=copyBackupText;
$("restoreFromPaste").onclick=restoreFromText;
$("restoreBackup").onclick=()=>$("backupInput").click();
$("backupInput").onchange=restoreBackup;

// ----- Botão voltar do celular: fecha o painel aberto ou volta para a aba anterior -----
history.replaceState({tab:"dashboard"},"");   // entrada inicial do histórico (aba Resumo)
window.addEventListener("popstate",e=>{
  if(ignorePop>0){ ignorePop--; return; }                                  // evento causado pelo próprio app ao fechar o painel ou a caixa de confirmação
  if(closeSelectSheet("pop")) return;                                       // voltar com a lista de escolha aberta: fecha só a lista
  if(closeTopConfirm()) return;                                            // voltar com uma caixa de confirmação aberta: só fecha a caixa (cancela)
  if(!$("modal").classList.contains("hidden")){ closeModal("pop"); return; }   // 1º voltar: fecha o painel aberto
  const tab=(e.state&&e.state.tab)||"dashboard";
  if(tab!==currentTab) switchTab(tab,true);                                // 2º voltar: volta para a aba anterior
});

// ----- Ao voltar para o app (ex.: virou o mês com o app aberto no celular), cria os recorrentes que faltam -----
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible" && generateRecurring()) save(); });

// ----- Início: desenha todas as telas -----
// Start
renderAll();

;
