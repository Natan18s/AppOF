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
  pendingImport.forEach(r=>{
    if(r.isCardPayment){
      data.transactions.push({id:uid(),date:r.date,description:r.description,value:r.value,type:"card_payment",cardId:r.cardId,importKey:r.sourceKey});
    }else if(r.isExpense){
      data.transactions.push({
        id:uid(),date:r.date,description:r.description,value:r.value,type:"expense",cardId:r.cardId,
        paymentDate:r.paymentDate||r.date,paymentStatus:r.paymentStatus||"paid",
        splits:[{id:uid(),category:r.category||"Outros",amount:r.value,ownerId:"self",reimbursed:false}],
        installments:r.installments||1,installmentNo:r.installmentNo||1,importKey:r.sourceKey
      });
    }else{
      data.transactions.push({id:uid(),date:r.date,description:r.description,value:r.value,type:"income",source:"imported-credit",notes:"Crédito importado",importKey:r.sourceKey});
    }
  });
  data.importLog.push({id:uid(),file:selectedImport?.name||"",date:new Date().toISOString(),count:pendingImport.length});
  logActivity("import",`Importação: ${selectedImport?.name||"arquivo"}`,`${pendingImport.length} lançamento(s) novos importados`);
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
