(() => {
  'use strict';

  // Only the account server can be reached: invoices stay on the device.
  const API_URL = location.hostname === 'localhost' ? 'http://localhost:8792' : 'https://facturas-api.kynariempleos.com';
  const GOOGLE_CLIENT_ID = '22468952436-omh6bj9nm6q979j9suja18ta374jprp5.apps.googleusercontent.com';

  // In a browser nothing else may leave the device: block any connection to other sites.
  // The Android app loads from file://, where this policy would block its own files.
  if (location.protocol.startsWith('http')) {
    const csp = document.createElement('meta');
    csp.httpEquiv = 'Content-Security-Policy';
    csp.content = `default-src 'self'; connect-src 'self' ${API_URL}; frame-src https://*.a-ads.com; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'none'`;
    document.head.appendChild(csp);
  }

  const APP_VERSION = '0.9.1';
  const STORAGE_KEY = 'mbm_invoice_v1_state';
  // Kept apart from the invoices so backups never carry the session.
  const SESSION_KEY = 'mbm_invoice_session';
  const NONCE_KEY = 'mbm_invoice_login_nonce';
  // The Android build fills this in so its older versions keep their saved data.
  const LEGACY_STORAGE_KEY = null;
  const CURRENCIES = ['USD', 'CAD', 'EUR', 'MXN', 'CUP', 'COP', 'ARS', 'CLP', 'PEN', 'DOP', 'GBP'];
  const BACKUP_REMINDER_DAYS = 30;
  // Off while null. To turn on a direct ad: { image: 'anuncios/nombre.png', link: 'https://…', text: 'Nombre del anunciante' }.
  // The image must be one of the app's own files, so nothing connects to the advertiser. See ANUNCIOS.md.
  const SPONSOR_AD = null;

  const $ = (s) => document.querySelector(s);
  const view = $('#view');
  const pageTitle = $('#pageTitle');
  const topEyebrow = $('#topEyebrow');
  const headerAction = $('#headerAction');
  const modalBackdrop = $('#modalBackdrop');
  const modal = $('#modal');
  const toastEl = $('#toast');
  const importFile = $('#importFile');

  let currentTab = 'home';
  let editingInvoiceId = null;
  let installPrompt = null;
  let session = null;
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (_) {}
  let waitingWorker = null;

  function uid() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  function defaultSettings() {
    return {
      initialized: false,
      name: '',
      address: '',
      contact: '',
      taxId: '',
      company: '',
      clientAddress: '',
      format: 'simple',
      docLang: 'es',
      currency: 'USD',
      taxLabel: '',
      taxRate: 0,
      note: ''
    };
  }

  function defaultState() {
    return {
      settings: defaultSettings(),
      invoices: [],
      lastInvoiceNumber: null,
      lastBackupAt: null,
      installHintDismissed: false
    };
  }

  // Data saved by versions before 0.8 keeps the paper format and currency it always used.
  function upgradeState(saved) {
    const next = { ...defaultState(), ...saved };
    const settings = saved.settings || {};
    next.settings = { ...defaultSettings(), ...settings };
    if (settings.initialized && !settings.format) {
      next.settings.format = 'classic';
      next.settings.currency = 'CAD';
    }
    return next;
  }

  function loadState() {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw && LEGACY_STORAGE_KEY) raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return defaultState();
      return upgradeState(JSON.parse(raw));
    } catch (_) {
      return defaultState();
    }
  }

  let state = loadState();

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {
      toast('No se pudo guardar. Revisa el espacio del dispositivo.');
    }
  }

  function isClassic() {
    return state.settings.format === 'classic';
  }

  function esc(value = '') {
    return String(value).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function todayISO() {
    const d = new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function parseISODate(s) {
    const [y,m,d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDate(s, options = { month: 'short', day: 'numeric' }) {
    if (!s) return '';
    return new Intl.DateTimeFormat('es', options).format(parseISODate(s));
  }

  function currencyOf(inv) {
    return (inv && inv.currency) || state.settings.currency || 'USD';
  }

  function formatMoney(n, currency = state.settings.currency) {
    const value = Number(n || 0);
    try {
      return new Intl.NumberFormat(currency === 'CAD' ? 'en-CA' : 'es-419', { style: 'currency', currency }).format(value);
    } catch (_) {
      return `${currency || ''} ${value.toFixed(2)}`.trim();
    }
  }

  function roundCents(n) {
    return Math.round(Number(n || 0) * 100) / 100;
  }

  function subtotalInvoice(inv) {
    return roundCents(inv.items.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  }

  function taxInvoice(inv) {
    return roundCents(subtotalInvoice(inv) * Number(inv.taxRate || 0) / 100);
  }

  function totalInvoice(inv) {
    return roundCents(subtotalInvoice(inv) + taxInvoice(inv));
  }

  function clientName(inv) {
    return inv.client ?? state.settings.company ?? '';
  }

  function clientAddress(inv) {
    return inv.clientAddress ?? state.settings.clientAddress ?? '';
  }

  function invoiceDateRange(inv) {
    const dates = inv.items.map(i => i.date).filter(Boolean).sort();
    if (dates.length) {
      const a = dates[0], b = dates[dates.length - 1];
      return a === b ? formatDate(a, { month:'short', day:'numeric', year:'numeric' }) : `${formatDate(a)} – ${formatDate(b, { month:'short', day:'numeric', year:'numeric' })}`;
    }
    return formatDate(inv.createdDate, { month:'short', day:'numeric', year:'numeric' });
  }

  function itemCountText(inv) {
    return `${inv.items.length} ${inv.items.length === 1 ? 'concepto' : 'conceptos'}`;
  }

  function nextNumberPreview() {
    if (state.lastInvoiceNumber == null) return isClassic() ? '' : 1;
    return state.lastInvoiceNumber + 1;
  }

  function nextInvoiceNumber() {
    if (state.lastInvoiceNumber == null) {
      state.lastInvoiceNumber = isClassic() ? Math.floor(100000 + Math.random() * 800000) : 1;
    } else {
      state.lastInvoiceNumber += 1;
      if (isClassic() && state.lastInvoiceNumber > 999999) state.lastInvoiceNumber = 100000;
    }
    saveState();
    return state.lastInvoiceNumber;
  }

  function createInvoice() {
    const s = state.settings;
    const inv = {
      id: uid(),
      number: nextInvoiceNumber(),
      createdDate: todayISO(),
      createdAt: Date.now(),
      status: 'open',
      finalizedAt: null,
      client: s.company,
      clientAddress: s.clientAddress,
      currency: s.currency,
      taxLabel: s.taxLabel,
      taxRate: s.taxRate,
      items: []
    };
    state.invoices.unshift(inv);
    saveState();
    openInvoiceEditor(inv.id);
  }

  function setTab(tab) {
    currentTab = tab;
    editingInvoiceId = null;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    headerAction.classList.add('hidden');
    if (tab === 'home') renderHome();
    if (tab === 'history') renderHistory();
    if (tab === 'settings') renderSettings();
    updateAdBar();
    applyUpdateIfIdle();
  }

  // The network's banner lives in index.html so its robot can find it.
  // Never where invoices are edited, and never in the Android app.
  function updateAdBar() {
    const bar = $('#adBar');
    if (bar) bar.classList.toggle('off', currentTab !== 'home' && currentTab !== 'history');
  }

  // ---------- Device helpers ----------
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isStandalone() {
    return window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }

  // Facebook, Instagram, WhatsApp and similar open links in a browser that cannot install apps.
  function isInAppBrowser() {
    return /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Telegram/i.test(navigator.userAgent);
  }

  function canInstall() {
    return !window.AndroidBridge && !isStandalone() && location.protocol.startsWith('http');
  }

  function installInstructions() {
    if (isInAppBrowser()) return `Estás dentro de otra aplicación. Abre esta página en ${isIOS() ? 'Safari' : 'Chrome'} para poder instalarla.`;
    if (isIOS()) return 'En Safari, toca el botón Compartir y luego «Añadir a pantalla de inicio». Instálala antes de empezar: en iPhone, los datos de Safari y los de la app instalada están separados.';
    if (installPrompt) return 'Se abrirá como una app normal y funcionará sin conexión.';
    return 'En el menú del navegador, elige «Instalar app» o «Añadir a pantalla de inicio».';
  }

  // ---------- Screens ----------
  // Only on the browsing screens and below their content: never where invoices are edited or sent.
  function adHTML() {
    if (!SPONSOR_AD || window.AndroidBridge || !location.protocol.startsWith('http')) return '';
    return `
      <a class="ad-slot" href="${esc(SPONSOR_AD.link)}" target="_blank" rel="noopener sponsored">
        <span class="ad-label">Publicidad</span>
        <img src="${esc(SPONSOR_AD.image)}" alt="${esc(SPONSOR_AD.text)}" />
      </a>`;
  }

  function hintsHTML() {
    let html = '';
    if (canInstall() && !state.installHintDismissed) {
      html += `
        <section class="card hint-card">
          <div class="kicker">Instálala en tu móvil</div>
          <p class="settings-note">${esc(installInstructions())}</p>
          <div class="hint-actions">
            ${installPrompt ? '<button class="primary blue" data-action="install">Instalar</button>' : ''}
            <button class="ghost" data-action="dismiss-install">Ahora no</button>
          </div>
        </section>`;
    }
    const days = state.lastBackupAt ? (Date.now() - state.lastBackupAt) / 86400000 : Infinity;
    if (state.invoices.some(i => i.status === 'final') && days > BACKUP_REMINDER_DAYS) {
      html += `
        <section class="card hint-card">
          <div class="kicker">Copia de seguridad</div>
          <p class="settings-note">Tus facturas solo están en este dispositivo. Si lo pierdes o borras los datos del navegador, se pierden.</p>
          <div class="hint-actions"><button class="secondary" data-action="export-backup">Hacer copia ahora</button></div>
        </section>`;
    }
    return html;
  }

  function renderHome() {
    topEyebrow.textContent = 'Facturas';
    pageTitle.textContent = 'Inicio';
    const open = state.invoices.filter(i => i.status === 'open');
    const recent = state.invoices.filter(i => i.status === 'final').slice(0, 3);
    const greetingName = state.settings.name ? state.settings.name.split(/\s+/)[0] : '';

    let html = '';
    if (greetingName) html += `<div class="muted small">Hola, ${esc(greetingName)}.</div>`;
    html += hintsHTML();

    html += open.map(inv => `
        <section class="card hero-card">
          <div class="card-top">
            <div>
              <span class="badge">En curso</span>
              <h2 style="margin-top:11px">${esc(clientName(inv) || 'Factura en curso')}</h2>
              <div class="status-line">${esc(invoiceDateRange(inv))} · ${itemCountText(inv)}</div>
            </div>
            <div class="invoice-number">#${inv.number}</div>
          </div>
          <div class="amount-xl">${formatMoney(totalInvoice(inv), currencyOf(inv))}</div>
          <div class="amount-label">Total actual</div>
          <button class="primary blue" style="margin-top:18px" data-action="continue" data-id="${inv.id}">Continuar factura</button>
        </section>`).join('');

    if (open.length) {
      html += `<button class="secondary" data-action="new-invoice">Nueva factura</button>`;
    } else {
      html += `
        <section class="card hero-card">
          <div class="kicker">Empezar</div>
          <h2 style="margin-top:7px">Crear una nueva factura</h2>
          <p class="muted small" style="margin-top:7px;line-height:1.45">Agrega lo que vas a cobrar. La app calcula el total y asigna el número automáticamente.</p>
          <button class="primary blue" style="margin-top:18px" data-action="new-invoice">Nueva factura</button>
        </section>`;
    }

    html += `
      <div class="quick-grid">
        <button class="quick-card" data-action="history"><strong>Historial</strong><span>Revisar facturas anteriores</span></button>
        <button class="quick-card" data-action="settings"><strong>Mis datos</strong><span>Tu nombre, clientes y copia</span></button>
      </div>`;

    html += `<div class="section-title"><h3>Recientes</h3>${recent.length ? '<button class="ghost" data-action="history">Ver todas</button>' : ''}</div>`;
    if (!recent.length) {
      html += `<div class="empty"><strong>Aún no hay facturas terminadas</strong>Cuando finalices una, aparecerá aquí.</div>`;
    } else {
      html += `<div class="history-list">${recent.map(inv => historyCardHTML(inv)).join('')}</div>`;
    }
    view.innerHTML = html + adHTML();
  }

  function historyCardHTML(inv, allowDelete = false) {
    const client = clientName(inv);
    const card = `
      <button class="history-card" data-action="open-invoice" data-id="${inv.id}">
        <div class="row">
          <div><strong>#${inv.number}</strong><div class="muted small">${esc(invoiceDateRange(inv))}</div></div>
          <strong>${formatMoney(totalInvoice(inv), currencyOf(inv))}</strong>
        </div>
        <div class="status-line">${client ? `${esc(client)} · ` : ''}${itemCountText(inv)} · ${inv.status === 'open' ? 'En curso' : 'Finalizada'}</div>
      </button>`;
    if (!allowDelete) return card;
    return `<div class="history-entry">${card}<button class="danger history-delete" data-action="delete-invoice" data-id="${inv.id}">Eliminar</button></div>`;
  }

  function renderHistory() {
    topEyebrow.textContent = 'Facturas';
    pageTitle.textContent = 'Historial';
    const list = [...state.invoices].sort((a,b) => b.createdAt - a.createdAt);
    if (!list.length) {
      view.innerHTML = `<div class="empty"><strong>No hay facturas todavía</strong>Tu historial aparecerá aquí.</div>`;
      return;
    }
    view.innerHTML = `<div class="history-list">${list.map(inv => historyCardHTML(inv, true)).join('')}</div>${adHTML()}`;
  }

  function currencyOptions(selected) {
    const list = CURRENCIES.includes(selected) ? CURRENCIES : [selected, ...CURRENCIES];
    return list.map(c => `<option value="${esc(c)}"${c === selected ? ' selected' : ''}>${esc(c)}</option>`).join('');
  }

  function renderSettings() {
    topEyebrow.textContent = 'Configuración';
    pageTitle.textContent = 'Mis datos';
    const s = state.settings;
    view.innerHTML = `
      <section class="card form-card">
        <div class="kicker">Quién cobra</div>
        <div class="field"><label for="settingsName">Tu nombre o negocio</label><input id="settingsName" class="input" value="${esc(s.name)}" placeholder="Tu nombre o negocio" /></div>
        <div class="field"><label for="settingsAddress">Dirección</label><textarea id="settingsAddress" class="input" placeholder="Dirección (opcional)">${esc(s.address)}</textarea></div>
        <div class="field"><label for="settingsContact">Teléfono o correo</label><input id="settingsContact" class="input" value="${esc(s.contact)}" placeholder="Opcional" /></div>
        <div class="field"><label for="settingsTaxId">Número fiscal</label><input id="settingsTaxId" class="input" value="${esc(s.taxId)}" placeholder="Opcional" /></div>
      </section>
      <section class="card form-card">
        <div class="kicker">Cliente habitual</div>
        <div class="field"><label for="settingsCompany">Nombre del cliente</label><input id="settingsCompany" class="input" value="${esc(s.company)}" placeholder="Opcional" /></div>
        <div class="field"><label for="settingsClientAddress">Dirección del cliente</label><textarea id="settingsClientAddress" class="input" placeholder="Opcional">${esc(s.clientAddress)}</textarea></div>
        <p class="settings-note">Se pone solo en cada factura nueva. Puedes cambiarlo en cada factura.</p>
      </section>
      <section class="card form-card">
        <div class="kicker">Formato de la factura</div>
        <div class="field"><label for="settingsFormat">Diseño</label>
          <select id="settingsFormat" class="input">
            <option value="simple"${s.format === 'simple' ? ' selected' : ''}>Sencillo</option>
            <option value="classic"${s.format === 'classic' ? ' selected' : ''}>Talonario clásico (inglés y francés)</option>
          </select>
        </div>
        <div class="field"><label for="settingsDocLang">Idioma del documento (diseño sencillo)</label>
          <select id="settingsDocLang" class="input">
            <option value="es"${s.docLang === 'es' ? ' selected' : ''}>Español</option>
            <option value="en"${s.docLang === 'en' ? ' selected' : ''}>English</option>
          </select>
        </div>
        <div class="field"><label for="settingsCurrency">Moneda</label><select id="settingsCurrency" class="input">${currencyOptions(s.currency)}</select></div>
        <div class="form-actions">
          <div class="field"><label for="settingsTaxLabel">Impuesto</label><input id="settingsTaxLabel" class="input" value="${esc(s.taxLabel)}" placeholder="IVA, HST…" /></div>
          <div class="field"><label for="settingsTaxRate">Porcentaje</label><input id="settingsTaxRate" class="input" inputmode="decimal" value="${s.taxRate ? esc(s.taxRate) : ''}" placeholder="0" /></div>
        </div>
        <div class="field"><label for="settingsNote">Nota al pie</label><textarea id="settingsNote" class="input" placeholder="Forma de pago, gracias… (opcional)">${esc(s.note)}</textarea></div>
        <div class="field"><label for="settingsNextNumber">Próximo número de factura</label><input id="settingsNextNumber" class="input" inputmode="numeric" value="${esc(nextNumberPreview())}" placeholder="Automático" /></div>
        <p class="settings-note">La moneda y el impuesto se aplican a las facturas nuevas. Tu nombre, dirección y formato se usan en todas.</p>
      </section>
      <button class="primary blue" data-action="save-settings">Guardar cambios</button>
      <section class="card form-card">
        <div class="kicker">Copia de seguridad</div>
        <p class="settings-note">Tus datos están solo en este dispositivo. Guarda una copia para no perderlos o para pasarlos a otro teléfono.${state.lastBackupAt ? ` Última copia: ${esc(new Date(state.lastBackupAt).toLocaleDateString('es'))}.` : ''}</p>
        <div class="invoice-actions">
          <button class="secondary" data-action="export-backup">Exportar copia</button>
          <button class="secondary" data-action="import-backup">Importar copia</button>
        </div>
      </section>
      ${needsAccount() && session ? `
      <section class="card form-card">
        <div class="kicker">Tu cuenta</div>
        <p class="settings-note"><strong>${esc(session.nombre || session.correo)}</strong><br>${esc(session.correo)}</p>
        ${session.admin ? '<button class="secondary" data-action="show-users">Ver usuarios</button>' : ''}
        <button class="secondary" data-action="logout">Cerrar sesión</button>
      </section>` : ''}
      ${canInstall() ? `
      <section class="card form-card">
        <div class="kicker">Instalar en tu móvil</div>
        <p class="settings-note">${esc(installInstructions())}</p>
        ${installPrompt ? '<button class="primary blue" data-action="install">Instalar</button>' : ''}
      </section>` : ''}
      <section class="card">
        <div class="kicker">Acerca de</div>
        <h3 style="margin-top:6px">MBM Invoice</h3>
        <p class="settings-note" style="margin-top:6px">Versión ${APP_VERSION} · Creado por Mauricio Benitez</p>
        <a class="brand-link" href="https://kynari.dev/" target="_blank" rel="noopener">by Kynari</a>
        <p class="settings-note">Gratis${adHTML() || $('#adBar') ? '' : ' y sin anuncios'}. Tus facturas no salen del dispositivo salvo que tú exportes o compartas un archivo.${needsAccount() ? ' Para entrar usas tu cuenta de Google: guardamos tu nombre, tu correo y cuándo usas la app. <a href="privacidad.html">Política de privacidad</a>.' : ''}</p>
      </section>
      <button class="danger" data-action="erase-all">Borrar todos mis datos</button>`;
  }

  function openInvoiceEditor(id) {
    editingInvoiceId = id;
    currentTab = 'invoice';
    updateAdBar();
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    renderInvoiceEditor();
  }

  function renderInvoiceEditor() {
    const inv = state.invoices.find(i => i.id === editingInvoiceId);
    if (!inv) return setTab('home');
    topEyebrow.textContent = inv.status === 'open' ? 'Factura en curso' : 'Factura finalizada';
    pageTitle.textContent = `#${inv.number}`;
    headerAction.textContent = '‹';
    headerAction.classList.remove('hidden');
    headerAction.onclick = () => setTab(inv.status === 'open' ? 'home' : 'history');
    const cur = currencyOf(inv);

    let html = `
      <section class="card">
        <div class="card-top">
          <div><span class="badge ${inv.status === 'final' ? 'closed':''}">${inv.status === 'open' ? 'En curso' : 'Finalizada'}</span><div class="status-line">${esc(invoiceDateRange(inv))}</div></div>
          <div class="invoice-number">#${inv.number}</div>
        </div>
        <div class="amount-xl">${formatMoney(totalInvoice(inv), cur)}</div>
        <div class="amount-label">Total</div>
      </section>
      <section class="card form-card">
        <div class="field"><label for="invoiceClientInput">Cliente</label><input id="invoiceClientInput" class="input" value="${esc(clientName(inv))}" placeholder="Nombre del cliente" /></div>
        <div class="field"><label for="invoiceClientAddressInput">Dirección del cliente</label><textarea id="invoiceClientAddressInput" class="input" placeholder="Opcional">${esc(clientAddress(inv))}</textarea></div>
        <div class="field">
          <label for="invoiceHeaderDateInput">Fecha de la factura</label>
          <input id="invoiceHeaderDateInput" type="date" class="input" value="${esc(invoiceHeaderDateISO(inv))}" />
        </div>
        <p class="settings-note">Se guarda solo. La fecha es la del primer concepto, salvo que elijas otra.</p>
        <button class="secondary" data-action="reset-header-date" data-id="${inv.id}">Usar la fecha del primer concepto</button>
      </section>
      <div class="section-title"><h3>Conceptos</h3><button class="ghost" data-action="add-work" data-id="${inv.id}">+ Agregar</button></div>`;

    if (!inv.items.length) {
      html += `<div class="empty"><strong>Factura vacía</strong>Agrega el primer concepto.</div>`;
    } else {
      html += `<div class="work-list">${inv.items.map(item => `
        <button class="work-row" data-action="edit-work" data-invoice="${inv.id}" data-item="${item.id}">
          <div class="work-date">${esc(formatDate(item.date))}</div>
          <div class="work-location">${esc(item.location)}</div>
          <div class="work-amount">${formatMoney(item.amount, cur)}</div>
        </button>`).join('')}</div>`;
    }

    html += `
      <div class="total-bar"><span>TOTAL</span><strong>${formatMoney(totalInvoice(inv), cur)}</strong></div>
      ${isClassic() ? '<p class="settings-note format-note">En el talonario clásico, la fecha va en QUANTITY y la descripción en DESCRIPTION.</p>' : ''}
      <button class="secondary preview-button" data-action="preview-invoice" data-id="${inv.id}">Ver factura</button>
      <div class="invoice-actions">
        <button class="secondary" data-action="share-image" data-id="${inv.id}">Compartir imagen</button>
        <button class="secondary" data-action="share-pdf" data-id="${inv.id}">Compartir PDF</button>
      </div>`;

    if (inv.status === 'open') {
      html += `<button class="primary" data-action="finalize" data-id="${inv.id}">Finalizar factura</button>`;
    } else {
      html += `<button class="secondary" data-action="add-work" data-id="${inv.id}">Agregar otro concepto</button>`;
    }
    view.innerHTML = html;
  }

  function saveInvoiceFields() {
    const inv = state.invoices.find(i => i.id === editingInvoiceId);
    const dateInput = $('#invoiceHeaderDateInput');
    if (!inv || !dateInput) return;
    inv.client = $('#invoiceClientInput').value.trim();
    inv.clientAddress = $('#invoiceClientAddressInput').value.trim();
    if (dateInput.value && dateInput.value !== autoInvoiceHeaderDateISO(inv)) inv.headerDate = dateInput.value;
    else delete inv.headerDate;
    saveState();
  }

  function resetInvoiceHeaderDate(id) {
    const inv = state.invoices.find(i => i.id === id);
    if (!inv) return;
    delete inv.headerDate;
    saveState();
    toast('Fecha automática restaurada.');
    renderInvoiceEditor();
  }

  function confirmDeleteInvoice(id) {
    const inv = state.invoices.find(i => i.id === id);
    if (!inv) return;
    openModal(`
      <h2>¿Eliminar factura #${inv.number}?</h2>
      <p class="subtitle">Esta factura se eliminará del historial. Esta acción no se puede deshacer.</p>
      <div class="modal-actions">
        <button id="cancelDeleteInvoice" class="secondary">Cancelar</button>
        <button id="confirmDeleteInvoice" class="danger">Sí, eliminar</button>
      </div>
    `, false);
    $('#cancelDeleteInvoice').onclick = closeModal;
    $('#confirmDeleteInvoice').onclick = () => {
      state.invoices = state.invoices.filter(i => i.id !== id);
      if (editingInvoiceId === id) editingInvoiceId = null;
      saveState();
      closeModal();
      toast('Factura eliminada.');
      renderHistory();
    };
  }

  function confirmEraseAll() {
    openModal(`
      <h2>¿Borrar todos tus datos?</h2>
      <p class="subtitle">Se borrarán tus datos y todas las facturas de este dispositivo. Si quieres conservarlas, exporta antes una copia. No se puede deshacer.</p>
      <div class="modal-actions">
        <button id="cancelErase" class="secondary">Cancelar</button>
        <button id="confirmErase" class="danger">Sí, borrar</button>
      </div>
    `, false);
    $('#cancelErase').onclick = closeModal;
    $('#confirmErase').onclick = () => {
      state = defaultState();
      try {
        localStorage.removeItem(STORAGE_KEY);
        if (LEGACY_STORAGE_KEY) localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch (_) {}
      closeModal();
      setTab('home');
      showSetup();
    };
  }

  function showSetup() {
    openModal(`
      <div class="kicker">Primera vez</div>
      <h2>Configura tus facturas</h2>
      <p class="subtitle">Estos datos se guardan solo en este dispositivo y aparecen en cada factura. Podrás completar el resto en Ajustes.</p>
      <div class="form-card">
        <div class="field"><label for="setupName">Tu nombre o negocio</label><input id="setupName" class="input" placeholder="Tu nombre o negocio" /></div>
        <div class="field"><label for="setupAddress">Dirección</label><textarea id="setupAddress" class="input" placeholder="Dirección (opcional)"></textarea></div>
        <div class="field"><label for="setupCurrency">Moneda</label><select id="setupCurrency" class="input">${currencyOptions(state.settings.currency)}</select></div>
      </div>
      <div class="modal-actions one"><button id="setupSave" class="primary blue">Guardar y comenzar</button></div>
      <div class="modal-actions one"><button class="ghost" data-action="import-backup">Ya tengo una copia de seguridad</button></div>
    `, false);
    $('#setupSave').onclick = () => {
      const name = $('#setupName').value.trim();
      if (!name) return toast('Escribe tu nombre o el de tu negocio.');
      state.settings = {
        ...state.settings,
        initialized: true,
        name,
        address: $('#setupAddress').value.trim(),
        currency: $('#setupCurrency').value
      };
      saveState();
      closeModal();
      renderHome();
    };
  }

  function parseAmount(value) {
    return Number(String(value).trim().replace(',', '.'));
  }

  function showWorkModal(invoiceId, itemId = null) {
    const inv = state.invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    const item = itemId ? inv.items.find(x => x.id === itemId) : null;
    openModal(`
      <h2>${item ? 'Editar concepto' : 'Agregar concepto'}</h2>
      <p class="subtitle">Solo necesitas fecha, descripción y monto.</p>
      <div class="form-card">
        <div class="field"><label for="workDate">Fecha</label><input id="workDate" type="date" class="input" value="${esc(item?.date || todayISO())}" /></div>
        <div class="field"><label for="workLocation">Descripción</label><input id="workLocation" class="input" value="${esc(item?.location || '')}" placeholder="Qué se cobra" /></div>
        <div class="field"><label for="workAmount">Monto</label><input id="workAmount" inputmode="decimal" class="input" value="${item ? esc(item.amount) : ''}" placeholder="0.00" /></div>
      </div>
      <div class="modal-actions">
        ${item ? '<button id="deleteWork" class="danger">Eliminar</button>' : '<button id="cancelWork" class="secondary">Cancelar</button>'}
        <button id="saveWork" class="primary blue">Guardar</button>
      </div>
    `);
    const cancel = $('#cancelWork');
    if (cancel) cancel.onclick = closeModal;
    $('#saveWork').onclick = () => {
      const date = $('#workDate').value;
      const location = $('#workLocation').value.trim();
      const amount = parseAmount($('#workAmount').value);
      if (!date || !location || !$('#workAmount').value.trim() || !Number.isFinite(amount) || amount < 0) return toast('Revisa la fecha, la descripción y el monto.');
      if (item) {
        item.date = date; item.location = location; item.amount = amount;
      } else {
        inv.items.push({ id: uid(), date, location, amount });
      }
      inv.items.sort((a,b) => a.date.localeCompare(b.date));
      saveState();
      closeModal();
      renderInvoiceEditor();
    };
    const del = $('#deleteWork');
    if (del) del.onclick = () => {
      inv.items = inv.items.filter(x => x.id !== item.id);
      saveState();
      closeModal();
      renderInvoiceEditor();
    };
  }

  function openModal(html, dismissible = true) {
    modal.innerHTML = html;
    modal.scrollTop = 0;
    modalBackdrop.classList.remove('hidden');
    modalBackdrop.setAttribute('aria-hidden', 'false');
    modalBackdrop.onclick = (e) => {
      if (dismissible && e.target === modalBackdrop) closeModal();
    };
  }

  function closeModal() {
    document.body.classList.remove('ad-over-modal');
    modalBackdrop.classList.add('hidden');
    modalBackdrop.setAttribute('aria-hidden', 'true');
    modal.innerHTML = '';
    applyUpdateIfIdle();
  }

  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2600);
  }

  function finalizeInvoice(id) {
    const inv = state.invoices.find(i => i.id === id);
    if (!inv) return;
    if (!inv.items.length) return toast('Agrega al menos un concepto primero.');
    inv.status = 'final';
    inv.finalizedAt = Date.now();
    saveState();
    toast('Factura finalizada.');
    setTab('history');
  }

  function saveSettings() {
    const name = $('#settingsName').value.trim();
    if (!name) return toast('Escribe tu nombre o el de tu negocio.');
    const rawRate = $('#settingsTaxRate').value.trim();
    const taxRate = rawRate ? parseAmount(rawRate) : 0;
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return toast('El porcentaje debe estar entre 0 y 100.');
    const rawNext = $('#settingsNextNumber').value.trim();
    const nextNumber = rawNext ? Number(rawNext) : null;
    if (rawNext && (!Number.isInteger(nextNumber) || nextNumber < 1)) return toast('El próximo número no es válido.');
    state.settings = {
      ...state.settings,
      initialized: true,
      name,
      address: $('#settingsAddress').value.trim(),
      contact: $('#settingsContact').value.trim(),
      taxId: $('#settingsTaxId').value.trim(),
      company: $('#settingsCompany').value.trim(),
      clientAddress: $('#settingsClientAddress').value.trim(),
      format: $('#settingsFormat').value,
      docLang: $('#settingsDocLang').value,
      currency: $('#settingsCurrency').value,
      taxLabel: $('#settingsTaxLabel').value.trim(),
      taxRate,
      note: $('#settingsNote').value.trim()
    };
    if (nextNumber != null) state.lastInvoiceNumber = nextNumber - 1;
    saveState();
    toast('Datos guardados.');
  }

  // ---------- Backup ----------
  function isISODate(v) {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(parseISODate(v).getTime());
  }

  // A backup is a file from outside the app: keep only known fields and safe values.
  function sanitizeState(data) {
    const source = data && data.state ? data.state : data;
    if (!source || typeof source !== 'object' || !Array.isArray(source.invoices) || !source.settings || typeof source.settings !== 'object') {
      throw new Error('not a backup');
    }
    const text = (v, max = 500) => (typeof v === 'string' ? v.slice(0, max) : '');
    const count = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : 0);
    const safeId = (v) => (typeof v === 'string' && /^[a-z0-9]{1,40}$/i.test(v) ? v : uid());
    const currency = (v) => (typeof v === 'string' && /^[A-Z]{3}$/.test(v) ? v : undefined);
    const s = source.settings;
    const settings = {
      name: text(s.name), address: text(s.address), contact: text(s.contact), taxId: text(s.taxId),
      company: text(s.company), clientAddress: text(s.clientAddress), taxLabel: text(s.taxLabel, 40), note: text(s.note),
      initialized: !!s.initialized,
      docLang: s.docLang === 'en' ? 'en' : 'es',
      taxRate: Math.min(count(s.taxRate), 100)
    };
    if (s.format === 'classic' || s.format === 'simple') settings.format = s.format;
    if (currency(s.currency)) settings.currency = currency(s.currency);
    const invoices = source.invoices.filter(i => i && typeof i === 'object').map(i => {
      const inv = {
        id: safeId(i.id),
        number: Math.floor(count(i.number)),
        createdDate: isISODate(i.createdDate) ? i.createdDate : todayISO(),
        createdAt: count(i.createdAt) || Date.now(),
        status: i.status === 'final' ? 'final' : 'open',
        finalizedAt: i.finalizedAt ? count(i.finalizedAt) : null,
        items: (Array.isArray(i.items) ? i.items : []).filter(x => x && typeof x === 'object').map(x => ({
          id: safeId(x.id),
          date: isISODate(x.date) ? x.date : todayISO(),
          location: text(x.location),
          amount: count(x.amount)
        }))
      };
      if (typeof i.client === 'string') inv.client = text(i.client);
      if (typeof i.clientAddress === 'string') inv.clientAddress = text(i.clientAddress);
      if (isISODate(i.headerDate)) inv.headerDate = i.headerDate;
      if (currency(i.currency)) inv.currency = i.currency;
      if (typeof i.taxLabel === 'string') inv.taxLabel = text(i.taxLabel, 40);
      if (i.taxRate != null) inv.taxRate = Math.min(count(i.taxRate), 100);
      return inv;
    });
    return upgradeState({
      settings,
      invoices,
      lastInvoiceNumber: source.lastInvoiceNumber == null ? null : Math.floor(count(source.lastInvoiceNumber)),
      lastBackupAt: source.lastBackupAt ? count(source.lastBackupAt) : null
    });
  }

  function exportBackup() {
    const payload = { app: 'MBM Invoice', backupVersion: 1, exportedAt: new Date().toISOString(), state };
    const file = new File([JSON.stringify(payload, null, 2)], `mbm-invoice-copia-${todayISO()}.json`, {type:'application/json'});
    deliverFiles([file], 'Tu copia está lista', 'Guárdala fuera de este dispositivo: en tus archivos, en la nube o enviándotela a ti.', () => {
      state.lastBackupAt = Date.now();
      saveState();
      if (currentTab === 'settings') renderSettings();
      if (currentTab === 'home') renderHome();
    });
  }

  async function handleImportFile(file) {
    let imported;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('too big');
      imported = sanitizeState(JSON.parse(await file.text()));
    } catch (_) {
      return toast('Ese archivo no es una copia de MBM Invoice.');
    }
    const wasSetup = !state.settings.initialized;
    openModal(`
      <h2>¿Importar esta copia?</h2>
      <p class="subtitle">Contiene ${imported.invoices.length} ${imported.invoices.length === 1 ? 'factura' : 'facturas'}${imported.settings.name ? ` de ${esc(imported.settings.name)}` : ''}. <strong>Sustituirá todo lo que hay ahora en este dispositivo.</strong></p>
      <div class="modal-actions">
        <button id="cancelImport" class="secondary">Cancelar</button>
        <button id="confirmImport" class="primary blue">Sí, importar</button>
      </div>
    `, false);
    $('#cancelImport').onclick = () => {
      closeModal();
      if (wasSetup) showSetup();
    };
    $('#confirmImport').onclick = () => {
      imported.settings.initialized = true;
      state = imported;
      saveState();
      closeModal();
      toast('Copia importada.');
      setTab('home');
    };
  }

  // ---------- Invoice rendering ----------
  function shortInvoiceDate(s) {
    if (!s) return '';
    const d = parseISODate(s);
    return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function autoInvoiceHeaderDateISO(inv) {
    const dates = (inv.items || []).map(item => item.date).filter(Boolean).sort();
    return dates[0] || inv.createdDate || todayISO();
  }

  function invoiceHeaderDateISO(inv) {
    return inv.headerDate || autoInvoiceHeaderDateISO(inv);
  }

  function invoiceHeaderDate(inv) {
    const d = parseISODate(invoiceHeaderDateISO(inv));
    return new Intl.DateTimeFormat('en-CA', { month:'short', day:'numeric', year:'numeric' }).format(d);
  }

  function plainAmount(n) {
    return Number(n || 0).toFixed(2);
  }

  function fitText(ctx, text, maxWidth) {
    const full = String(text || '');
    let fitted = full;
    while (ctx.measureText(fitted).width > maxWidth && fitted.length > 2) fitted = fitted.slice(0, -2);
    return fitted === full ? full : `${fitted.trimEnd()}…`;
  }

  function drawTextLines(ctx, text, x, y, lineHeight, maxLines, align='left', maxWidth=Infinity) {
    const parts = String(text || '').split(/\n|,/).map(v => v.trim()).filter(Boolean).slice(0,maxLines);
    ctx.textAlign = align;
    parts.forEach((line, i) => ctx.fillText(fitText(ctx, line, maxWidth), x, y + i*lineHeight));
    ctx.textAlign = 'left';
    return parts.length;
  }

  function splitMoney(value) {
    const [whole, cents] = plainAmount(value).split('.');
    return {whole, cents};
  }

  function drawSplitMoney(ctx, value, left, divider, right, y, font='600 20px Arial') {
    const {whole, cents} = splitMoney(value);
    ctx.font = font;
    ctx.fillStyle = '#26384a';
    ctx.textAlign = 'right';
    ctx.fillText(whole, divider - 9, y);
    ctx.textAlign = 'left';
    ctx.fillText(cents, divider + 9, y);
    ctx.textAlign = 'left';
  }

  function newInvoicePage() {
    // US Letter ratio, high enough resolution for sharing/printing.
    const W = 1275, H = 1650;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fffdf8';
    ctx.fillRect(0,0,W,H);
    ctx.textBaseline = 'alphabetic';
    return {c, ctx, W, H};
  }

  function drawCreatorMark(ctx, inv, W, H, right) {
    // Discreet creator mark: visible without competing with the invoice.
    ctx.textAlign='center';
    ctx.fillStyle='#b6babf';
    ctx.font='500 13px Arial';
    ctx.fillText('MBM Invoice · Creado por Mauricio Benitez', W/2, H-28);
    if ((inv.__pageCount || 1) > 1) {
      ctx.textAlign='right';
      ctx.fillStyle='#9aa1a8';
      ctx.font='500 12px Arial';
      ctx.fillText(`PAGE ${(inv.__pageIndex || 0) + 1} / ${inv.__pageCount}`, right, H-28);
    }
    ctx.textAlign='left';
  }

  const DOC_TEXT = {
    es: {
      title: 'FACTURA', date: 'Fecha', taxId: 'Nº fiscal', billTo: 'FACTURAR A', when: 'FECHA', what: 'DESCRIPCIÓN', amount: 'IMPORTE',
      subtotal: 'Subtotal', total: 'TOTAL', tax: 'Impuesto', continued: 'CONTINÚA EN LA PÁGINA SIGUIENTE', continuedNote: 'El total aparece únicamente en la última página.',
      page: (a, b) => `Página ${a} de ${b}`, locale: 'es'
    },
    en: {
      title: 'INVOICE', date: 'Date', taxId: 'Tax ID', billTo: 'BILL TO', when: 'DATE', what: 'DESCRIPTION', amount: 'AMOUNT',
      subtotal: 'Subtotal', total: 'TOTAL', tax: 'Tax', continued: 'CONTINUED ON NEXT PAGE', continuedNote: 'The total appears on the last page only.',
      page: (a, b) => `Page ${a} of ${b}`, locale: 'en-CA'
    }
  };

  // Plain invoice for anyone: sender, client, one line per charge and the total.
  function simpleInvoiceCanvas(inv) {
    const {c, ctx, W, H} = newInvoicePage();
    const t = DOC_TEXT[state.settings.docLang] || DOC_TEXT.es;
    const s = state.settings;
    const cur = currencyOf(inv);
    const ink = '#26384a', muted = '#66727c', line = '#c9d0d6';
    const left = 68, right = 1207;
    const pageCount = inv.__pageCount || 1;
    const pageIndex = inv.__pageIndex || 0;
    const docDate = (iso, month = 'short') => new Intl.DateTimeFormat(t.locale, { day:'numeric', month, year:'numeric' }).format(parseISODate(iso));

    // Sender.
    ctx.fillStyle = ink;
    ctx.font = '700 32px Arial';
    ctx.fillText(fitText(ctx, s.name, 660), left, 96);
    ctx.fillStyle = muted;
    ctx.font = '500 20px Arial';
    let y = 130;
    y += drawTextLines(ctx, s.address, left, y, 27, 3, 'left', 660) * 27;
    if (s.contact) { ctx.fillText(fitText(ctx, s.contact, 660), left, y); y += 27; }
    if (s.taxId) { ctx.fillText(fitText(ctx, `${t.taxId}: ${s.taxId}`, 660), left, y); y += 27; }

    // Document title, number and date.
    ctx.textAlign = 'right';
    ctx.fillStyle = ink;
    ctx.font = '700 44px Arial';
    ctx.fillText(t.title, right, 100);
    ctx.fillStyle = '#c53c33';
    ctx.font = '600 28px Arial';
    ctx.fillText(`#${inv.number}`, right, 142);
    ctx.fillStyle = muted;
    ctx.font = '500 20px Arial';
    ctx.fillText(`${t.date}: ${docDate(invoiceHeaderDateISO(inv), 'long')}`, right, 176);
    if (pageCount > 1) ctx.fillText(t.page(pageIndex + 1, pageCount), right, 204);
    ctx.textAlign = 'left';

    // Client.
    const clientY = 262;
    ctx.fillStyle = '#f0f2f4';
    ctx.fillRect(left, clientY, right-left, 138);
    ctx.fillStyle = muted;
    ctx.font = '700 14px Arial';
    ctx.fillText(t.billTo, left+18, clientY+28);
    ctx.fillStyle = ink;
    ctx.font = '600 24px Arial';
    ctx.fillText(fitText(ctx, clientName(inv), right-left-36), left+18, clientY+60);
    ctx.fillStyle = muted;
    ctx.font = '500 19px Arial';
    drawTextLines(ctx, clientAddress(inv), left+18, clientY+88, 24, 2, 'left', right-left-36);

    // Table.
    const tableY = 424, headerH = 44, rowH = 43, rows = SIMPLE_ROWS_PER_PAGE;
    const descX = left+190, amountX = right-14;
    ctx.fillStyle = ink;
    ctx.fillRect(left, tableY, right-left, headerH);
    ctx.fillStyle = '#fff';
    ctx.font = '700 15px Arial';
    ctx.fillText(t.when, left+14, tableY+28);
    ctx.fillText(t.what, descX, tableY+28);
    ctx.textAlign = 'right';
    ctx.fillText(t.amount, amountX, tableY+28);
    ctx.textAlign = 'left';
    const bodyTop = tableY+headerH;
    inv.items.slice(0,rows).forEach((item,i)=>{
      const rowY = bodyTop+i*rowH+29;
      ctx.fillStyle='#22282e';
      ctx.font='500 18px Arial';
      ctx.fillText(docDate(item.date), left+14, rowY);
      ctx.font='500 20px Arial';
      ctx.fillText(fitText(ctx, item.location, amountX-descX-210), descX, rowY);
      ctx.textAlign='right';
      ctx.fillText(formatMoney(item.amount, cur), amountX, rowY);
      ctx.textAlign='left';
    });
    for (let i=1;i<=rows;i++) {
      ctx.strokeStyle=line;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(left,bodyTop+i*rowH);ctx.lineTo(right,bodyTop+i*rowH);ctx.stroke();
    }

    // Closing section: only the last page shows the total.
    const closeY = bodyTop+rows*rowH;
    if (pageIndex === pageCount-1) {
      const labelX = right-250;
      let rowY = closeY+36;
      const tax = Number(inv.__tax || 0);
      if (tax > 0) {
        ctx.fillStyle=muted;ctx.font='500 20px Arial';ctx.textAlign='right';
        ctx.fillText(t.subtotal,labelX,rowY);ctx.fillText(formatMoney(inv.__subtotal,cur),amountX,rowY);
        rowY += 32;
        ctx.fillText(`${inv.taxLabel || t.tax} (${Number(inv.taxRate)}%)`,labelX,rowY);ctx.fillText(formatMoney(tax,cur),amountX,rowY);
        rowY += 22;
      } else {
        rowY -= 14;
      }
      ctx.fillStyle='#e6e9ec';
      ctx.fillRect(labelX-170,rowY,right-labelX+170,52);
      ctx.fillStyle=ink;ctx.font='700 24px Arial';ctx.textAlign='right';
      ctx.fillText(t.total,labelX,rowY+35);ctx.fillText(formatMoney(inv.__grandTotal,cur),amountX,rowY+35);
      ctx.textAlign='left';
      if (s.note) {
        ctx.fillStyle=muted;ctx.font='500 18px Arial';
        s.note.split('\n').map(v => v.trim()).filter(Boolean).slice(0,2).forEach((text,i)=>ctx.fillText(fitText(ctx,text,right-left),left,rowY+78+i*25));
      }
    } else {
      ctx.fillStyle=ink;ctx.font='700 17px Arial';
      ctx.fillText(t.continued,left,closeY+40);
      ctx.fillStyle=muted;ctx.font='500 16px Arial';
      ctx.fillText(t.continuedNote,left,closeY+66);
    }

    drawCreatorMark(ctx, {}, W, H, right);
    return c;
  }

  function classicInvoiceCanvas(inv) {
    const {c, ctx, W, H} = newInvoicePage();

    const ink = '#33485d';
    const strong = '#293e54';
    const grid = '#71808e';
    const faint = '#aeb8c0';
    const left = 68, right = 1207, width = right-left;
    const pageCount = inv.__pageCount || 1;
    const pageIndex = inv.__pageIndex || 0;
    const isMultiPage = pageCount > 1;
    const isLastPage = pageIndex === pageCount - 1;
    const showClosingSection = !isMultiPage || isLastPage;

    // Seller identity — kept in the same upper area used on the paper form.
    ctx.fillStyle = '#25282c';
    ctx.font = '600 24px Arial';
    ctx.fillText(state.settings.name || '', left + 72, 88);
    ctx.font = '500 19px Arial';
    drawTextLines(ctx, state.settings.address || '', left + 72, 120, 26, 2, 'left');

    // Automatic number: no invoice-number field, just the red number of a paper form.
    ctx.textAlign = 'right';
    ctx.fillStyle = '#c53c33';
    ctx.font = '600 34px Georgia, serif';
    ctx.fillText(String(inv.number), right - 62, 78);
    ctx.textAlign = 'left';

    // Date / tax registration box.
    const boxX = 786, boxY = 102, boxW = 350, boxH = 112;
    ctx.strokeStyle = ink; ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.beginPath(); ctx.moveTo(boxX, boxY + 55); ctx.lineTo(boxX + boxW, boxY + 55); ctx.stroke();
    ctx.fillStyle = strong; ctx.font = '500 13px Arial';
    ctx.fillText('DATE', boxX + 9, boxY + 19);
    ctx.font = '500 20px Arial';
    ctx.fillText(invoiceHeaderDate(inv), boxX + 10, boxY + 47);
    ctx.font = '500 12px Arial';
    ctx.fillText('TAX REG. NO.', boxX + 9, boxY + 75);
    ctx.fillText('N° DE TAXE', boxX + 9, boxY + 91);
    if (state.settings.taxId) {
      ctx.font = '500 18px Arial';
      ctx.fillText(fitText(ctx, state.settings.taxId, boxW - 125), boxX + 112, boxY + 88);
    }

    // SOLD TO / SHIP TO block.
    const top = 244, half = left + width/2;
    const soldH1 = 55, soldH2 = 55, soldH3 = 58;
    ctx.strokeStyle = ink; ctx.lineWidth = 2;
    ctx.strokeRect(left, top, width, soldH1+soldH2+soldH3);
    ctx.beginPath();
    ctx.moveTo(half, top); ctx.lineTo(half, top+soldH1+soldH2+soldH3);
    ctx.moveTo(left, top+soldH1); ctx.lineTo(right, top+soldH1);
    ctx.moveTo(left, top+soldH1+soldH2); ctx.lineTo(right, top+soldH1+soldH2);
    ctx.stroke();
    ctx.fillStyle = '#f0f1f2';
    ctx.fillRect(left+1, top+1, width/2-2, soldH1-2);
    ctx.fillRect(half+1, top+1, width/2-2, soldH1-2);
    ctx.fillStyle = ink; ctx.font = '500 13px Arial';
    ctx.fillText('SOLD TO', left+7, top+18); ctx.fillText('VENDU À', left+7, top+34);
    ctx.fillText('SHIP TO', half+7, top+18); ctx.fillText('EXPÉDIER À', half+7, top+34);
    ctx.fillStyle = '#25282c'; ctx.font = '600 20px Arial';
    ctx.fillText(fitText(ctx, clientName(inv), half-left-126), left+118, top+35);
    ctx.fillStyle = ink; ctx.font = '500 13px Arial';
    ctx.fillText('ADDRESS', left+7, top+soldH1+19); ctx.fillText('ADRESSE', left+7, top+soldH1+35);
    ctx.fillText('ADDRESS', half+7, top+soldH1+19); ctx.fillText('ADRESSE', half+7, top+soldH1+35);
    const soldAddress = clientAddress(inv);
    if (soldAddress) {
      ctx.fillStyle = '#25282c'; ctx.font = '500 18px Arial';
      ctx.fillText(fitText(ctx, soldAddress.replace(/\s*\n\s*/g, ', '), half-left-126), left+118, top+soldH1+33);
    }

    // Order information strip.
    const stripY = top + soldH1 + soldH2 + soldH3 + 11;
    const stripH = 51;
    const stripWidths = [190, 190, 210, 220, width-810];
    const stripLabels = [
      ['CUSTOMER’S ORDER','COMMANDE DU CLIENT'], ['SOLD BY','VENDU PAR'],
      ['FOB','FAB'], ['TERMS','CONDITIONS'], ['VIA','']
    ];
    let sx = left;
    for (let i=0;i<stripWidths.length;i++) {
      ctx.fillStyle = '#eceef0'; ctx.fillRect(sx, stripY, stripWidths[i], stripH);
      ctx.strokeStyle = ink; ctx.lineWidth=2; ctx.strokeRect(sx, stripY, stripWidths[i], stripH);
      ctx.fillStyle=ink; ctx.font='500 12px Arial';
      ctx.fillText(stripLabels[i][0], sx+6, stripY+17);
      if (stripLabels[i][1]) ctx.fillText(stripLabels[i][1], sx+6, stripY+32);
      sx += stripWidths[i];
    }

    // Main table. Keep the paper labels even though the app asks for date, description and amount.
    const tableY = stripY + stripH + 12;
    const headerH = 47;
    const col = {
      qty:left,
      desc:left+112,
      price:left+760,
      unit:left+890,
      amount:left+1000,
      end:right
    };
    ctx.fillStyle = '#3e556d'; ctx.fillRect(left, tableY, width, headerH);
    ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.strokeRect(left,tableY,width,headerH);
    [col.desc,col.price,col.unit,col.amount].forEach(x=>{ctx.beginPath();ctx.moveTo(x,tableY);ctx.lineTo(x,tableY+headerH);ctx.stroke();});
    ctx.fillStyle = '#fff'; ctx.font='700 14px Arial'; ctx.textAlign='center';
    ctx.fillText('QUANTITY', (col.qty+col.desc)/2, tableY+18); ctx.fillText('QUANTITÉ',(col.qty+col.desc)/2,tableY+34);
    ctx.fillText('DESCRIPTION',(col.desc+col.price)/2,tableY+27);
    ctx.fillText('PRICE',(col.price+col.unit)/2,tableY+18); ctx.fillText('PRIX',(col.price+col.unit)/2,tableY+34);
    ctx.fillText('UNIT',(col.unit+col.amount)/2,tableY+18); ctx.fillText('UNITÉ',(col.unit+col.amount)/2,tableY+34);
    ctx.fillText('AMOUNT',(col.amount+col.end)/2,tableY+18); ctx.fillText('MONTANT',(col.amount+col.end)/2,tableY+34);
    ctx.textAlign='left';

    const rowH = 43;
    const rows = CLASSIC_ROWS_PER_PAGE;
    const bodyTop = tableY+headerH;
    const bodyBottom = bodyTop + rows*rowH;
    // Outer and logical vertical lines.
    ctx.strokeStyle=grid; ctx.lineWidth=1.5;
    ctx.strokeRect(left,bodyTop,width,rows*rowH);
    [col.desc,col.price,col.unit,col.amount].forEach(x=>{ctx.beginPath();ctx.moveTo(x,bodyTop);ctx.lineTo(x,bodyBottom);ctx.stroke();});
    // Horizontal writing lines.
    for(let i=1;i<rows;i++){
      const y=bodyTop+i*rowH;
      ctx.strokeStyle=faint;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();
    }
    // Faint dotted cents separators, as on a paper pad.
    const priceDiv = col.price + Math.round((col.unit-col.price)*0.66);
    const amountDiv = col.amount + Math.round((col.end-col.amount)*0.60);
    ctx.save(); ctx.setLineDash([2,4]); ctx.strokeStyle='#b8c0c6'; ctx.lineWidth=1;
    [priceDiv,amountDiv].forEach(x=>{ctx.beginPath();ctx.moveTo(x,bodyTop);ctx.lineTo(x,bodyBottom);ctx.stroke();});
    ctx.restore();

    inv.items.slice(0,rows).forEach((item,i)=>{
      const y=bodyTop+i*rowH+29;
      ctx.fillStyle='#22282e';ctx.font='500 19px Arial';
      ctx.fillText(shortInvoiceDate(item.date), left+12, y);
      ctx.font='500 20px Arial';
      ctx.fillText(fitText(ctx, item.location, col.price-col.desc-28),col.desc+14,y);
      drawSplitMoney(ctx,item.amount,col.amount,amountDiv,col.end,y,'500 20px Arial');
    });

    // Closing section: only the final page (or a single-page invoice) shows taxes and grand total.
    // Earlier pages are continuation sheets: they only carry work rows forward.
    const taxH=36, totalH=48;
    const taxY=bodyBottom;

    if (showClosingSection) {
      // Entire row borders so the amount area continues naturally.
      for(let r=0;r<2;r++){
        const y=taxY+r*taxH;
        ctx.strokeStyle=ink;ctx.lineWidth=1.5;
        ctx.strokeRect(left,y,width,taxH);
        ctx.beginPath();ctx.moveTo(col.amount,y);ctx.lineTo(col.amount,y+taxH);ctx.stroke();
        ctx.save();ctx.setLineDash([2,4]);ctx.strokeStyle='#b8c0c6';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(amountDiv,y);ctx.lineTo(amountDiv,y+taxH);ctx.stroke();ctx.restore();
      }
      ctx.fillStyle=ink;ctx.font='500 13px Arial';ctx.textAlign='right';
      ctx.fillText('TVH/HST',col.amount-8,taxY+15);ctx.fillText('TPS/GST',col.amount-8,taxY+29);
      ctx.fillText('PST/TVP',col.amount-8,taxY+taxH+22);
      ctx.textAlign='left';
      if (Number(inv.__tax || 0) > 0) drawSplitMoney(ctx,inv.__tax,col.amount,amountDiv,col.end,taxY+25,'500 20px Arial');

      const totalY=taxY+taxH*2;
      ctx.fillStyle='#eef0f1';ctx.fillRect(left,totalY,col.amount-left,totalH);
      ctx.fillStyle='#d9dddf';ctx.fillRect(col.amount,totalY,col.end-col.amount,totalH);
      ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.strokeRect(left,totalY,width,totalH);
      ctx.beginPath();ctx.moveTo(col.amount,totalY);ctx.lineTo(col.amount,totalY+totalH);ctx.stroke();
      ctx.save();ctx.setLineDash([2,4]);ctx.strokeStyle='#aeb6bd';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(amountDiv,totalY);ctx.lineTo(amountDiv,totalY+totalH);ctx.stroke();ctx.restore();
      ctx.fillStyle=strong;ctx.font='700 17px Arial';ctx.textAlign='right';ctx.fillText('TOTAL',col.amount-10,totalY+31);ctx.textAlign='left';
      drawSplitMoney(ctx,inv.__grandTotal,col.amount,amountDiv,col.end,totalY+32,'700 22px Arial');

      // Bottom legend from the paper form — reserved for the closing page.
      ctx.fillStyle=strong;ctx.font='400 33px Arial';ctx.textAlign='center';
      ctx.fillText('INVOICE',W/2-65,totalY+103);ctx.fillText('FACTURE',W/2-65,totalY+137);
      ctx.strokeStyle=ink;ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(left,totalY+116);ctx.lineTo(W/2-150,totalY+116);ctx.stroke();
      ctx.beginPath();ctx.moveTo(W/2+42,totalY+116);ctx.lineTo(right,totalY+116);ctx.stroke();
      ctx.textAlign='left';
    } else {
      // Continuation page: no partial total. This makes the sequence read as one invoice.
      const contH = 72;
      ctx.fillStyle='#f3f4f5';
      ctx.fillRect(left,taxY,width,contH);
      ctx.strokeStyle=ink;ctx.lineWidth=1.5;ctx.strokeRect(left,taxY,width,contH);
      ctx.fillStyle=strong;ctx.font='700 17px Arial';
      ctx.fillText('CONTINUED / CONTINUACIÓN',left+18,taxY+29);
      ctx.fillStyle='#66727c';ctx.font='500 14px Arial';
      ctx.fillText('Continúa en la página siguiente. El total aparece únicamente en la última página.',left+18,taxY+53);
      ctx.textAlign='right';
      ctx.fillStyle=strong;ctx.font='600 15px Arial';
      ctx.fillText(`PAGE ${pageIndex + 1} / ${pageCount}  →`,right-18,taxY+31);
      ctx.textAlign='left';
    }

    drawCreatorMark(ctx, inv, W, H, right);
    return c;
  }

  const CLASSIC_ROWS_PER_PAGE = 18;
  const SIMPLE_ROWS_PER_PAGE = 19;

  function invoiceCanvases(inv) {
    const rowsPerPage = isClassic() ? CLASSIC_ROWS_PER_PAGE : SIMPLE_ROWS_PER_PAGE;
    const draw = isClassic() ? classicInvoiceCanvas : simpleInvoiceCanvas;
    const pageCount = Math.max(1, Math.ceil((inv.items || []).length / rowsPerPage));
    const pages = [];
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      pages.push(draw({
        ...inv,
        items: (inv.items || []).slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage),
        headerDate: invoiceHeaderDateISO(inv),
        __subtotal: subtotalInvoice(inv),
        __tax: taxInvoice(inv),
        __grandTotal: totalInvoice(inv),
        __pageIndex: pageIndex,
        __pageCount: pageCount
      }));
    }
    return pages;
  }

  function previewInvoice(id) {
    const inv = state.invoices.find(i => i.id === id);
    if (!inv) return;
    const canvases = invoiceCanvases(inv);
    const pages = canvases.map((canvas, index) => `
      <div class="preview-page">
        ${canvases.length > 1 ? `<div class="muted small" style="margin-bottom:8px">Página ${index + 1} de ${canvases.length}</div>` : ''}
        <div class="paper-preview-wrap"><img class="paper-preview" src="${canvas.toDataURL('image/png')}" alt="Vista previa de la factura, página ${index + 1}" /></div>
      </div>`).join('');
    openModal(`
      <h2>Vista previa</h2>
      <p class="subtitle">Así se verá la factura que recibe tu cliente.</p>
      ${pages}
      <div class="modal-actions one"><button id="closePreview" class="primary">Cerrar</button></div>
    `);
    $('#closePreview').onclick = closeModal;
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  function asciiBytes(s) { return new TextEncoder().encode(s); }

  function jpegsToPdf(images) {
    const parts = []; const offsets = [0]; let len = 0;
    const push = (u8) => { parts.push(u8); len += u8.length; };
    const pushStr = (s) => push(asciiBytes(s));
    pushStr('%PDF-1.4\n%âãÏÓ\n');
    function obj(n, chunks) {
      offsets[n] = len; pushStr(`${n} 0 obj\n`);
      chunks.forEach(ch => typeof ch === 'string' ? pushStr(ch) : push(ch));
      pushStr('\nendobj\n');
    }

    const pageIds = images.map((_, i) => 3 + i * 3);
    obj(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
    obj(2, [`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${images.length} >>`]);

    images.forEach((image, i) => {
      const pageId = 3 + i * 3;
      const imageId = pageId + 1;
      const contentId = pageId + 2;
      const imageName = `Im${i}`;
      obj(pageId, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`]);
      obj(imageId, [`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`, image.bytes, '\nendstream']);
      const stream = asciiBytes(`q\n612 0 0 792 0 0 cm\n/${imageName} Do\nQ\n`);
      obj(contentId, [`<< /Length ${stream.length} >>\nstream\n`, stream, 'endstream']);
    });

    const objectCount = 2 + images.length * 3;
    const xref = len;
    pushStr(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
    for (let i = 1; i <= objectCount; i++) pushStr(String(offsets[i]).padStart(10,'0') + ' 00000 n \n');
    pushStr(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(parts, {type:'application/pdf'});
  }

  async function buildPdf(inv) {
    const canvases = invoiceCanvases(inv);
    const images = [];
    for (const c of canvases) {
      const jpegBlob = await canvasBlob(c, 'image/jpeg', 0.93);
      images.push({ bytes: new Uint8Array(await jpegBlob.arrayBuffer()), width: c.width, height: c.height });
    }
    return jpegsToPdf(images);
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},60000);
  }

  async function blobToDataUrl(blob) {
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function canShareFiles(files) {
    try {
      return !!navigator.share && (!navigator.canShare || navigator.canShare({files}));
    } catch (_) {
      return false;
    }
  }

  // Native Android APK bridge: opens the system share sheet (including WhatsApp).
  async function shareThroughBridge(files) {
    const bridge = window.AndroidBridge;
    if (!bridge) return false;
    try {
      if (files.length === 1 && typeof bridge.shareBase64 === 'function') {
        bridge.shareBase64(await blobToDataUrl(files[0]), files[0].type || 'application/octet-stream', files[0].name);
        return true;
      }
      if (typeof bridge.shareMultipleBase64 === 'function') {
        const dataUrls = [];
        for (const file of files) dataUrls.push(await blobToDataUrl(file));
        bridge.shareMultipleBase64(JSON.stringify(dataUrls), files[0].type || 'image/png', JSON.stringify(files.map(f => f.name)));
        return true;
      }
    } catch (_) {}
    return false;
  }

  // In a browser the files are prepared first and offered on a screen of their own:
  // iPhone only lets a page share right after a direct tap, and preparing them takes too long for that.
  function offerFiles(files, title, message, onDone) {
    const canShare = canShareFiles(files);
    const canOpen = isIOS() && files.length === 1 && files[0].type === 'application/pdf';
    openModal(`
      <h2>${esc(title)}</h2>
      <p class="subtitle">${esc(message)}</p>
      <div class="stack">
        ${canShare ? '<button id="deliverShare" class="primary blue">Compartir</button>' : ''}
        <button id="deliverSave" class="${canShare ? 'secondary' : 'primary blue'}">Guardar en el dispositivo</button>
        ${canOpen ? '<button id="deliverOpen" class="secondary">Abrir</button>' : ''}
        <button id="deliverClose" class="ghost">Cerrar</button>
      </div>
    `);
    const done = () => { if (onDone) onDone(); };
    $('#deliverClose').onclick = closeModal;
    $('#deliverSave').onclick = () => {
      files.forEach(file => downloadBlob(file, file.name));
      done();
      toast(files.length > 1 ? 'Guardando las páginas…' : 'Archivo guardado.');
    };
    if (canShare) {
      $('#deliverShare').onclick = async () => {
        try {
          await navigator.share({files, title: files[0].name});
          done();
          closeModal();
        } catch (e) {
          if (!e || e.name !== 'AbortError') toast('No se pudo compartir. Usa «Guardar en el dispositivo».');
        }
      };
    }
    if (canOpen) {
      $('#deliverOpen').onclick = () => {
        const url = URL.createObjectURL(files[0]);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        done();
      };
    }
  }

  async function deliverFiles(files, title, message, onDone) {
    if (await shareThroughBridge(files)) {
      if (onDone) onDone();
      return;
    }
    offerFiles(files, title, message, onDone);
  }

  async function shareInvoice(id, type) {
    const inv = state.invoices.find(i => i.id === id);
    if (!inv) return;
    toast('Preparando archivo…');
    if (type === 'image') {
      const canvases = invoiceCanvases(inv);
      const files = [];
      for (let i = 0; i < canvases.length; i++) {
        const blob = await canvasBlob(canvases[i], 'image/png');
        const suffix = canvases.length > 1 ? `-pagina-${i + 1}` : '';
        files.push(new File([blob], `Invoice-${inv.number}${suffix}.png`, {type:'image/png'}));
      }
      await deliverFiles(files, files.length > 1 ? `Tus ${files.length} imágenes están listas` : 'Tu imagen está lista', 'Compártela por WhatsApp o guárdala en tu dispositivo.');
    } else {
      const blob = await buildPdf(inv);
      const file = new File([blob], `Invoice-${inv.number}.pdf`, {type:'application/pdf'});
      await deliverFiles([file], 'Tu PDF está listo', 'Compártelo por WhatsApp o correo, o guárdalo en tu dispositivo.');
    }
  }

  // ---------- Install and updates ----------
  async function runInstall() {
    if (!installPrompt) return;
    const promptEvent = installPrompt;
    installPrompt = null;
    promptEvent.prompt();
    await promptEvent.userChoice.catch(() => {});
    if (currentTab === 'home') renderHome();
    if (currentTab === 'settings') renderSettings();
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    renderInstallOffer();
    if (currentTab === 'home' && !$('#modalBackdrop:not(.hidden)')) renderHome();
  });

  // A new version applies by itself, but never while someone is filling in a form:
  // the reload would lose what they typed. Saved invoices are not affected.
  function applyUpdateIfIdle() {
    if (!waitingWorker) return;
    const browsing = (currentTab === 'home' || currentTab === 'history') && modalBackdrop.classList.contains('hidden');
    if (document.visibilityState !== 'hidden' && !browsing) return;
    waitingWorker.postMessage('skipWaiting');
    waitingWorker = null;
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
    const wasControlled = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (wasControlled) location.reload();
    });
    navigator.serviceWorker.register('sw.js').then((reg) => {
      const updateReady = (worker) => {
        if (!worker || !navigator.serviceWorker.controller) return;
        waitingWorker = worker;
        applyUpdateIfIdle();
      };
      updateReady(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed') updateReady(worker);
        });
      });
      // An installed app can stay open for days, so look for updates each time it comes back.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(()=>{});
        applyUpdateIfIdle();
      });
    }).catch(()=>{});
    // Ask the browser not to clear these invoices when it needs space.
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(()=>{});
  }

  // ---------- Account ----------
  // The Android app has no web sign-in: it keeps working without an account.
  function needsAccount() {
    return !window.AndroidBridge && location.protocol.startsWith('http');
  }

  function saveSession() {
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch (_) {}
  }

  function startGoogleLogin() {
    if (!navigator.onLine) return showLogin('Necesitas conexión a internet para entrar.');
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(NONCE_KEY, nonce); } catch (_) {}
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: location.origin + location.pathname.replace(/index\.html$/, ''),
      response_type: 'id_token',
      scope: 'openid email profile',
      nonce,
      prompt: 'select_account'
    });
    location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  // Google comes back with the result after the # of the address.
  function readGoogleReturn() {
    const params = new URLSearchParams(location.hash.slice(1));
    if (!params.has('id_token') && !params.has('error')) return null;
    history.replaceState(null, '', location.pathname);
    let nonce = null;
    try {
      nonce = localStorage.getItem(NONCE_KEY);
      localStorage.removeItem(NONCE_KEY);
    } catch (_) {}
    const idToken = params.get('id_token');
    if (!idToken) return { error: params.get('error') === 'access_denied' ? 'Para usar la app hay que entrar con Google.' : 'Google no pudo completar la entrada. Inténtalo de nuevo.' };
    try {
      const payload = JSON.parse(decodeURIComponent(escape(atob(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))));
      if (nonce && payload.nonce === nonce) return { idToken };
    } catch (_) {}
    return { error: 'No se pudo comprobar la entrada. Inténtalo de nuevo.' };
  }

  function showLogin(message) {
    const blocked = isInAppBrowser();
    document.body.classList.add('ad-over-modal');
    openModal(`
      <div class="kicker">Bienvenido</div>
      <h2>Entra para usar MBM Invoice</h2>
      <p class="subtitle">${blocked ? `Estás dentro de otra aplicación y Google no permite entrar desde aquí. Abre esta página en ${isIOS() ? 'Safari' : 'Chrome'}.` : 'Usa tu cuenta de Google. Tus facturas siguen guardadas solo en este dispositivo: de ti guardamos tu nombre, tu correo y cuándo usas la app.'}</p>
      ${message ? `<p class="login-error" role="alert">${esc(message)}</p>` : ''}
      ${blocked ? '' : '<div class="modal-actions one"><button id="googleLogin" class="primary blue">Continuar con Google</button></div>'}
      <p class="settings-note login-privacy"><a href="privacidad.html">Política de privacidad</a></p>
    `, false);
    const btn = $('#googleLogin');
    if (btn) btn.onclick = startGoogleLogin;
  }

  async function finishLogin(idToken) {
    openModal('<h2>Entrando…</h2><p class="subtitle">Un momento, por favor.</p>', false);
    try {
      const res = await fetch(`${API_URL}/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken })
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      session = { token: data.sesion, nombre: data.nombre, correo: data.correo, admin: !!data.admin };
      saveSession();
      closeModal();
      if (currentTab === 'settings') renderSettings();
      showInstallOffer(finishStart);
    } catch (_) {
      showLogin('No pudimos completar la entrada. Revisa tu conexión e inténtalo de nuevo.');
    }
  }

  // Counts an open. Without internet nothing happens: the app keeps working.
  async function reportUse() {
    try {
      const res = await fetch(`${API_URL}/uso`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ version: APP_VERSION })
      });
      if (res.status === 401) {
        session = null;
        saveSession();
        return showLogin('Tu sesión terminó. Entra de nuevo.');
      }
      if (!res.ok) return;
      const data = await res.json();
      session = { ...session, nombre: data.nombre, correo: data.correo, admin: !!data.admin };
      saveSession();
      if (currentTab === 'settings') renderSettings();
    } catch (_) {}
  }

  function confirmLogout() {
    openModal(`
      <h2>¿Cerrar sesión?</h2>
      <p class="subtitle">Tus facturas seguirán en este dispositivo. Para volver a usarlas tendrás que entrar de nuevo con Google, con internet.</p>
      <div class="modal-actions">
        <button id="cancelLogout" class="secondary">Cancelar</button>
        <button id="confirmLogout" class="danger">Cerrar sesión</button>
      </div>
    `, false);
    $('#cancelLogout').onclick = closeModal;
    $('#confirmLogout').onclick = () => {
      session = null;
      saveSession();
      setTab('home');
      showLogin();
    };
  }

  async function showUsers() {
    openModal('<h2>Usuarios</h2><p class="subtitle">Cargando…</p>');
    const shortDate = (iso) => new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
    let body;
    try {
      const res = await fetch(`${API_URL}/usuarios`, { headers: { Authorization: `Bearer ${session.token}` } });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      body = `
        <p class="subtitle">${data.total} ${data.total === 1 ? 'persona registrada' : 'personas registradas'} · ${data.activos_7_dias} activas en los últimos 7 días</p>
        <div class="user-list">${data.usuarios.map((u) => `
          <div class="user-row">
            <strong>${esc(u.nombre || u.correo)}</strong>
            <span>${esc(u.correo)}</span>
            <span>Desde ${esc(shortDate(u.creado))} · Último uso ${esc(shortDate(u.ultimo_uso))} · ${Number(u.aperturas)} ${Number(u.aperturas) === 1 ? 'apertura' : 'aperturas'}</span>
          </div>`).join('')}</div>`;
    } catch (_) {
      body = '<p class="subtitle">No se pudo cargar la lista. Revisa tu conexión.</p>';
    }
    openModal(`<h2>Usuarios</h2>${body}<div class="modal-actions one"><button id="closeUsers" class="secondary">Cerrar</button></div>`);
    $('#closeUsers').onclick = closeModal;
  }

  // Shown right after signing up, floating over the app.
  let installOfferNext = null;

  function renderInstallOffer() {
    const box = $('#installOffer');
    if (!box) return;
    const iosNote = isIOS() ? ' Al abrirla desde la pantalla de inicio tendrás que entrar otra vez con Google.' : '';
    box.innerHTML = `
      <div class="kicker">Ya tienes tu cuenta</div>
      <h3>¿Quieres instalar la app?</h3>
      <p class="settings-note">${esc(installInstructions() + iosNote)}</p>
      <div class="hint-actions">
        ${installPrompt ? '<button id="installOfferYes" class="primary blue">Instalar</button>' : ''}
        <button id="installOfferNo" class="ghost">${installPrompt ? 'Ahora no' : 'Entendido'}</button>
      </div>`;
    const yes = $('#installOfferYes');
    if (yes) yes.onclick = () => {
      closeInstallOffer();
      runInstall();
    };
    $('#installOfferNo').onclick = closeInstallOffer;
  }

  function closeInstallOffer() {
    const box = $('#installOffer');
    if (box) box.remove();
    const next = installOfferNext;
    installOfferNext = null;
    if (next) next();
  }

  function showInstallOffer(next) {
    if (!canInstall()) return next();
    installOfferNext = next;
    state.installHintDismissed = true;
    saveState();
    if (currentTab === 'home') renderHome();
    const box = document.createElement('section');
    box.id = 'installOffer';
    box.className = 'install-offer';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Instalar la app');
    document.body.appendChild(box);
    renderInstallOffer();
  }

  function finishStart() {
    if (!state.settings.initialized) showSetup();
  }

  function startApp() {
    if (!needsAccount()) return finishStart();
    const googleReturn = readGoogleReturn();
    if (googleReturn && googleReturn.idToken) return finishLogin(googleReturn.idToken);
    if (googleReturn) return showLogin(googleReturn.error);
    if (!session) return showLogin();
    finishStart();
    reportUse();
  }

  // ---------- Events ----------
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'new-invoice') createInvoice();
    if (action === 'continue' || action === 'open-invoice') openInvoiceEditor(btn.dataset.id);
    if (action === 'history') setTab('history');
    if (action === 'settings') setTab('settings');
    if (action === 'save-settings') saveSettings();
    if (action === 'add-work') showWorkModal(btn.dataset.id);
    if (action === 'edit-work') showWorkModal(btn.dataset.invoice, btn.dataset.item);
    if (action === 'finalize') finalizeInvoice(btn.dataset.id);
    if (action === 'preview-invoice') previewInvoice(btn.dataset.id);
    if (action === 'share-image') shareInvoice(btn.dataset.id, 'image');
    if (action === 'share-pdf') shareInvoice(btn.dataset.id, 'pdf');
    if (action === 'reset-header-date') resetInvoiceHeaderDate(btn.dataset.id);
    if (action === 'delete-invoice') confirmDeleteInvoice(btn.dataset.id);
    if (action === 'export-backup') exportBackup();
    if (action === 'import-backup') importFile.click();
    if (action === 'erase-all') confirmEraseAll();
    if (action === 'install') runInstall();
    if (action === 'logout') confirmLogout();
    if (action === 'show-users') showUsers();
    if (action === 'dismiss-install') {
      state.installHintDismissed = true;
      saveState();
      renderHome();
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.matches('#invoiceClientInput, #invoiceClientAddressInput, #invoiceHeaderDateInput')) saveInvoiceFields();
  });

  importFile.addEventListener('change', () => {
    const file = importFile.files[0];
    importFile.value = '';
    if (file) handleImportFile(file);
  });

  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));

  if (window.AndroidBridge || !location.protocol.startsWith('http')) {
    const bar = $('#adBar');
    if (bar) bar.remove();
  }
  registerServiceWorker();
  setTab('home');
  startApp();
})();
