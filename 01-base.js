/* ===== utils.js ===== */
// ====================================================================
// utils.js — funções auxiliares
// Pequenas funções usadas em todo o app: formatar dinheiro/datas, escapar texto, gerar ids.
//  Não dependem dos dados do app.
// ====================================================================

// Atalho para document.getElementById: $("idDoElemento").
const $ = id => document.getElementById(id);

// Formata um número como moeda brasileira (ex.: R$ 1.234,56).
const fmtMoney = n => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n)||0);

// Escapa caracteres especiais do texto antes de colocá-lo em HTML (evita quebrar a tela ou injetar código).
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Gera um identificador único para cada lançamento, pessoa, regra, divisão etc.
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2));

// Converte uma data do JavaScript em texto AAAA-MM-DD usando o fuso do aparelho (e não o UTC).
function localISO(d){ return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10); }

// Data de hoje no formato AAAA-MM-DD.
const today = () => localISO(new Date());

// Mostra uma data AAAA-MM-DD no formato brasileiro DD/MM/AAAA.
const fmtDate = d => new Date(d+"T12:00:00").toLocaleDateString("pt-BR");

// Soma ou subtrai meses de um texto AAAA-MM. Usado pelas setas ‹ › do seletor de mês.
function shiftMonthStr(m,delta){const [y,mo]=m.split("-").map(Number);const d=new Date(y,mo-1+delta,1);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")}

// Transforma AAAA-MM em MM/AAAA (ex.: 2026-10 vira 10/2026).
const fmtMonthLabel=m=>m.slice(5,7)+"/"+m.slice(0,4);

// Nomes curtos dos meses, usados na prévia das parcelas.
const MONTHS_PT=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

// Ordenação dos lançamentos: do mais novo para o mais antigo (desempata pela hora em que foi criado).
const byNewest=(a,b)=>b.date.localeCompare(a.date)||(b.createdAt||0)-(a.createdAt||0);

// Devolve a data (dia fixo) N meses depois do mês informado. Respeita meses curtos: 31/02 vira o último dia de fevereiro.
function shiftMonthDate(firstMonth, day, offset){
  const [y,m]=firstMonth.split("-").map(Number);
  const last=new Date(y,m+offset,0).getDate();   // último dia do mês alvo (evita 31/02 virar março)
  return localISO(new Date(y,m-1+offset,Math.min(Number(day)||1,last)));
}

;
/* ===== config.js ===== */
// ====================================================================
// config.js — constantes e estado global
// Valores fixos (categoria de empréstimo, formas de pagamento...) e as variáveis que guardam o estado do app.
//  Este arquivo precisa vir depois de utils.js.
// ====================================================================

// Chave do localStorage onde todos os dados do app ficam guardados no aparelho.

const DB_KEY = "meu-controle-v2";

// Versão do formato dos dados salvos.
const APP_VERSION = 2;

// Dados iniciais de um app novo: pessoas, cartões, categorias e regras de exemplo.
const defaultData = {
  version: APP_VERSION,
  transactions: [],
  people: [{id:"self", name:"Você"}],
  cards: [
    {id:"nubank", name:"Nubank", limit:0, closing:10, due:19},
    {id:"picpay", name:"PicPay", limit:0, closing:10, due:19}
  ],
  // Categorias padrão, já em ordem alfabética (na aba Categorias dá para mudar a ordem com ▲ ▼)
  categories: ["Cartão de Crédito Nubank","Cartão de Crédito Picpay","Casa","Compras","Contas","Doações","Educação","Empréstimos cedidos","Investimentos","Lazer","Outros","Saúde","Transporte","Você"],
  categoriesV2: true,   // marca que as categorias padrão novas já foram aplicadas (evita recriar categorias que você excluir)
  rules: [
    {id:"r1", keyword:"uber", category:"Transporte"},
    {id:"r2", keyword:"99", category:"Transporte"},
    {id:"r3", keyword:"posto", category:"Transporte"},
    {id:"r4", keyword:"mercado", category:"Casa"}
  ],
  importLog: [],
  activityLog: [],
  lastBackupAt: null,
  budgets: {},      // limite mensal por categoria: {"Lazer": 300, ...} (definido ao criar/editar a categoria)
  recurring: []     // modelos de lançamentos recorrentes (aluguel, assinaturas, salário...)
};

// Chave onde ficam guardados, só durante o Modo demonstração, os seus dados reais (para devolvê-los ao sair da demonstração).
const DEMO_STASH_KEY = "meu-controle-v2-real";

// Todos os dados do app em memória (lançamentos, pessoas, cartões, categorias, regras, histórico).
let data;

// Arquivo escolhido na aba Importar.
let selectedImport = null;

// Linhas lidas do arquivo que aguardam a confirmação do usuário.
let pendingImport = [];

// Ids dos lançamentos marcados na coluna "Selecionar" da aba Lançamentos.
let selectedTxIds = new Set();

// Mês que está sendo visto no app (AAAA-MM). Todas as abas usam este mês.
let month = localISO(new Date()).slice(0,7);

let cashFilter = "all";   // filtro do fluxo de caixa: all | paid | pending

let lastDeleted = null;   // guarda o último lançamento excluído, para o "Desfazer"

// Nome da categoria especial usada para dinheiro emprestado a outras pessoas.
const LOAN_CATEGORY = "Empréstimos cedidos";   // categoria especial: dinheiro emprestado a alguém

// Ícone de cada tipo de atividade mostrado em "Últimos lançamentos".
const ACTIVITY_ICONS={create:"➕",edit:"✏️",delete:"🗑️",paid:"✅",unpaid:"↩️",received:"💰",import:"📥",restore:"♻️",bulk:"📅",undo:"↶"};

// Formas de pagamento disponíveis no formulário de gasto.
const METHODS={pix:"Pix",debit:"Débito",cash:"Dinheiro",credit:"Crédito",installment:"Parcelado"};

// Diz se a forma de pagamento usa cartão de crédito (crédito ou parcelado).
const isCreditMethod=m=>m==="credit"||m==="installment";

// Controles do formulário de gasto: indicam se o usuário já mexeu em divisão, vencimento, 1º mês ou status (para o app parar de preencher sozinho).
let autoSplit=false, payTouched=false, firstMonthTouched=false, statusTouched=false;

;
/* ===== theme.js ===== */
// ====================================================================
// theme.js — tema claro/escuro
// O app abre sempre no tema claro. A escolha do usuário fica guardada à parte dos dados (não entra no backup).
// ====================================================================

// ===== Tema claro / escuro (guardado à parte dos dados, não entra no backup) =====
const THEME_KEY="meu-controle-theme";

// Devolve o tema em uso: "light" ou "dark".
function currentTheme(){ return document.documentElement.dataset.theme==="dark"?"dark":"light"; }

// Aplica o tema (troca as cores, o ícone/texto do botão e a cor da barra do navegador). Se persist=true, lembra a escolha neste aparelho.
function applyTheme(t,persist){
  document.documentElement.dataset.theme=t;
  if(persist){ try{localStorage.setItem(THEME_KEY,t)}catch{} }
  const meta=document.querySelector('meta[name="theme-color"]'); if(meta) meta.content=t==="dark"?"#000000":"#f2f2f7";
  $("themeIcon").textContent=t==="dark"?"☀️":"🌙";
  $("themeLabel").textContent=t==="dark"?"Claro":"Escuro";
  const b=$("themeToggle"), txt=t==="dark"?"Mudar para o modo claro":"Mudar para o modo escuro";
  b.title=txt; b.setAttribute("aria-label",txt);
}

;
/* ===== calculations.js ===== */
// ====================================================================
// calculations.js — cálculos financeiros
// Funções que apenas CALCULAM a partir de data (entradas, gastos do mês, empréstimos, vencimentos). Não mexem na tela.
// ====================================================================

// Lançamentos cuja data (compra ou entrada) cai no mês informado.
function txForMonth(m){return data.transactions.filter(t=>t.date.slice(0,7)===m);}

// Parte do gasto que é realmente sua (divisões atribuídas a "Você").
function ownAmount(t){ if(t.type!=="expense") return 0; return (t.splits||[]).filter(s=>s.ownerId==="self").reduce((s,x)=>s+Number(x.amount||0),0); }

// Quanto de um gasto outras pessoas ainda te devem (partes não reembolsadas).
function receivableAmount(t){ if(t.type!=="expense") return 0; return (t.splits||[]).filter(s=>s.ownerId!=="self" && s.reimbursed!==true).reduce((s,x)=>s+Number(x.amount||0),0); }

// Partes de um gasto que pertencem à categoria de empréstimos cedidos.
function loanSplits(t){ return (t.splits||[]).filter(s=>s.category===LOAN_CATEGORY); }

// Dinheiro que outras pessoas ainda te devem de empréstimos, com pagamento previsto no mês m (é uma incógnita: pode não vir)
function loanReceivableForMonth(m){
  let sum=0;
  data.transactions.filter(t=>t.type==="expense" && (t.paymentDate||t.date).slice(0,7)===m).forEach(t=>{
    loanSplits(t).forEach(s=>{ if(s.ownerId!=="self" && s.reimbursed!==true) sum+=Number(s.amount||0); });
  });
  return sum;
}

// Dinheiro novo emprestado a outras pessoas no mês (saída de caixa)
function loanGivenForMonth(m){
  let sum=0;
  scheduledPaymentsForMonth(m).forEach(t=>loanSplits(t).forEach(s=>sum+=Number(s.amount||0)));
  return sum;
}

// Entradas do mês separadas por origem: salário/normal, devolução de empréstimo, outros reembolsos
function incomeBreakdownForMonth(m){
  const inc=txForMonth(m).filter(t=>t.type==="income");
  const loan=inc.filter(t=>t.sourceCategory===LOAN_CATEGORY).reduce((s,t)=>s+t.value,0);
  const reimb=inc.filter(t=>t.source==="reimbursement" && t.sourceCategory!==LOAN_CATEGORY).reduce((s,t)=>s+t.value,0);
  const total=inc.reduce((s,t)=>s+t.value,0);
  return {normal:total-loan-reimb, loan, reimb, total};
}

// Gastos cujo PAGAMENTO previsto cai no mês. É esta data (e não a da compra) que manda no Resumo.
function scheduledPaymentsForMonth(m){return data.transactions.filter(t=>t.type==="expense" && (t.paymentDate||t.date).slice(0,7)===m);}

// Calcula o próximo vencimento do cartão a partir do dia do fechamento.
function nextCardPaymentDate(cardId, baseDate=today()){
  const card=data.cards.find(c=>c.id===cardId);
  if(!card) return baseDate;
  const d=new Date(baseDate+"T12:00:00");
  let y=d.getFullYear(), m=d.getMonth();
  if(d.getDate()>=Number(card.closing||31)) m+=1;
  let day=Math.min(Number(card.due||1), new Date(y,m+1,0).getDate());
  return localISO(new Date(y,m,day));
}

// Classifica uma entrada: normal, devolução de empréstimo (loan) ou outro reembolso (reimb).
function incomeOrigin(t){
  if(t.source!=="reimbursement") return "normal";
  return t.sourceCategory===LOAN_CATEGORY ? "loan" : "reimb";
}

// Crédito/Parcelado: vencimento do cartão no MÊS SEGUINTE ao da compra
function nextMonthPaymentDate(cardId,baseDate){
  const card=data.cards.find(c=>c.id===cardId);
  const d=new Date((baseDate||today())+"T12:00:00");
  const y=d.getFullYear(), m=d.getMonth()+1;
  const day=Math.min(Number(card?.due)||d.getDate(), new Date(y,m+1,0).getDate());
  return localISO(new Date(y,m,day));
}

// ====================================================================
// Séries, categorias e orçamentos (usados pelos gráficos do Resumo)
// ====================================================================

// Resumo dos últimos n meses terminando em endMonth (AAAA-MM): entradas, saídas, seu gasto e saldo de cada mês.
function monthlySeries(endMonth,n=6){
  const out=[];
  for(let i=n-1;i>=0;i--){
    const m=shiftMonthStr(endMonth,-i);
    const sched=scheduledPaymentsForMonth(m);
    const income=incomeBreakdownForMonth(m).total;
    const own=sched.reduce((s,t)=>s+ownAmount(t),0);
    const gross=sched.reduce((s,t)=>s+(Number(t.value)||0),0);
    out.push({month:m,income,own,gross,balance:income-own});
  }
  return out;
}

// Quanto foi gasto em cada categoria no mês (todas as partes, de qualquer pessoa), do maior para o menor: [{category,value}].
function categoryTotals(m){
  const cat={};
  scheduledPaymentsForMonth(m).forEach(t=>(t.splits||[]).forEach(s=>{cat[s.category]=(cat[s.category]||0)+Number(s.amount||0)}));
  return Object.entries(cat).map(([category,value])=>({category,value})).sort((a,b)=>b.value-a.value);
}

// Quanto do gasto de cada categoria é realmente seu (só as partes "Você") no mês: {categoria: valor}.
function ownByCategory(m){
  const cat={};
  scheduledPaymentsForMonth(m).forEach(t=>(t.splits||[]).forEach(s=>{if(s.ownerId==="self")cat[s.category]=(cat[s.category]||0)+Number(s.amount||0)}));
  return cat;
}

// Situação dos orçamentos do mês: para cada categoria com limite, quanto já gastou e se está ok (<80%), em atenção (80% a 99%) ou estourado (100% ou mais).
function budgetStatus(m){
  const budgets=data.budgets||{}, own=ownByCategory(m);
  return Object.keys(budgets).filter(c=>Number(budgets[c])>0).map(category=>{
    const limit=Number(budgets[category]), spent=own[category]||0, pct=spent/limit*100;
    return {category,limit,spent,pct,level:pct>=100?"over":pct>=80?"warn":"ok"};
  }).sort((a,b)=>b.pct-a.pct);
}

;
/* ===== storage.js ===== */
// ====================================================================
// storage.js — salvar, carregar e histórico
// Leitura/gravação no localStorage, normalização de lançamentos antigos e o registro de atividades.
// ====================================================================

// Lê os dados do localStorage ao abrir o app. Completa o que faltar (categorias, regras...) e cria dados novos se não houver nada salvo.
function loadData(){
  try{
    const saved=JSON.parse(localStorage.getItem(DB_KEY));
    if(saved && Array.isArray(saved.transactions) && Array.isArray(saved.people) && Array.isArray(saved.cards)){
      // Migração única: junta as categorias padrão novas com as suas e deixa em ordem alfabética. Depois disso a ordem é sua (▲ ▼ na aba Categorias).
      saved.categories ||= [];
      if(!saved.categoriesV2){ saved.categories=[...new Set([...saved.categories,...defaultData.categories])].sort((a,b)=>a.localeCompare(b,"pt-BR")); saved.categoriesV2=true; }
      saved.rules ||= [];
      saved.importLog ||= [];
      saved.activityLog ||= [];
      saved.budgets ||= {};
      saved.recurring ||= [];
      if(saved.lastBackupAt===undefined) saved.lastBackupAt=null;
      saved.people=saved.people.some(p=>p.id==="self") ? saved.people : [{id:"self",name:"Você"},...saved.people];
      saved.transactions=saved.transactions.map(t=>normalizeTransaction(t));
      return saved;
    }
  }catch{}
  const fresh=structuredClone(defaultData);
  fresh.transactions=fresh.transactions.map(normalizeTransaction);
  return fresh;
}

// Salva tudo no localStorage e redesenha todas as telas. Chame depois de qualquer alteração nos dados.
// Se o navegador não deixar gravar (espaço cheio ou bloqueado), avisa em vez de falhar em silêncio.
function save(){
  try{ localStorage.setItem(DB_KEY, JSON.stringify(data)); }
  catch(e){ askAlert("Não foi possível salvar no navegador (espaço cheio ou armazenamento bloqueado). Faça um backup agora na aba Importar e libere espaço, senão as últimas alterações podem ser perdidas.","Erro ao salvar"); }
  renderAll();
}

// Pede ao navegador para NÃO apagar os dados do app sozinho quando faltar espaço no aparelho (não aparece nada para o usuário).
function requestPersistentStorage(){ try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch{} }

// Remove "sujeira" de ponto flutuante (0,30000000000000004 vira 0,30) sem mexer em valores que têm 3 ou mais casas de verdade.
function cleanFloat(n){ const x=Number(n); if(!Number.isFinite(x)) return n; const r=Math.round(x*100)/100; return Math.abs(x-r)<1e-6?r:x; }

// Garante que lançamentos antigos tenham todos os campos novos (divisões, parcelas, data/status de pagamento).
function normalizeTransaction(t){
  if(typeof t.value==="number") t.value=cleanFloat(t.value);
  if(t.type==="expense"){
    t.splits=Array.isArray(t.splits)&&t.splits.length?t.splits:[{id:uid(),category:"Outros",amount:Number(t.value)||0,ownerId:"self",reimbursed:false}];
    t.installments=t.installments||1;t.installmentNo=t.installmentNo||1;if(!t.method&&t.cardId)t.method=t.installments>1?"installment":"credit";
    if(!t.paymentDate) t.paymentDate=t.cardId?nextCardPaymentDate(t.cardId,t.date||today()):(t.date||today());
    if(!t.paymentStatus) t.paymentStatus=t.cardId?"planned":"paid";
    t.splits.forEach(s=>{ if(typeof s.amount==="number") s.amount=cleanFloat(s.amount); });
  }
  return t;
}

// Registra uma ação no histórico de "Últimos lançamentos" (guarda no máximo 300).
function logActivity(kind,text,detail="",txId="",undo=null){
  data.activityLog=data.activityLog||[];
  const activity={id:uid(),at:Date.now(),kind,text,detail,txId};
  if(undo?.changes?.length) activity.undo=structuredClone(undo);
  data.activityLog.unshift(activity);
  if(data.activityLog.length>300) data.activityLog.length=300;
}

function undoActivity(activityId){
  const activity=(data.activityLog||[]).find(a=>a.id===activityId);
  if(!activity?.undo?.changes?.length||activity.undoneAt)return;
  const index=data.activityLog.indexOf(activity), changes=activity.undo.changes;
  const ids=new Set(changes.map(c=>c.after?.id||c.before?.id));
  const hasLaterAction=data.activityLog.slice(0,index).some(a=>!a.undoneAt&&a.undo?.changes?.some(c=>ids.has(c.after?.id||c.before?.id)));
  if(hasLaterAction){askAlert("Desfaça primeiro a ação mais recente deste lançamento.");return}
  const matches=changes.every(c=>{
    const id=c.after?.id||c.before?.id, current=data.transactions.find(t=>t.id===id);
    if(c.before===null) return current&&JSON.stringify(current)===JSON.stringify(c.after);
    if(c.after===null) return !current;
    return current&&JSON.stringify(current)===JSON.stringify(c.after);
  });
  if(!matches){askAlert("Este lançamento mudou depois dessa ação. Desfaça primeiro as alterações mais recentes.");return}
  changes.forEach(c=>{
    const id=c.after?.id||c.before?.id;
    if(c.before===null) data.transactions=data.transactions.filter(t=>t.id!==id);
    else if(c.after===null) data.transactions.push(structuredClone(c.before));
    else data.transactions=data.transactions.map(t=>t.id===id?structuredClone(c.before):t);
  });
  if(lastDeleted){lastDeleted=lastDeleted.filter(t=>!ids.has(t.id));if(!lastDeleted.length)lastDeleted=null}
  activity.undoneAt=Date.now();
  logActivity("undo",`Ação desfeita: ${activity.text}`,activity.detail);
  save();
  if(typeof toast==="function")toast("Ação desfeita");
}

;
