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
