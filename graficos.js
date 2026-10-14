// ====================================================================
// graficos.js — gráficos e orçamento do Resumo
// Evolução dos últimos 6 meses (barras), distribuição das saídas (rosca) e barras de orçamento por categoria.
// São desenhados em SVG puro (sem biblioteca), usando as cores do tema claro/escuro.
// ====================================================================

// Cores das fatias da rosca (funcionam nos dois temas).
const CHART_COLORS=["#3b6cf6","#f59e0b","#10b981","#ef4444","#8b5cf6","#06b6d4","#ec4899","#94a3b8"];
let trendMonthOffset=0;

function shiftTrendWindow(offset){trendMonthOffset+=offset;renderTrendChart()}

// Valor curto para eixos: R$ 850, R$ 1,2 mil, R$ 15 mil, R$ 1,5 mi.
function fmtCompact(v){
  const a=Math.abs(v), sign=v<0?"-":"";
  if(a>=1e6) return `${sign}R$ ${(a/1e6).toFixed(1).replace(".",",")} mi`;
  if(a>=1e3) return `${sign}R$ ${(a/1e3).toFixed(a>=1e4?0:1).replace(".",",").replace(/,0$/,"")} mil`;
  return `${sign}R$ ${Math.round(a)}`;
}

// Escolhe o passo "redondo" do eixo (1, 2, 2,5 ou 5 vezes uma potência de 10) e quantos passos cabem até o maior valor.
// Ex.: maior valor 4600 -> passo 2000, 3 passos, topo 6000 (eixo: 0, 2 mil, 4 mil, 6 mil).
function niceScale(max){
  const m=Math.max(max,1), raw=m/4, p=Math.pow(10,Math.floor(Math.log10(raw)));
  const step=[1,2,2.5,5,10].map(k=>k*p).find(v=>v>=raw-1e-9);
  const ticks=Math.max(1,Math.ceil(m/step-1e-9));
  return {step,ticks,top:step*ticks};
}
function niceMax(max){ return niceScale(max).top; }

// Atualiza os gráficos e o orçamento do Resumo.
function renderCharts(){ renderTrendChart(); renderDonutChart(); renderBudgets(); }

// Barras dos últimos 6 meses: entradas (verde) x gasto realmente seu (vermelho). Tocar num mês muda o mês visto.
function renderTrendChart(){
  const box=$("chartTrend"); if(!box) return;
  const endMonth=shiftMonthStr(month,trendMonthOffset),s=monthlySeries(endMonth,6),[startYear,startMonth]=s[0].month.split("-"),[endYear,endMonthNumber]=endMonth.split("-");
  const periodLabel=`${MONTHS_PT[Number(startMonth)-1].slice(0,3)}/${startYear.slice(2)}–${MONTHS_PT[Number(endMonthNumber)-1].slice(0,3)}/${endYear.slice(2)}`;
  if($("trendPeriodLabel")) $("trendPeriodLabel").textContent=periodLabel;
  if(s.every(x=>x.income===0&&x.own===0)){ box.innerHTML='<div class="empty">Sem entradas nem gastos nestes 6 meses.</div>'; return; }
  const W=420,H=250,L=50,R=6,T=12,B=46,plotW=W-L-R,plotH=H-T-B,gw=plotW/s.length,bw=Math.min(26,gw/2-5);
  const sc=niceScale(Math.max(...s.flatMap(x=>[x.income,x.own]))), top=sc.top;
  const y=v=>T+plotH-(v/top)*plotH;
  let svg=`<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Entradas e gasto realmente seu nos últimos 6 meses">`;
  for(let i=0;i<=sc.ticks;i++){ const v=sc.step*i; svg+=`<line class="c-grid" x1="${L}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L-6}" y="${y(v)+4}" text-anchor="end">${fmtCompact(v)}</text>`; }
  s.forEach((x,i)=>{
    const cx=L+i*gw+gw/2, sel=x.month===month, [yy,mm]=x.month.split("-");
    svg+=`<g class="c-month" data-m="${x.month}" tabindex="0" role="button" aria-label="${MONTHS_PT[Number(mm)-1]}/${yy}: entradas ${fmtMoney(x.income)}, gasto seu ${fmtMoney(x.own)}">`
      +`<title>${MONTHS_PT[Number(mm)-1]}/${yy}\nEntradas: ${fmtMoney(x.income)}\nGasto realmente seu: ${fmtMoney(x.own)}\nSaldo: ${fmtMoney(x.balance)}</title>`
      +`<rect class="c-hit${sel?" sel":""}" x="${cx-gw/2+3}" y="${T}" width="${gw-6}" height="${plotH+B-4}" rx="8"/>`
      +`<rect class="c-inc" x="${cx-bw-2}" y="${y(x.income)}" width="${bw}" height="${Math.max(0,T+plotH-y(x.income))}" rx="3"/>`
      +`<rect class="c-own" x="${cx+2}" y="${y(x.own)}" width="${bw}" height="${Math.max(0,T+plotH-y(x.own))}" rx="3"/>`
      +`<text class="${sel?"c-sel":""}" x="${cx}" y="${T+plotH+16}" text-anchor="middle">${MONTHS_PT[Number(mm)-1]}/${yy.slice(2)}</text>`
      +`<text class="${x.balance>=0?"c-pos":"c-neg"}" x="${cx}" y="${T+plotH+31}" text-anchor="middle">${fmtCompact(x.balance)}</text></g>`;
  });
  svg+="</svg>";
  box.innerHTML=svg+`<div class="chart-legend"><span><i style="background:var(--green)"></i>Entradas</span><span><i style="background:var(--red)"></i>Gasto realmente seu</span></div><div class="chart-note">Número embaixo de cada mês = saldo do mês. Toque num mês para vê-lo.</div>`;
  box.querySelectorAll("[data-m]").forEach(el=>{
    el.onclick=()=>{trendMonthOffset=0;setMonth(el.dataset.m)};
    el.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();trendMonthOffset=0;setMonth(el.dataset.m)}};
  });
}

