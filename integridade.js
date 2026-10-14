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
