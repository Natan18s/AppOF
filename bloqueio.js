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
