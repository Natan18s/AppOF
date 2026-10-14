// ====================================================================
// exportar.js — relatórios: CSV (Excel/Planilhas) e impressão/PDF do Resumo
// ====================================================================

// Protege uma célula do CSV: se tiver ; " ou quebra de linha, coloca entre aspas.
function csvCell(v){ const s=String(v??""); return /[;"\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }

// Número com vírgula decimal (padrão do Excel em português): 1234.5 vira 1234,50.
function csvMoney(n){ return (Number(n)||0).toFixed(2).replace(".",","); }

// Monta o texto do CSV (separador ponto e vírgula) com uma linha por lançamento.
function buildCsv(transactions){
  const head=["Data","Tipo","Descrição","Categoria","Forma","Cartão","Pagamento previsto","Status","Valor total","Seu valor","A receber de outras pessoas","Parcela","Observação"];
  const rows=transactions.slice().sort((a,b)=>a.date.localeCompare(b.date)||(a.createdAt||0)-(b.createdAt||0)).map(t=>{
    const card=t.cardId?(data.cards.find(c=>c.id===t.cardId)?.name||""):"";
    if(t.type==="expense") return [t.date,"Gasto",t.description,[...new Set((t.splits||[]).map(s=>s.category))].join(" / "),METHODS[t.method]||"",card,t.paymentDate||t.date,t.paymentStatus==="paid"?"Pago":"Previsto",csvMoney(t.value),csvMoney(ownAmount(t)),csvMoney(receivableAmount(t)),t.installments>1?`${t.installmentNo||1}/${t.installments}`:"",t.notes||""];
    if(t.type==="income") return [t.date,incomeOrigin(t)==="normal"?"Entrada":"Reembolso",t.description,"","","","","",csvMoney(t.value),"","","",t.notes||""];
    return [t.date,"Pagamento de cartão",t.description,"","",card,"","",csvMoney(t.value),"","","",t.notes||""];
  });
  return [head,...rows].map(r=>r.map(csvCell).join(";")).join("\r\n");
}

// Baixa um texto como arquivo (com BOM para o Excel entender os acentos).
function downloadText(name,text,type="text/csv;charset=utf-8"){
  const blob=new Blob(["\ufeff"+text],{type});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

// Exporta os lançamentos do mês visto (pela data da compra ou do pagamento) ou todos.
function exportCsv(scope){
  const list=scope==="all"?data.transactions:data.transactions.filter(t=>t.date.slice(0,7)===month||(t.type==="expense"&&(t.paymentDate||t.date).slice(0,7)===month));
  if(!list.length){toast("Nenhum lançamento para exportar.");return}
  downloadText(scope==="all"?`meu-controle-lancamentos-${today()}.csv`:`meu-controle-${month}.csv`,buildCsv(list));
  toast(`${list.length} lançamento(s) exportado(s)`);
}

// Abre a impressão do navegador (dá para "Salvar como PDF") com o Resumo do mês, com todos os blocos abertos.
let printOpened=[];
function printReport(){
  switchTab("dashboard");
  setTimeout(()=>window.print(),150);
}
window.addEventListener("beforeprint",()=>{ printOpened=[...document.querySelectorAll("#dashboard details:not([open])")]; printOpened.forEach(d=>d.open=true); });
window.addEventListener("afterprint",()=>{ printOpened.forEach(d=>d.open=false); printOpened=[]; });
