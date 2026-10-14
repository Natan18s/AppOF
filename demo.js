// ====================================================================
// demo.js — Modo demonstração
// Troca os seus dados por dados FICTÍCIOS de exemplo (para mostrar o app sem expor a vida financeira).
// Os dados reais ficam guardados à parte (DEMO_STASH_KEY) e voltam quando você sai da demonstração.
// ====================================================================

// Gerador de números repetível (mesma "sorte" sempre), para a demonstração ser igual a cada vez.
function demoRandom(seed){ let x=seed; return ()=>{ x=(x*1664525+1013904223)%4294967296; return x/4294967296; }; }

// Monta um conjunto completo de dados fictícios: 6 meses de entradas, gastos, parcelado, divisão com amigos, empréstimo, recorrentes e orçamentos.
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
        paymentDate:credit?nextMonthPaymentDate(cardId,date):date,paymentStatus:(credit||date>now)?"planned":"paid",
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
      const t=mk(date,"Celular novo",per,"Compras","installment",{installments:6,installmentNo:k});
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
