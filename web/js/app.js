// Movo — interfaz principal. Todo el procesamiento ocurre en el teléfono.
import { openUserDb, idbDel } from './db.js';
import { CATS, BANKS } from './parser.js';
import { buildEmail, demoSeedEmails, MERCHANTS } from './demo-emails.js';
import { startAuth, handleRedirect, getToken, clearToken, fetchProfile, scanInbox, DEFAULT_QUERY } from './gmail.js';
import { api, syncNow } from './sync.js';
import { crc, crc0, usd, esc, prettyName, displayName, dayLabel, timeLbl, shortWhen, longWhen } from './format.js';

const $ = (id) => document.getElementById(id);
const FX_FALLBACK = 510;
const ICONS = {
  super: '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 7H6"/>',
  comida: '<path d="M7 2v9M4 2v5a3 3 0 0 0 6 0V2M7 11v11M18 2c-2.2 1.4-3 4-3 7v4h3v9"/>',
  transporte: '<path d="M3 13l2-6h14l2 6v4H3z"/><circle cx="7" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  servicios: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  salud: '<path d="M20.8 5.6a5 5 0 0 0-7.8-.6L12 6l-1-1a5 5 0 0 0-7.8 6.4L12 21l8.8-9.6a5 5 0 0 0 0-5.8z"/>',
  ocio: '<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/>',
  transfer: '<path d="M7 7h13l-4-4M17 17H4l4 4"/>',
  ingreso: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  propias: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
  otros: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
};
const icon = (n, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${extra}>${ICONS[n]}</svg>`;
const catIcon = (cat, size) => { const c = (CATS[cat] || CATS.otros).c; return `<span class="ic" style="background:${c}1F;color:${c}${size ? `;width:${size}px;height:${size}px` : ''}">${icon(ICONS[cat] ? cat : 'otros')}</span>`; };
const catName = (k) => (CATS[k] || CATS.otros).n;
const parseNum = (s) => { const v = parseFloat(String(s).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return Number.isFinite(v) ? v : NaN; };
const toCents = (s) => Math.round(parseNum(s) * 100);

let cfg = null, profile = null, repo = null, view = 'home', flashId = null, scanning = false, installEvt = null, shownSpent = 0;

// ----------------------------------------------------------------- arranque
async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (view === 'settings') renderSettings(); });
  window.addEventListener('online', updateChip); window.addEventListener('offline', updateChip);

  cfg = await api('/config').catch(() => null);
  profile = loadProfile();

  const red = handleRedirect();
  if (red?.token) {
    try {
      const u = await fetchProfile(red.token);
      profile = { sub: u.sub, email: u.email, name: u.name || u.email, picture: u.picture || null };
      saveProfile(profile);
    } catch { toast('No se pudo leer tu perfil de Google. Intenta de nuevo.'); }
  } else if (red?.error) {
    if (red.silent && cfg?.googleClientId) return startAuth(cfg.googleClientId, { hint: profile?.email });
    setTimeout(() => toast(red.error === 'scope_denied'
      ? 'Para leer tus notificaciones, marca el permiso de Gmail al conectar.'
      : 'No se completó el inicio de sesión con Google.'), 400);
  }

  if (!profile) return renderOnboarding();
  await enterApp();
}

function loadProfile() { try { return JSON.parse(localStorage.getItem('pp:profile')); } catch { return null; } }
function saveProfile(p) { if (p) localStorage.setItem('pp:profile', JSON.stringify(p)); else localStorage.removeItem('pp:profile'); }

async function enterApp() {
  $('onboarding').hidden = true; $('main').hidden = false; $('nav').hidden = false;
  repo = await openUserDb(profile.demo ? 'demo' : profile.sub);
  if (profile.demo && !repo.meta('seeded')) {
    for (const m of demoSeedEmails()) repo.ingestMail(m, { fx: FX_FALLBACK });
    repo.setMeta('seeded', true);
  }
  const reread = repo.reparseIfParserChanged();
  go('home'); render(); updateChip();
  if (reread) setTimeout(() => toast(`El lector mejoró: ${reread} correo(s) que antes no reconocía ahora son movimientos.`), 600);
  loadFx();
  if (!profile.demo && getToken()) scan({ quiet: true });
  const shared = new URLSearchParams(location.search).get('text');
  if (shared) { history.replaceState(null, '', '/'); openPaste(shared); }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !profile.demo && getToken() && Date.now() - (repo.meta('last_scan') || 0) > 120e3) scan({ quiet: true });
  });
}

async function loadFx() {
  try {
    const r = await api('/fx');
    if (r.rate) { repo.setMeta('fx', r); repo.backfillFx(r.rate); render(); }
  } catch { /* sin servidor: se usa el último conocido */ }
}
const fx = () => repo?.meta('fx')?.rate || FX_FALLBACK;

// ----------------------------------------------------------------- onboarding
function renderOnboarding() {
  $('main').hidden = true; $('nav').hidden = true; $('onboarding').hidden = false;
  const can = !!cfg?.googleClientId;
  $('googleBtn').disabled = !can;
  $('obNote').textContent = can ? '' : 'El servidor todavía no tiene configurado el inicio de sesión con Google. Puedes usar el modo demo.';
  $('googleBtn').onclick = () => startAuth(cfg.googleClientId);
  $('demoBtn').onclick = async () => { profile = { sub: 'demo', name: 'Modo demo', demo: true }; saveProfile(profile); await enterApp(); };
}

// ----------------------------------------------------------------- Gmail
async function scan({ quiet = false } = {}) {
  if (scanning || profile.demo) return;
  const token = getToken();
  if (!token) { updateChip(); if (!quiet) reconnect(); return; }
  if (!navigator.onLine) { if (!quiet) toast('Sin conexión. Busco correos cuando vuelva el Internet.'); return; }
  scanning = true; updateChip('Buscando correos…');
  let first = null, nuevos = 0;
  try {
    const r = await scanInbox(token, {
      query: repo.setting('gmail_query', DEFAULT_QUERY),
      since: repo.meta('last_scan'),
      knows: (id) => repo.hasMail(id),
      ingest: (m) => { const res = repo.ingestMail(m, { fx: fx() }); if (res.tx && !first) first = res.tx; nuevos += res.txs?.length || 0; return res; },
      onProgress: (d, t) => updateChip(`Leyendo ${d} de ${t}…`),
    });
    repo.setMeta('last_scan', Date.now());
    if (first) flashId = first.id;
    render();
    if (nuevos) toast(nuevos === 1 ? `Nuevo movimiento: ${displayName(first.who)}, ${crc0(first.crc_cents)}` : `${nuevos} movimientos nuevos desde tu correo`);
    else if (!quiet) toast('No hay notificaciones nuevas de tus bancos.');
    if (repo.meta('cloud')) doSync({ quiet: true });
  } catch (e) {
    if (e.auth) { clearToken(); toast('Tu sesión de Gmail venció. Toca "Reconectar Gmail".'); }
    else toast('No se pudo leer Gmail: ' + e.message);
  } finally { scanning = false; updateChip(); }
}
function reconnect() { if (cfg?.googleClientId) startAuth(cfg.googleClientId, { hint: profile.email, silent: true }); else toast('El servidor no tiene configurado Google.'); }

async function doSync({ quiet = false } = {}) {
  const token = getToken();
  if (!token) { if (!quiet) toast('Reconecta Gmail para sincronizar el respaldo.'); return; }
  try {
    const r = await syncNow(repo, token);
    render(); if (view === 'settings') renderSettings();
    if (!quiet) toast(`Respaldo al día: ${r.pushed} enviados, ${r.pulled} recibidos.`);
  } catch (e) { if (!quiet) toast('No se pudo sincronizar: ' + e.message); }
}

function updateChip(text) {
  const chip = $('live'), t = $('liveTxt');
  chip.className = 'live';
  if (text) { t.textContent = text; chip.classList.add('busy'); return; }
  if (!navigator.onLine) { t.textContent = 'Sin conexión'; chip.classList.add('off'); return; }
  if (profile?.demo) { t.textContent = 'Modo demo'; chip.classList.add('demo'); return; }
  if (getToken()) { t.textContent = 'Gmail conectado'; return; }
  t.textContent = 'Reconectar Gmail'; chip.classList.add('off');
}

// ----------------------------------------------------------------- render
function splitBig(cents) { const s = crc(cents), i = s.lastIndexOf(','); return esc(s.slice(0, i)) + '<small>' + esc(s.slice(i)) + '</small>'; }
function animateSpent(target) {
  const from = shownSpent, t0 = performance.now(), dur = 750;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || from === target) { shownSpent = target; $('spentBig').innerHTML = splitBig(target); return; }
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur), v = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
    $('spentBig').innerHTML = splitBig(v);
    if (k < 1) requestAnimationFrame(step); else shownSpent = target;
  };
  requestAnimationFrame(step);
}
const sign = (t) => (t.dir === 'in' ? '+' : t.dir === 'self' ? '' : '−');
const txSub = (t) => t.dir === 'self' ? `Entre tus cuentas${t.bank ? ', ' + t.bank : ''}` : t.type === 'sinpe' ? `SINPE Móvil${t.bank ? ', ' + t.bank : ''}` : t.type === 'efectivo' ? 'Efectivo' : t.type === 'tarjeta' ? `Tarjeta${t.bank ? ', ' + t.bank : ''}` : `Transferencia${t.bank ? ', ' + t.bank : ''}`;

function render() {
  if (!repo) return;
  const s = repo.monthSummary(), budget = repo.setting('budget', 35000000);
  $('monthLbl').textContent = 'Gastado en ' + new Date().toLocaleDateString('es-CR', { month: 'long' });
  animateSpent(s.spent);
  $('budgetBar').style.width = Math.min(100, (s.spent / budget) * 100).toFixed(1) + '%';
  $('budgetTxt').textContent = s.spent <= budget ? `${crc0(budget - s.spent)} disponibles de ${crc0(budget)}` : `Te pasaste ${crc0(s.spent - budget)} del presupuesto`;
  $('incomeTxt').textContent = [s.income && `Ingresos: ${crc0(s.income)}`, s.moved && `Entre tus cuentas: ${crc0(s.moved)}`].filter(Boolean).join('  ·  ');
  $('simCard').hidden = !profile.demo;

  $('catCount').textContent = s.byCat.length ? `${s.byCat.length} ${s.byCat.length === 1 ? 'categoría' : 'categorías'}` : '';
  $('cats').innerHTML = s.byCat.map((r) => `<div class="cat">${catIcon(r.cat)}<div><div class="amt">${crc0(r.total)}</div><div class="nm">${catName(r.cat)}</div></div><div class="mini"><i style="width:${s.spent ? ((r.total / s.spent) * 100).toFixed(0) : 0}%;background:${(CATS[r.cat] || CATS.otros).c}"></i></div></div>`).join('')
    || '<div class="empty">Aún no hay gastos este mes.</div>';

  const txs = repo.listTx();
  $('txCount').textContent = txs.length ? `${txs.length} en total` : '';
  const groups = [];
  for (const t of txs) { const l = dayLabel(t.date); if (!groups.length || groups.at(-1).l !== l) groups.push({ l, items: [] }); groups.at(-1).items.push(t); }
  $('txList').innerHTML = groups.map((g) => `<div class="group"><h3>${esc(g.l)}</h3>${g.items.map((t) => `
    <button class="tx${t.id === flashId ? ' flash' : ''}" data-tx="${t.id}">${catIcon(t.cat)}
      <span class="mid"><div class="t1">${esc(displayName(t.who))}</div><div class="t2">${esc(txSub(t))}</div></span>
      <span class="r"><div class="a${t.dir === 'in' ? ' in' : t.dir === 'self' ? ' self' : ''}">${sign(t)}${crc0(t.crc_cents)}</div><div class="a2">${t.cur === 'USD' ? usd(t.amount_cents) : timeLbl(t.date)}</div></span>
    </button>`).join('')}</div>`).join('')
    || `<div class="empty">${profile.demo ? 'Usa el simulador de arriba para hacer un SINPE.' : 'Cuando tu banco te envíe una notificación, aparecerá aquí sola.'}</div>`;
  flashId = null;

  const mails = repo.mails();
  $('inboxBadge').textContent = mails.length;
  $('mailList').innerHTML = mails.map((m) => {
    const b = BANKS[m.bank];
    const tag = m.status === 'registrado' ? `<span class="tag ok">${icon('check', ' width="12" height="12"')} Registrado</span>`
      : m.status === 'negada' ? '<span class="tag neg">Negada por el banco</span>'
      : m.status === 'descartado' ? '<span class="tag rev">Eliminado por ti</span>' : '<span class="tag rev">Sin movimiento</span>';
    return `<button class="mail" data-mail="${esc(m.id)}"><span class="av" style="background:${b ? b.color : '#6B667D'}">${esc((m.bank || '?').slice(0, 3))}</span>
      <span class="mid"><div class="row"><span class="f">${esc(m.from_name || 'Remitente desconocido')}</span><span class="tm">${esc(shortWhen(m.received_at))}</span></div>
      <div class="s">${esc(m.subject || '(sin asunto)')}</div><div class="p">${esc((m.preview || '').replace(/\s+/g, ' '))}</div>${tag}</span></button>`;
  }).join('') || `<div class="empty">${profile.demo ? 'Aún no hay correos.' : 'Todavía no he leído correos de tus bancos. Toca el botón de actualizar arriba.'}</div>`;
}

// ----------------------------------------------------------------- ajustes
function renderSettings() {
  const cloud = !!repo.meta('cloud'), last = repo.meta('last_sync'), f = repo.meta('fx');
  const pic = profile.picture ? `<img src="${esc(profile.picture)}" alt="" referrerpolicy="no-referrer">` : esc((profile.name || '?').slice(0, 1).toUpperCase());
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  $('settingsBody').innerHTML = `
    <div class="profile"><span class="pav">${pic}</span><div><b>${esc(profile.name || '')}</b><span>${esc(profile.demo ? 'Datos de ejemplo, solo en este teléfono' : profile.email || '')}</span></div></div>
    <div class="group list">
      <button class="row" id="sBudget"><span>Presupuesto mensual</span><b>${crc0(repo.setting('budget', 35000000))}</b></button>
      <div class="row"><span>Tipo de cambio del dólar</span><b>₡${fx().toFixed(2)}</b></div>
      <p class="hint">${f?.source ? `Fuente: ${esc(f.source)}${f.date ? ', ' + esc(f.date) : ''}` : 'Valor de referencia hasta conectar con el servidor.'}</p>
    </div>
    ${profile.demo ? `
    <div class="group list">
      <button class="row" id="sResetDemo"><span>Reiniciar datos de ejemplo</span></button>
      <button class="row danger" id="sExitDemo"><span>Salir del modo demo</span></button>
    </div>` : `
    <h2 class="sh">Gmail</h2>
    <div class="group list">
      <div class="row"><span>Estado</span><b>${getToken() ? 'Conectado' : 'Desconectado'}</b></div>
      <button class="row" id="sScan"><span>Buscar correos ahora</span></button>
      ${getToken() ? '' : '<button class="row" id="sReconnect"><span>Reconectar Gmail</span></button>'}
      <button class="row" id="sQuery"><span>Bancos que se leen</span><b>Editar</b></button>
      <p class="hint">Movo lee tu correo desde este teléfono, con permiso de solo lectura. Los correos no se envían al servidor.</p>
    </div>
    <h2 class="sh">Respaldo en la nube</h2>
    <div class="group list">
      <label class="row"><span>Respaldar mis movimientos</span><input type="checkbox" class="switch" id="sCloud" ${cloud ? 'checked' : ''} ${cfg?.cloudSync ? '' : 'disabled'}></label>
      ${cloud ? `<button class="row" id="sSync"><span>Sincronizar ahora</span><b>${last ? shortWhen(new Date(last).toISOString()) : 'Nunca'}</b></button>
      <div class="row"><span>Cambios pendientes</span><b>${repo.pendingCount()}</b></div>` : ''}
      <p class="hint">${cfg?.cloudSync ? 'Opcional. Sirve para usar varios teléfonos o no perder datos. Solo se guardan movimientos, reglas y presupuesto; nunca tus correos.' : 'Este servidor no tiene respaldo habilitado.'}</p>
      ${cloud ? '<button class="row danger" id="sWipeCloud"><span>Borrar mi respaldo del servidor</span></button>' : ''}
    </div>
    <h2 class="sh">Cuenta</h2>
    <div class="group list">
      <button class="row" id="sLogout"><span>Cerrar sesión</span></button>
      <button class="row danger" id="sWipeLocal"><span>Borrar mis datos de este teléfono</span></button>
    </div>`}
    ${standalone ? '' : `<div class="group list">
      ${installEvt ? '<button class="row" id="sInstall"><span>Instalar Movo en este teléfono</span></button>' : `<div class="row"><span>Instalar la app</span></div><p class="hint">${ios ? 'En Safari: botón Compartir y luego "Agregar a pantalla de inicio".' : 'En Chrome: menú ⋮ y luego "Instalar app" o "Agregar a pantalla principal".'}</p>`}
    </div>`}
    <p class="foot">Movo · código abierto (MIT)</p>`;

  const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
  on('sBudget', openBudget);
  on('sScan', () => scan());
  on('sReconnect', reconnect);
  on('sQuery', openQuery);
  on('sSync', () => doSync());
  on('sInstall', async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; renderSettings(); });
  const c = $('sCloud'); if (c) c.onchange = () => { repo.setMeta('cloud', c.checked); renderSettings(); if (c.checked) doSync(); };
  on('sWipeCloud', () => confirmBox('Borrar respaldo', 'Se eliminan del servidor todos tus movimientos, reglas y ajustes. Lo que hay en este teléfono no se toca.', 'Borrar respaldo', async () => {
    try { await api('/me', { token: getToken(), method: 'DELETE' }); repo.setMeta('cloud', false); repo.setMeta('sync_cursor', 0); toast('Respaldo borrado del servidor.'); renderSettings(); }
    catch (e) { toast('No se pudo borrar: ' + e.message); }
  }));
  on('sLogout', () => confirmBox('Cerrar sesión', 'Tus datos quedan guardados en este teléfono y vuelven al iniciar sesión de nuevo.', 'Cerrar sesión', logout));
  on('sWipeLocal', () => confirmBox('Borrar datos del teléfono', 'Se borran tus movimientos y correos leídos de este teléfono. Si tienes respaldo, puedes recuperarlos al volver a entrar.', 'Borrar y salir', async () => { await repo.wipe(); await logout(); }));
  on('sResetDemo', () => confirmBox('Reiniciar demo', 'Se borran los datos de ejemplo y se cargan de nuevo.', 'Reiniciar', async () => { await repo.wipe(); repo = null; shownSpent = 0; await enterApp(); toast('Demo reiniciada'); }));
  on('sExitDemo', async () => { await repo.flush(); repo = null; profile = null; saveProfile(null); renderOnboarding(); });
}
async function logout() { await repo?.flush?.().catch(() => {}); clearToken(); repo = null; profile = null; saveProfile(null); closeModal(); renderOnboarding(); }

// ----------------------------------------------------------------- modales
const modal = $('modal'), scrim = $('scrim');
let lastFocus = null;
function openModal(html) {
  lastFocus = document.activeElement;
  modal.innerHTML = '<div class="grab"></div>' + html;
  modal.classList.add('on'); scrim.classList.add('on');
  const f = modal.querySelector('[data-autofocus]') || modal.querySelector('button, input, textarea');
  setTimeout(() => f?.focus(), 280);
  modal.querySelector('.close')?.addEventListener('click', closeModal);
}
function closeModal() { modal.classList.remove('on'); scrim.classList.remove('on'); lastFocus?.focus?.(); }
scrim.onclick = closeModal;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('on')) closeModal(); });
const head = (t) => `<div class="mh"><h2 id="modalTitle">${t}</h2><button class="close" aria-label="Cerrar">${icon('x')}</button></div>`;
function confirmBox(title, text, cta, fn) {
  openModal(head(esc(title)) + `<p class="meta">${esc(text)}</p><button class="cta danger" id="cOk">${esc(cta)}</button><button class="ghost" id="cNo">Cancelar</button>`);
  $('cOk').onclick = async () => { closeModal(); await fn(); };
  $('cNo').onclick = closeModal;
}
function wireSeg(attr, cb) {
  modal.querySelectorAll(`[${attr}]`).forEach((b) => (b.onclick = () => {
    modal.querySelectorAll(`[${attr}]`).forEach((x) => x.setAttribute('aria-pressed', 'false'));
    b.setAttribute('aria-pressed', 'true'); cb(b.getAttribute(attr));
  }));
}
const amountBlock = (sym = '₡') => `<div class="amount"><div class="wrap"><span id="curSym">${sym}</span><input id="amt" inputmode="decimal" placeholder="0" aria-label="Monto" data-autofocus autocomplete="off"></div><div class="hint" id="amtHint"></div></div>`;
function bindAmount(valid) { const a = $('amt'); a.oninput = () => { a.value = a.value.replace(/[^\d.,]/g, ''); a.style.width = Math.max(2, a.value.length || 1) + 0.5 + 'ch'; valid(); }; }
const catPicker = (sel, skip = []) => `<div class="catgrid" role="group" aria-label="Categoría">${Object.keys(CATS).filter((k) => !skip.includes(k)).map((k) => `<button type="button" class="catopt" data-cat="${k}" aria-pressed="${k === sel}">${catIcon(k)}${catName(k)}</button>`).join('')}</div>`;

function openTx(id) {
  const t = repo.getTx(id); if (!t) return;
  const mail = repo.mailForTx(t);
  openModal(head('Movimiento') + `
    <div class="detail-top">${catIcon(t.cat, 64)}<div class="n">${esc(displayName(t.who))}</div>
      <div class="big${t.dir === 'in' ? ' in' : ''}">${sign(t)}${splitBig(t.crc_cents)}</div>
      ${t.cur === 'USD' ? `<div class="meta" style="margin-top:6px">${usd(t.amount_cents)} a ₡${(t.fx || 0).toFixed(2)} por dólar</div>` : ''}</div>
    <dl class="kv"><div><dt>Fecha</dt><dd>${esc(longWhen(t.date))}</dd></div><div><dt>Tipo</dt><dd>${esc(txSub(t))}</dd></div>
      <div><dt>Categoría</dt><dd>${catName(t.cat)} (${esc(t.cat_origin || '')})</dd></div>
      ${t.note ? `<div><dt>Detalle</dt><dd>${esc(t.note)}</dd></div>` : ''}
      ${mail ? '<div><dt>Origen</dt><dd><button class="link" id="seeMail">Ver correo del banco</button></dd></div>' : ''}</dl>
    <div class="subh">¿Cómo contarlo?</div>
    <div class="seg" role="group" aria-label="Cómo contarlo">${[['out', 'Gasto'], ['in', 'Ingreso'], ['self', 'Entre mis cuentas']].map(([k, n]) => `<button type="button" data-dir="${k}" aria-pressed="${t.dir === k}">${n}</button>`).join('')}</div>
    ${t.dir === 'self' ? '<p class="meta" style="margin:-6px 4px 16px">No suma a tus gastos ni a tus ingresos: solo moviste dinero entre tus cuentas.</p>' : ''}
    ${t.dir === 'out' ? `<div class="subh">Cambiar categoría</div>${catPicker(t.cat, ['ingreso', 'propias'])}<p class="meta" style="margin:0 4px 16px">Los próximos movimientos de este comercio se categorizan igual.</p>` : ''}
    <button class="ghost danger" id="delTx">Eliminar movimiento</button>`);
  if (mail) $('seeMail').onclick = () => openMail(mail.id);
  wireSeg('data-dir', (k) => {
    if (k === t.dir) return;
    repo.setDir(t.id, k); render(); closeModal();
    toast(k === 'self' ? 'Listo: no cuenta como gasto ni ingreso.' : k === 'in' ? 'Ahora cuenta como ingreso.' : 'Ahora cuenta como gasto.');
  });
  wireSeg('data-cat', (k) => {
    if (k === t.cat) return;
    const n = repo.recategorize(t.id, k); render(); closeModal();
    toast(`${displayName(t.who)} ahora va a ${catName(k)}${n > 1 ? ` (${n} movimientos)` : ''}`);
  });
  $('delTx').onclick = () => { repo.deleteTx(t.id); render(); closeModal(); toast('Movimiento eliminado'); };
}

function openMail(id) {
  const m = repo.getMail(id); if (!m) return;
  const txs = repo.txsForMail(m);
  const row = (t) => `<dl class="kv"><div><dt>Monto</dt><dd>${t.cur === 'USD' ? usd(t.amount_cents) + ' (' + crc0(t.crc_cents) + ')' : crc(t.amount_cents)}</dd></div>
      <div><dt>${t.type === 'sinpe' ? (t.dir === 'in' ? 'Remitente' : 'Destinatario') : 'Comercio'}</dt><dd>${esc(t.who)}</dd></div>
      <div><dt>Fecha</dt><dd>${esc(longWhen(t.date))}</dd></div>
      <div><dt>Tipo</dt><dd>${t.dir === 'in' ? 'Ingreso, ' : t.dir === 'self' ? '' : 'Gasto, '}${esc(txSub(t))}</dd></div>
      ${t.note ? `<div><dt>Detalle</dt><dd>${esc(t.note)}</dd></div>` : ''}</dl>`;
  const canManual = !txs.length && m.status !== 'negada';
  openModal(head(esc(m.subject || 'Correo')) + `
    <p class="meta">${esc(m.from_name || 'Remitente desconocido')}${m.from_addr && m.from_addr.includes('@') ? ' · ' + esc(m.from_addr.replace(/.*</, '').replace('>', '')) : ''}, ${esc(shortWhen(m.received_at))}</p>
    <div class="raw">${esc(m.body)}</div>
    <div class="subh">Lo que leyó Movo${m.template ? ` <span class="muted">· lector ${esc(m.template)}</span>` : ''}</div>
    ${txs.map(row).join('')}
    ${m.note ? `<div class="notebox${m.status === 'negada' ? ' neg' : ''}">${esc(m.note)}</div>` : ''}
    ${canManual ? `<div class="subh">Registrar a mano</div>${amountBlock()}
         <div class="field"><label for="who">Comercio o persona</label><input id="who" autocomplete="off"></div>
         ${catPicker('otros', ['ingreso', 'propias'])}<button class="cta" id="saveManual" disabled>Guardar movimiento</button>` : ''}
    ${m.status === 'registrado' || m.status === 'descartado' ? '' : '<button class="ghost" id="again">Leer de nuevo</button>'}`);
  if (canManual) {
    let cat = 'otros';
    const valid = () => { $('saveManual').disabled = !(toCents($('amt').value) > 0 && $('who').value.trim()); };
    bindAmount(valid); $('who').oninput = valid; wireSeg('data-cat', (k) => (cat = k));
    $('saveManual').onclick = () => {
      const tx = repo.addManual({ amountCents: toCents($('amt').value), who: $('who').value.trim().toUpperCase(), cat, type: 'transferencia', date: m.received_at, mailId: m.id });
      flashId = tx.id; render(); closeModal(); go('home'); toast('Movimiento guardado');
    };
  }
  const again = $('again');
  if (again) again.onclick = () => {
    const r = repo.reparse(m.id); render();
    if (r.status === 'registrado') { closeModal(); flashId = r.tx.id; render(); go('home'); toast(`Leído: ${displayName(r.tx.who)}, ${crc0(r.tx.crc_cents)}`); }
    else toast(r.status === 'negada' ? 'El banco negó esta transacción; no se registra.' : 'Sigo sin encontrar un monto en este correo.');
  };
}

function openPaste(prefill = '') {
  openModal(head('Leer una notificación') + `
    <p class="meta">Pega el texto de un correo o SMS de tu banco (por ejemplo, el aviso de SINPE Móvil). Se procesa en este teléfono.</p>
    <div class="field"><label for="ptx">Texto</label><textarea id="ptx" data-autofocus placeholder="Monto: CRC 12,500.00&#10;Comercio: …&#10;Fecha: 05/10/2026 13:22">${esc(prefill)}</textarea></div>
    <button class="cta" id="pGo" ${prefill ? '' : 'disabled'}>Leer</button>`);
  const ta = $('ptx'), go2 = $('pGo');
  ta.oninput = () => (go2.disabled = ta.value.trim().length < 8);
  go2.onclick = () => {
    const r = repo.ingestMail({ id: 'pegado-' + Date.now(), messageId: null, from: '', fromName: 'Texto pegado', subject: 'Notificación pegada', body: ta.value.trim(), date: new Date().toISOString() }, { fx: fx() });
    closeModal(); render();
    if (r.tx) { flashId = r.tx.id; render(); go('home'); toast(r.txs.length > 1 ? `Leí ${r.txs.length} movimientos de ese aviso.` : `Leído: ${displayName(r.tx.who)}, ${crc0(r.tx.crc_cents)}`); }
    else if (r.status === 'negada') { go('inbox'); toast('Esa transacción aparece como negada por el banco: no se registra como gasto.'); }
    else { go('inbox'); toast('No encontré un monto. Ábrelo en la bandeja para registrarlo a mano.'); }
  };
}

function openEfectivo() {
  let cat = 'comida';
  openModal(head('Gasto en efectivo') + amountBlock() +
    '<div class="field"><label for="dt">¿En qué fue?</label><input id="dt" placeholder="Pan, parqueo, propina…" autocomplete="off"></div>' +
    '<div class="subh">Categoría</div>' + catPicker(cat, ['ingreso', 'transfer', 'propias']) + '<button class="cta" id="go" disabled>Guardar gasto</button>');
  const valid = () => { $('go').disabled = !(toCents($('amt').value) > 0 && $('dt').value.trim()); };
  bindAmount(valid); $('dt').oninput = valid; wireSeg('data-cat', (k) => (cat = k));
  $('go').onclick = () => {
    const t = repo.addManual({ amountCents: toCents($('amt').value), who: $('dt').value.trim().toUpperCase(), cat });
    flashId = t.id; closeModal(); go('home'); render();
    toast(navigator.onLine ? 'Gasto guardado' : 'Guardado sin conexión');
  };
}

function openBudget() {
  openModal(head('Presupuesto mensual') + amountBlock() + '<button class="cta" id="go">Guardar</button>');
  $('amt').value = String(Math.round(repo.setting('budget', 35000000) / 100)); bindAmount(() => {}); $('amt').oninput();
  $('go').onclick = () => { const v = toCents($('amt').value); if (v > 0) { repo.setSetting('budget', v); render(); renderSettings(); } closeModal(); };
}
function openQuery() {
  openModal(head('Bancos que se leen') + `<p class="meta">Búsqueda de Gmail que usa Movo. Agrega el remitente de tu banco si no aparece, con <b>from:</b>dominio.</p>
    <div class="field"><label for="q">Búsqueda</label><textarea id="q" style="min-height:120px">${esc(repo.setting('gmail_query', DEFAULT_QUERY))}</textarea></div>
    <button class="cta" id="go">Guardar</button><button class="ghost" id="def">Restaurar la predeterminada</button>`);
  $('go').onclick = () => { repo.setSetting('gmail_query', $('q').value.trim() || DEFAULT_QUERY); repo.setMeta('last_scan', null); closeModal(); toast('Guardado. La próxima búsqueda revisa los últimos 45 días.'); };
  $('def').onclick = () => { $('q').value = DEFAULT_QUERY; };
}

// ----------------------------------------------------------------- simulador (solo demo)
const CONTACTS = [
  { n: 'MARIA FERNANDEZ R', s: 'María F.', p: '88124534', c: '#E0457B' },
  { n: 'SODA DONA ROSA', s: 'Soda Doña Rosa', p: '86017722', c: '#E07A22' },
  { n: 'CARLOS JIMENEZ M', s: 'Carlos J.', p: '70345519', c: '#2F7CF6' },
  { n: 'ASOC. FUTBOL BARRIO', s: 'Mejenga', p: '61209988', c: '#0E9E74' },
];
const segBanks = () => `<div class="field"><label>Banco que te notifica</label><div class="seg" role="group" aria-label="Banco">${['BAC', 'BN', 'BCR'].map((k, i) => `<button type="button" data-bank="${k}" aria-pressed="${i === 0}">${k}</button>`).join('')}</div></div>`;
const plain = (s) => s.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function openSinpe() {
  let bank = 'BAC';
  openModal(head('Simulador: SINPE desde tu banco') +
    '<p class="meta">Esto representa lo que harías en la app de tu banco. Al enviar, el banco te manda un correo y Movo lo lee solo.</p>' +
    `<div class="chips" role="group" aria-label="Contactos">${CONTACTS.map((c, i) => `<button class="chip" data-contact="${i}" aria-pressed="false"><span class="av" style="background:${c.c}">${esc(c.s[0])}</span>${esc(c.s)}</button>`).join('')}</div>` +
    amountBlock() +
    '<div class="field"><label for="ph">Número de teléfono</label><input id="ph" inputmode="numeric" maxlength="9" placeholder="8888 8888" autocomplete="off"></div>' +
    '<div class="field"><label for="nm">Nombre del destinatario</label><input id="nm" placeholder="Como aparece en SINPE" autocomplete="off"></div>' +
    '<div class="field"><label for="ds">Detalle (opcional)</label><input id="ds" maxlength="30" placeholder="Almuerzo, alquiler…"></div>' +
    segBanks() + '<button class="cta" id="go" disabled>Enviar</button>');
  const ph = $('ph'), nm = $('nm'), go2 = $('go');
  const valid = () => {
    const v = toCents($('amt').value), ok = v > 0 && ph.value.replace(/\D/g, '').length === 8 && nm.value.trim().length > 1;
    go2.disabled = !ok; go2.textContent = ok ? 'Enviar ' + crc0(v) : 'Enviar';
  };
  bindAmount(valid);
  ph.oninput = () => { const d = ph.value.replace(/\D/g, '').slice(0, 8); ph.value = d.length > 4 ? d.slice(0, 4) + ' ' + d.slice(4) : d; valid(); };
  nm.oninput = valid;
  modal.querySelectorAll('[data-contact]').forEach((b) => (b.onclick = () => {
    modal.querySelectorAll('[data-contact]').forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true');
    const c = CONTACTS[+b.dataset.contact]; ph.value = c.p.slice(0, 4) + ' ' + c.p.slice(4); nm.value = c.n; valid(); $('amt').focus();
  }));
  wireSeg('data-bank', (k) => (bank = k));
  go2.onclick = () => {
    const v = toCents($('amt').value) / 100, who = plain(nm.value);
    const mail = buildEmail({ bank, type: 'sinpe', who, amount: v, phone: ph.value.replace(/\D/g, ''), desc: plain($('ds').value) || null });
    success('Tu banco envió el SINPE', `Mandaste ${crc0(v * 100)} a ${prettyName(who)}. Fíjate arriba: llega el correo del banco y Movo lo registra sin que hagas nada.`, mail, bank);
  };
}
function openCompra() {
  let bank = 'BAC', cur = 'CRC';
  openModal(head('Simulador: compra con tarjeta') + '<p class="meta">Imagina que pagas en un comercio. Tu banco te notifica por correo y Movo lo registra.</p>' + amountBlock() +
    '<div class="seg" role="group" aria-label="Moneda"><button type="button" data-cur="CRC" aria-pressed="true">Colones</button><button type="button" data-cur="USD" aria-pressed="false">Dólares</button></div>' +
    '<div class="field"><label for="mc">Comercio</label><input id="mc" placeholder="Nombre del comercio" autocomplete="off"></div>' +
    `<div class="chips" role="group" aria-label="Comercios sugeridos">${MERCHANTS.slice(0, 6).map((m) => `<button class="chip plain" data-m="${esc(m)}">${esc(prettyName(m))}</button>`).join('')}</div>` +
    segBanks() + '<button class="cta" id="go" disabled>Pagar</button>');
  const mc = $('mc'), go2 = $('go');
  const valid = () => {
    const v = toCents($('amt').value), ok = v > 0 && mc.value.trim().length > 1;
    go2.disabled = !ok; go2.textContent = ok ? 'Pagar ' + (cur === 'USD' ? usd(v) : crc0(v)) : 'Pagar';
    $('amtHint').textContent = cur === 'USD' && v > 0 ? `≈ ${crc0(v * fx())} al tipo de cambio actual` : '';
  };
  bindAmount(valid); mc.oninput = valid;
  modal.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { mc.value = b.dataset.m; valid(); }));
  wireSeg('data-cur', (k) => { cur = k; $('curSym').textContent = k === 'USD' ? '$' : '₡'; valid(); });
  wireSeg('data-bank', (k) => (bank = k));
  go2.onclick = () => {
    const v = toCents($('amt').value) / 100, who = plain(mc.value);
    success('Compra aprobada', `Pagaste ${cur === 'USD' ? usd(v * 100) : crc0(v * 100)} en ${prettyName(who)}. Ahora mira cómo llega la notificación del banco.`, buildEmail({ bank, type: 'tarjeta', who, amount: v, cur }), bank);
  };
}
function success(title, text, mail, bank) {
  modal.innerHTML = `<div class="grab"></div><div class="success"><div class="ok">${icon('check')}</div><h2 id="modalTitle">${esc(title)}</h2><p>${esc(text)}</p><button class="cta" id="okBtn">Listo</button></div>`;
  $('okBtn').onclick = closeModal; $('okBtn').focus();
  go('home'); setTimeout(closeModal, 1600); setTimeout(() => deliver(mail, bank), 2100);
}
let notifTimer = null;
function deliver(mail, bank) {
  const b = BANKS[bank], n = $('notif'), pipe = $('pipe');
  n.innerHTML = `<span class="av" style="background:${b.color}">${bank}</span><span class="mid"><div class="row"><b>${esc(b.name)}</b><span>ahora</span></div><div class="s">${esc(mail.subject)}</div></span>`;
  n.classList.add('on'); clearTimeout(notifTimer); notifTimer = setTimeout(() => n.classList.remove('on'), 4200);
  $('pipeTtl').textContent = 'Leyendo correo'; $('pipeBank').textContent = b.name;
  const steps = pipe.querySelectorAll('.steps div'); steps.forEach((s) => s.classList.remove('done'));
  pipe.classList.add('on');
  let i = 0;
  (function next() {
    steps[i++].classList.add('done');
    if (i === 3) {
      const r = repo.ingestMail(mail, { fx: fx() });
      n.onclick = () => { n.classList.remove('on'); openMail(mail.id); };
      if (r.tx) flashId = r.tx.id;
      setTimeout(() => {
        steps[3].classList.add('done');
        $('pipeTtl').textContent = r.tx ? `Registrado: ${crc0(r.tx.crc_cents)} en ${catName(r.tx.cat)}` : r.status === 'negada' ? 'Transacción negada: no se registra' : 'Correo guardado para revisión';
        render(); setTimeout(() => pipe.classList.remove('on'), 2200);
      }, 520);
      return;
    }
    setTimeout(next, 620);
  })();
}

// ----------------------------------------------------------------- navegación
function go(v) {
  view = v;
  for (const k of ['home', 'inbox', 'settings']) {
    $('view-' + k).hidden = k !== v;
    $('tab-' + k).setAttribute('aria-current', k === v ? 'page' : 'false');
  }
  if (v === 'settings') renderSettings();
  window.scrollTo({ top: 0 });
}
let toastT = null;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3400); }

document.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]'); if (tab) return go(tab.dataset.tab);
  const o = e.target.closest('[data-open]');
  if (o) return ({ sinpe: openSinpe, compra: openCompra, efectivo: openEfectivo, paste: () => openPaste() })[o.dataset.open]();
  const t = e.target.closest('[data-tx]'); if (t) return openTx(t.dataset.tx);
  const m = e.target.closest('[data-mail]'); if (m) return openMail(m.dataset.mail);
});
$('live').onclick = () => { if (!profile?.demo && !getToken() && navigator.onLine) reconnect(); };
$('refreshBtn').onclick = () => (profile?.demo ? toast('En el modo demo, usa el simulador para generar correos.') : scan());

boot().catch((e) => { console.error(e); toast('Error al iniciar: ' + e.message); });
