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
function logActivity(kind,text,detail="",txId=""){
  data.activityLog=data.activityLog||[];
  data.activityLog.unshift({id:uid(),at:Date.now(),kind,text,detail,txId});
  if(data.activityLog.length>300) data.activityLog.length=300;
}