// Rosca com a distribuição das saídas do mês (as 6 maiores categorias + "Outras").
function renderDonutChart(){
  const box=$("chartDonut"); if(!box) return;
  const all=categoryTotals(month), total=all.reduce((s,x)=>s+x.value,0);
  if(!total){ box.innerHTML='<div class="empty">Sem saídas neste mês.</div>'; return; }
  const items=all.slice(0,6), rest=all.slice(6).reduce((s,x)=>s+x.value,0);
  if(rest>0) items.push({category:"Outras",value:rest,other:true});
  const r=70,C=2*Math.PI*r; let acc=0;
  let svg=`<svg class="chart-svg donut" viewBox="0 0 200 200" role="img" aria-label="Distribuição das saídas do mês por categoria"><circle class="c-ring" cx="100" cy="100" r="${r}" fill="none" stroke-width="34"/>`;
  items.forEach((it,i)=>{
    const len=it.value/total*C;
    svg+=`<circle cx="100" cy="100" r="${r}" fill="none" stroke="${CHART_COLORS[i%CHART_COLORS.length]}" stroke-width="34" stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-acc}" transform="rotate(-90 100 100)"><title>${esc(it.category)}: ${fmtMoney(it.value)}</title></circle>`;
    acc+=len;
  });
  svg+=`<text class="c-center" x="100" y="98" text-anchor="middle">${fmtCompact(total)}</text><text x="100" y="116" text-anchor="middle">no mês</text></svg>`;
  const legend=items.map((it,i)=>`<button type="button" class="legend-item" ${it.other?"disabled":`data-cat="${esc(it.category)}"`}><i style="background:${CHART_COLORS[i%CHART_COLORS.length]}"></i><span>${esc(it.category)}</span><b>${pctText(it.value/total*100)}</b></button>`).join("");
  box.innerHTML=`<div class="donut-wrap">${svg}<div class="donut-legend">${legend}</div></div>`;
  box.querySelectorAll("[data-cat]").forEach(el=>el.onclick=()=>showCategoryDetail(el.dataset.cat));
}

// Barras de orçamento: quanto do limite mensal de cada categoria já foi usado (só o gasto que é realmente seu).
function renderBudgets(){
  const box=$("budgetList"); if(!box) return;
  const st=budgetStatus(month), over=st.filter(x=>x.level==="over").length, warn=st.filter(x=>x.level==="warn").length;
  $("budgetSummary").textContent=st.length?(over?`${over} estourado(s)`:warn?`${warn} em atenção`:"tudo dentro do limite"):"";
  $("budgetSummary").className=over?"negative":warn?"attention":"muted";
  box.innerHTML=st.length?st.map(x=>{
    const color=x.level==="over"?"var(--red)":x.level==="warn"?"var(--attn)":"var(--green)";
    const tag=x.level==="over"?'<span class="tag budget-tag over">Estourou</span>':x.level==="warn"?'<span class="tag budget-tag warn">Atenção</span>':"";
    return `<div class="bar-row bar-click" data-cat="${esc(x.category)}" title="Ver lançamentos"><div class="bar-label"><span>${esc(x.category)} ${tag}</span><b>${fmtMoney(x.spent)} de ${fmtMoney(x.limit)} (${Math.round(x.pct)}%)</b></div><div class="bar"><i style="width:${Math.min(100,x.pct)}%;background:${color}"></i></div></div>`;
  }).join(""):'<div class="empty">Nenhum orçamento definido. Na aba Regras, ao criar ou editar uma categoria, informe o "Limite mensal" para acompanhar aqui.</div>';
  box.querySelectorAll("[data-cat]").forEach(el=>el.onclick=()=>showCategoryDetail(el.dataset.cat));
}
