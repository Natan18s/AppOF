// ====================================================================
// backup.js — backup e restauração
// Baixar, compartilhar, copiar e restaurar os dados.
// ====================================================================

// Texto JSON com todos os dados do app.
function backupPayload(){ return JSON.stringify(data,null,2); }

// Registra a data do último backup (some o lembrete).
function markBackedUp(){ data.lastBackupAt=Date.now(); save(); }

// Baixa o backup como arquivo .json.
function exportBackup(){
  const blob=new Blob([backupPayload()],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`meu-controle-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  markBackedUp();toast("Backup exportado");
}

// Abre o menu de compartilhar do aparelho com o arquivo de backup (ou baixa, se não houver suporte).
async function shareBackup(){
  try{
    const file=new File([backupPayload()],`meu-controle-backup-${today()}.json`,{type:"application/json"});
    if(navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:"Backup Meu Controle"}); markBackedUp(); return }
  }catch(e){ if(e && e.name==="AbortError") return }
  exportBackup();   // sem suporte a compartilhamento de arquivo: cai para o download normal
}

// Copia o backup como texto para colar em outro aparelho.
async function copyBackupText(){
  const text=backupPayload();
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){ await navigator.clipboard.writeText(text) }
    else{ const ta=document.createElement("textarea"); ta.value=text; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove() }
    markBackedUp();
    toast("Backup copiado. Cole em uma mensagem para você mesmo ou direto no outro aparelho.");
  }catch{
    $("backupExportText").value=text; $("backupExportText").classList.remove("hidden-file");
    askAlert("Não consegui copiar automaticamente. Selecione o texto que apareceu na caixa e copie manualmente.");
  }
}

// Junta o backup recebido (arquivo, texto colado...) aos dados atuais, preenchendo o que faltar, como o loadData() já faz ao abrir o app
async function applyBackup(x,sourceLabel){
  if(isDemoMode()){ askAlert("Saia do modo demonstração (aba Importar) antes de restaurar um backup."); return false; }
  if(!x || typeof x!=="object" || !Array.isArray(x.transactions) || !Array.isArray(x.cards) || !Array.isArray(x.people)){
    askAlert("Esse backup não tem o formato esperado (faltam lançamentos, cartões ou pessoas)."); return false;
  }
  if(!(await askConfirm("Restaurar este backup vai substituir TODOS os dados deste aparelho. Deseja continuar?",{title:"Restaurar backup",okText:"Restaurar",danger:true}))) return false;
  const merged=structuredClone(defaultData);
  merged.transactions=(x.transactions||[]).map(t=>normalizeTransaction({...t}));
  merged.cards=x.cards.length?x.cards:merged.cards;
  merged.people=x.people.some(p=>p.id==="self")?x.people:[{id:"self",name:"Você"},...x.people];
  // Backup antigo: junta com as categorias padrão e ordena (uma vez). Backup novo: mantém a ordem que você deixou.
  merged.categories=x.categoriesV2 ? (x.categories||[]) : [...new Set([...(x.categories||[]),...defaultData.categories])].sort((a,b)=>a.localeCompare(b,"pt-BR"));
  merged.categoriesV2=true;
  merged.rules=x.rules||[];
  merged.importLog=x.importLog||[];
  merged.activityLog=x.activityLog||[];
  merged.lastBackupAt=x.lastBackupAt||null;
  merged.budgets=(x.budgets&&typeof x.budgets==="object")?x.budgets:{};   // limites mensais por categoria
  merged.recurring=Array.isArray(x.recurring)?x.recurring:[];            // modelos de lançamentos recorrentes
  data=merged;
  logActivity("restore",`Backup restaurado (${sourceLabel||"arquivo"})`,`${merged.transactions.length} lançamento(s) carregados`);
  save();
  toast(`Backup restaurado${sourceLabel?" ("+sourceLabel+")":""}`);
  return true;
}

// Restaura a partir de um arquivo .json escolhido.
function restoreBackup(){
  const f=$("backupInput").files[0];if(!f)return;
  const reader=new FileReader();
  reader.onload=async()=>{
    try{ await applyBackup(JSON.parse(reader.result),"arquivo") }
    catch(e){ askAlert("Não consegui ler esse arquivo como backup. Confira se é o .json exportado pelo próprio app.") }
  };
  reader.onerror=()=>askAlert("Não consegui abrir esse arquivo.");
  reader.readAsText(f);
  $("backupInput").value="";
}

// Restaura a partir do texto colado.
async function restoreFromText(){
  const raw=$("backupPasteText").value.trim();
  if(!raw){askAlert("Cole o texto do backup antes de restaurar.");return}
  try{
    if(await applyBackup(JSON.parse(raw),"texto colado")) $("backupPasteText").value="";
  }catch(e){ askAlert("Esse texto não é um backup válido. Confira se copiou tudo, do { inicial ao } final.") }
}
