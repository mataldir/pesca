/* =========================================================================
   SISTEMA DE GESTIÓN DE ARTÍCULOS DE PESCA (PWA + SYNC MULTI-DISPOSITIVO)
   ========================================================================= */

const STORAGE_KEY_STATE = 'pesca_pwa_state_v1';
const STORAGE_KEY_SUPABASE = 'pesca_pwa_supabase_cfg_v1';

// Application State
let state = {
  businessName: 'Pesca & Aventura',
  nextSaleNumber: 1001,
  updatedAt: new Date().toISOString(),
  products: [],
  clients: [],
  sales: [],
  serverInfo: {
    port: 3000,
    lanUrls: [],
    activeDevices: 1
  }
};

// UI State
let activeTab = 'pos';
let posCategoryFilter = 'TODOS';
let posSearchQuery = '';
let cart = []; // [{ cartItemId, productId, code, name, unitPrice, quantity, maxStock }]
let quickNewClientMode = false;
let selectedClientIdForDetail = null;
let currentReceiptSale = null;
let deferredPwaPrompt = null;

// Sync State
let syncMode = 'server'; // 'server' | 'supabase' | 'offline'
let sseConnection = null;
let supabaseConfig = loadSupabaseConfig();
let supabasePollTimer = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
  registerServiceWorker();
  setupPwaInstallPrompt();
  bindNavigationEvents();
  bindPosEvents();
  bindStockEvents();
  bindClientsEvents();
  bindSalesEvents();
  bindSyncAndModalsEvents();

  // Load cached state first for instant startup
  const cached = loadLocalState();
  if (cached && Array.isArray(cached.products) && cached.products.length > 0) {
    state = { ...state, ...cached };
    renderAll();
  }

  // Initialize synchronization
  await initSync();
});

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

function setupPwaInstallPrompt() {
  const btnInstall = document.getElementById('btnInstallPwa');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPwaPrompt = e;
    btnInstall.classList.remove('hidden');
  });

  btnInstall.addEventListener('click', async () => {
    if (!deferredPwaPrompt) return;
    deferredPwaPrompt.prompt();
    await deferredPwaPrompt.userChoice;
    deferredPwaPrompt = null;
    btnInstall.classList.add('hidden');
  });
}

// ==================== MULTI-DEVICE SYNCHRONIZATION ====================
function loadSupabaseConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUPABASE);
    if (!raw) return null;
    const cfg = JSON.parse(raw);
    if (cfg && cfg.url && cfg.key) return cfg;
  } catch {}
  return null;
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STATE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalState() {
  try {
    localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state));
  } catch {}
}

async function initSync() {
  if (supabaseConfig && supabaseConfig.url && supabaseConfig.key) {
    syncMode = 'supabase';
    updateSyncIndicator('cloud', 'Sincronizado (Nube)');
    await pullFromSupabase();
    if (supabasePollTimer) clearInterval(supabasePollTimer);
    supabasePollTimer = setInterval(pullFromSupabase, 6000);
    return;
  }

  // Default: Connect to integrated Node.js server API + SSE
  try {
    const res = await fetch('/api/state', { cache: 'no-store' });
    if (!res.ok) throw new Error('Servidor no disponible');
    const serverState = await res.json();
    applyIncomingState(serverState);
    syncMode = 'server';
    updateSyncIndicator('online', formatDevicesLabel(state.serverInfo?.activeDevices || 1));
    connectServerSSE();
  } catch {
    syncMode = 'offline';
    updateSyncIndicator('offline', 'Modo Local (Offline)');
  }
}

function formatDevicesLabel(count) {
  return count > 1 ? `Sincronizado (${count} disp.)` : 'Sincronizado';
}

function connectServerSSE() {
  if (sseConnection) {
    sseConnection.close();
  }
  try {
    sseConnection = new EventSource('/api/events');
    sseConnection.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'connected' || msg.type === 'presence') {
          if (state.serverInfo && msg.activeDevices) {
            state.serverInfo.activeDevices = msg.activeDevices;
          }
          updateSyncIndicator('online', formatDevicesLabel(msg.activeDevices || 1));
        } else if (msg.type === 'state_updated') {
          if (msg.updatedAt !== state.updatedAt) {
            const res = await fetch('/api/state', { cache: 'no-store' });
            if (res.ok) {
              const latest = await res.json();
              applyIncomingState(latest);
            }
          }
        }
      } catch {}
    };
    sseConnection.onerror = () => {
      updateSyncIndicator('offline', 'Reconectando...');
    };
  } catch {}
}

function applyIncomingState(newState) {
  state = {
    ...state,
    businessName: newState.businessName || state.businessName,
    nextSaleNumber: newState.nextSaleNumber || state.nextSaleNumber,
    updatedAt: newState.updatedAt || new Date().toISOString(),
    products: Array.isArray(newState.products) ? newState.products : [],
    clients: Array.isArray(newState.clients) ? newState.clients : [],
    sales: Array.isArray(newState.sales) ? newState.sales : [],
    serverInfo: newState.serverInfo || state.serverInfo
  };
  saveLocalState();
  renderAll();
}

function updateSyncIndicator(statusType, text) {
  const dot = document.getElementById('syncDot');
  const label = document.getElementById('syncStatusText');
  dot.className = `sync-dot ${statusType}`;
  label.textContent = text;
}

function isStateEmpty(s) {
  return !s || (
    (!Array.isArray(s.products) || s.products.length === 0) &&
    (!Array.isArray(s.clients) || s.clients.length === 0) &&
    (!Array.isArray(s.sales) || s.sales.length === 0)
  );
}

// Supabase REST helper for optional static-cloud mode
async function pullFromSupabase() {
  if (!supabaseConfig) return;
  try {
    const endpoint = `${supabaseConfig.url.replace(/\/$/, '')}/rest/v1/pesca_sync_store?id=eq.main&select=*`;
    const res = await fetch(endpoint, {
      headers: {
        apikey: supabaseConfig.key,
        Authorization: `Bearer ${supabaseConfig.key}`
      }
    });
    if (!res.ok) throw new Error('Error leyendo Supabase');
    const rows = await res.json();
    if (rows.length > 0 && rows[0].state) {
      const remoteState = rows[0].state;
      if (!state.updatedAt || remoteState.updatedAt !== state.updatedAt) {
        applyIncomingState(remoteState);
      }
    } else {
      // If local state is empty, try loading server seed/existing data before initializing Supabase
      if (isStateEmpty(state)) {
        try {
          const serverRes = await fetch('/api/state', { cache: 'no-store' });
          if (serverRes.ok) {
            const serverState = await serverRes.json();
            if (!isStateEmpty(serverState)) {
              applyIncomingState(serverState);
            }
          }
        } catch {}
      }
      // Seed initial state to Supabase
      await pushToSupabase();
    }
    updateSyncIndicator('cloud', 'Sincronizado (Nube)');
  } catch {
    updateSyncIndicator('offline', 'Nube sin conexión');
  }
}

async function pushToSupabase() {
  if (!supabaseConfig) return;
  state.updatedAt = new Date().toISOString();
  saveLocalState();
  try {
    const endpoint = `${supabaseConfig.url.replace(/\/$/, '')}/rest/v1/pesca_sync_store`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: supabaseConfig.key,
        Authorization: `Bearer ${supabaseConfig.key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: 'main',
        state: {
          businessName: state.businessName,
          nextSaleNumber: state.nextSaleNumber,
          updatedAt: state.updatedAt,
          products: state.products,
          clients: state.clients,
          sales: state.sales
        },
        updated_at: state.updatedAt
      })
    });
    if (!res.ok) throw new Error('Error guardando en Supabase');
    // Also mirror to local server if running
    fetch('/api/sync/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    }).catch(() => {});
    updateSyncIndicator('cloud', 'Sincronizado (Nube)');
  } catch {
    updateSyncIndicator('offline', 'Guardado local');
  }
}

// ==================== FORMATTERS & HELPERS ====================
function formatCurrency(value) {
  const num = Number(value) || 0;
  return '$' + num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDateTime(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDateShort(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3200);
}

function generateLocalId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// ==================== NAVIGATION ====================
function bindNavigationEvents() {
  const allNavButtons = document.querySelectorAll('[data-tab]');
  allNavButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  document.getElementById('btnLowStockQuick').addEventListener('click', () => {
    document.getElementById('stockLowOnlyCheckbox').checked = true;
    switchTab('stock');
    renderStockSection();
  });

  document.getElementById('btnScrollToTicket').addEventListener('click', () => {
    document.getElementById('posTicketSection').scrollIntoView({ behavior: 'smooth' });
  });
}

function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === `tab-${tabId}`);
  });
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderAll();
}

// ==================== MASTER RENDER ====================
function renderAll() {
  document.getElementById('businessTitle').textContent = state.businessName || 'Artículos de Pesca';
  updateLowStockBadges();
  renderPosSection();
  renderStockSection();
  renderClientsSection();
  renderSalesHistorySection();
}

function updateLowStockBadges() {
  const lowCount = state.products.filter((p) => p.stock <= p.minStock).length;
  const navBadge = document.getElementById('navLowStockBadge');
  const mobBadge = document.getElementById('mobileLowStockBadge');
  const quickPill = document.getElementById('btnLowStockQuick');
  const quickText = document.getElementById('lowStockQuickText');

  if (lowCount > 0) {
    navBadge.textContent = lowCount;
    navBadge.classList.remove('hidden');
    mobBadge.textContent = lowCount;
    mobBadge.classList.remove('hidden');
    quickText.textContent = `⚠ ${lowCount} stock bajo`;
    quickPill.classList.remove('hidden');
  } else {
    navBadge.classList.add('hidden');
    mobBadge.classList.add('hidden');
    quickPill.classList.add('hidden');
  }
}

// ==================== MODULE 1: PUNTO DE VENTA (POS) ====================
function bindPosEvents() {
  const searchInput = document.getElementById('posSearchInput');
  searchInput.addEventListener('input', (e) => {
    posSearchQuery = e.target.value.trim().toLowerCase();
    renderPosCatalog();
  });

  document.getElementById('btnClearCart').addEventListener('click', () => {
    if (cart.length === 0) return;
    cart = [];
    document.getElementById('posDiscountInput').value = '0';
    document.getElementById('posSaleNotes').value = '';
    renderPosTicket();
    renderPosCatalog();
  });

  document.getElementById('btnToggleQuickClient').addEventListener('click', () => {
    quickNewClientMode = !quickNewClientMode;
    const box = document.getElementById('quickClientBox');
    const select = document.getElementById('posClientSelect');
    const btn = document.getElementById('btnToggleQuickClient');
    if (quickNewClientMode) {
      box.classList.remove('hidden');
      select.disabled = true;
      btn.textContent = 'Usar lista de clientes';
      document.getElementById('quickClientName').focus();
    } else {
      box.classList.add('hidden');
      select.disabled = false;
      btn.textContent = '+ Nuevo cliente rápido';
    }
  });

  document.getElementById('posDiscountInput').addEventListener('input', () => {
    renderPosTotalsOnly();
  });

  document.getElementById('btnAddManualItem').addEventListener('click', () => {
    document.getElementById('manualItemForm').reset();
    document.getElementById('manualItemQty').value = '1';
    openModal('manualItemModal');
    document.getElementById('manualItemName').focus();
  });

  document.getElementById('manualItemForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('manualItemName').value.trim();
    const unitPrice = Math.max(0, Number(document.getElementById('manualItemPrice').value) || 0);
    const quantity = Math.max(1, Math.round(Number(document.getElementById('manualItemQty').value) || 1));
    if (!name) return;

    cart.push({
      cartItemId: generateLocalId('ci'),
      productId: null,
      code: 'MANUAL',
      name,
      unitPrice,
      quantity
    });

    closeModal('manualItemModal');
    renderPosTicket();
    showToast(`Agregado: ${name}`);
  });

  document.getElementById('btnConfirmSale').addEventListener('click', handleConfirmSale);
}

function renderPosSection() {
  renderPosCategoryChips();
  renderPosCatalog();
  renderPosClientDropdown();
  renderPosTicket();
}

function getAllCategories() {
  const defaults = ['Reels', 'Cañas', 'Mosquetones', 'Anzuelos', 'Señuelos', 'Líneas y Tanzas', 'Plomadas y Boyas'];
  const set = new Set(defaults);
  state.products.forEach((p) => {
    if (p.category) set.add(p.category);
  });
  return Array.from(set);
}

function renderPosCategoryChips() {
  const bar = document.getElementById('posCategoryBar');
  const categories = ['TODOS', ...getAllCategories()];
  bar.innerHTML = categories
    .map((cat) => {
      const active = posCategoryFilter === cat ? 'active' : '';
      const label = cat === 'TODOS' ? 'Todos' : escapeHtml(cat);
      return `<button type="button" class="chip ${active}" data-pos-cat="${escapeHtml(cat)}">${label}</button>`;
    })
    .join('');

  bar.querySelectorAll('[data-pos-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      posCategoryFilter = btn.getAttribute('data-pos-cat');
      renderPosCategoryChips();
      renderPosCatalog();
    });
  });
}

function renderPosCatalog() {
  const container = document.getElementById('posProductList');
  const filtered = state.products.filter((p) => {
    if (posCategoryFilter !== 'TODOS' && p.category !== posCategoryFilter) {
      return false;
    }
    if (!posSearchQuery) return true;
    const hay = `${p.name} ${p.code || ''} ${p.category || ''} ${p.notes || ''}`.toLowerCase();
    return hay.includes(posSearchQuery);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="cart-empty">No se encontraron artículos con ese filtro.</div>`;
    return;
  }

  container.innerHTML = filtered
    .map((prod) => {
      const inCartItem = cart.find((c) => c.productId === prod.id);
      const inCartQty = inCartItem ? inCartItem.quantity : 0;
      const isOut = prod.stock <= 0;
      const isLow = !isOut && prod.stock <= prod.minStock;

      let stockBadge = `<span class="badge badge-ok">Stock: ${prod.stock} ${escapeHtml(prod.unit || 'unid.')}</span>`;
      if (isOut) {
        stockBadge = `<span class="badge badge-danger">Sin stock (0)</span>`;
      } else if (isLow) {
        stockBadge = `<span class="badge badge-warn">Stock bajo: ${prod.stock} ${escapeHtml(prod.unit || 'unid.')}</span>`;
      }

      const btnLabel = inCartQty > 0 ? `+ En venta (${inCartQty})` : '+ Agregar';

      return `
        <div class="pos-product-item">
          <div class="pos-prod-main">
            <div class="pos-prod-title">
              ${prod.code ? `<span class="text-muted">[${escapeHtml(prod.code)}]</span> ` : ''}${escapeHtml(prod.name)}
            </div>
            <div class="pos-prod-meta">
              <span>${escapeHtml(prod.category || 'General')}</span>
              ${stockBadge}
              ${prod.notes ? `<span>· ${escapeHtml(prod.notes)}</span>` : ''}
            </div>
          </div>
          <div class="pos-prod-right">
            <span class="pos-prod-price">${formatCurrency(prod.price)}</span>
            <button
              type="button"
              class="btn ${inCartQty > 0 ? 'btn-primary' : 'btn-secondary'} btn-sm"
              data-add-prod="${escapeHtml(prod.id)}"
            >
              ${btnLabel}
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('[data-add-prod]').forEach((btn) => {
    btn.addEventListener('click', () => {
      addProductToCart(btn.getAttribute('data-add-prod'));
    });
  });
}

function addProductToCart(productId) {
  const prod = state.products.find((p) => p.id === productId);
  if (!prod) return;

  const existing = cart.find((c) => c.productId === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      cartItemId: generateLocalId('ci'),
      productId: prod.id,
      code: prod.code || '',
      name: prod.name,
      unitPrice: prod.price,
      quantity: 1
    });
  }

  renderPosTicket();
  renderPosCatalog();
}

function renderPosClientDropdown() {
  const select = document.getElementById('posClientSelect');
  const currentVal = select.value;
  const optionsHtml = [
    `<option value="">Cliente Ocasional / Mostrador</option>`,
    ...state.clients.map(
      (c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}${c.phone ? ` (${escapeHtml(c.phone)})` : ''}</option>`
    )
  ].join('');
  select.innerHTML = optionsHtml;
  if (currentVal && state.clients.some((c) => c.id === currentVal)) {
    select.value = currentVal;
  }
}

function renderPosTicket() {
  const container = document.getElementById('cartItemsContainer');
  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        Seleccioná artículos de la lista para armar la venta y calcular el total.
      </div>
    `;
  } else {
    container.innerHTML = cart
      .map((item) => {
        const subtotal = item.quantity * item.unitPrice;
        return `
          <div class="cart-item" data-ci="${escapeHtml(item.cartItemId)}">
            <div class="cart-item-top">
              <span class="cart-item-name">${escapeHtml(item.name)}</span>
              <button type="button" class="cart-item-remove" data-remove-ci="${escapeHtml(item.cartItemId)}" title="Quitar artículo">
                ✕ Quitar
              </button>
            </div>
            <div class="cart-item-controls">
              <div class="qty-control">
                <button type="button" class="qty-btn" data-qty-delta="-1" data-ci="${escapeHtml(item.cartItemId)}">−</button>
                <input
                  type="number"
                  class="qty-input"
                  min="1"
                  step="1"
                  value="${item.quantity}"
                  data-qty-input="${escapeHtml(item.cartItemId)}"
                />
                <button type="button" class="qty-btn" data-qty-delta="1" data-ci="${escapeHtml(item.cartItemId)}">+</button>
              </div>
              <div class="cart-price-group">
                <span>x $</span>
                <input
                  type="number"
                  class="cart-unit-price-input"
                  min="0"
                  step="any"
                  value="${item.unitPrice}"
                  data-price-input="${escapeHtml(item.cartItemId)}"
                  title="Precio unitario"
                />
              </div>
              <span class="cart-item-subtotal" data-subtotal-ci="${escapeHtml(item.cartItemId)}">${formatCurrency(subtotal)}</span>
            </div>
          </div>
        `;
      })
      .join('');

    // Bind events inside cart
    container.querySelectorAll('[data-remove-ci]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ci = btn.getAttribute('data-remove-ci');
        cart = cart.filter((x) => x.cartItemId !== ci);
        renderPosTicket();
        renderPosCatalog();
      });
    });

    container.querySelectorAll('[data-qty-delta]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ci = btn.getAttribute('data-ci');
        const delta = Number(btn.getAttribute('data-qty-delta'));
        const item = cart.find((x) => x.cartItemId === ci);
        if (!item) return;
        item.quantity = Math.max(1, item.quantity + delta);
        renderPosTicket();
        renderPosCatalog();
      });
    });

    container.querySelectorAll('[data-qty-input]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const ci = inp.getAttribute('data-qty-input');
        const item = cart.find((x) => x.cartItemId === ci);
        if (!item) return;
        item.quantity = Math.max(1, Math.round(Number(inp.value) || 1));
        const subEl = container.querySelector(`[data-subtotal-ci="${ci}"]`);
        if (subEl) subEl.textContent = formatCurrency(item.quantity * item.unitPrice);
        renderPosTotalsOnly();
        renderPosCatalog();
      });
    });

    container.querySelectorAll('[data-price-input]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const ci = inp.getAttribute('data-price-input');
        const item = cart.find((x) => x.cartItemId === ci);
        if (!item) return;
        item.unitPrice = Math.max(0, Number(inp.value) || 0);
        const subEl = container.querySelector(`[data-subtotal-ci="${ci}"]`);
        if (subEl) subEl.textContent = formatCurrency(item.quantity * item.unitPrice);
        renderPosTotalsOnly();
      });
    });
  }

  renderPosTotalsOnly();
}

function renderPosTotalsOnly() {
  const totalUnits = cart.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = cart.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  const discount = Math.max(0, Number(document.getElementById('posDiscountInput').value) || 0);
  const finalTotal = Math.max(0, subtotal - discount);

  document.getElementById('cartTotalUnits').textContent = `${totalUnits} (${cart.length} ítem${cart.length === 1 ? '' : 's'})`;
  document.getElementById('cartSubtotalAmount').textContent = formatCurrency(subtotal);
  document.getElementById('cartTotalAmount').textContent = formatCurrency(finalTotal);

  const btnConfirm = document.getElementById('btnConfirmSale');
  btnConfirm.disabled = cart.length === 0;
  btnConfirm.textContent = `Confirmar Venta (${formatCurrency(finalTotal)})`;

  // Mobile sticky bar
  const mobileBar = document.getElementById('mobileCartBar');
  if (cart.length > 0 && activeTab === 'pos') {
    mobileBar.classList.remove('hidden');
    document.getElementById('mobileCartCount').textContent = `${totalUnits} unid.`;
    document.getElementById('mobileCartTotal').textContent = formatCurrency(finalTotal);
  } else {
    mobileBar.classList.add('hidden');
  }
}

async function handleConfirmSale() {
  if (cart.length === 0) return;

  let clientId = document.getElementById('posClientSelect').value || null;
  let clientName = 'Cliente Mostrador';
  let clientPhone = '';
  let saveNewClient = false;

  if (quickNewClientMode) {
    const quickName = document.getElementById('quickClientName').value.trim();
    const quickPhone = document.getElementById('quickClientPhone').value.trim();
    if (!quickName) {
      showToast('Ingresá el nombre del nuevo cliente o desactivá Nuevo cliente rápido.');
      document.getElementById('quickClientName').focus();
      return;
    }
    clientId = null;
    clientName = quickName;
    clientPhone = quickPhone;
    saveNewClient = true;
  } else if (clientId) {
    const found = state.clients.find((c) => c.id === clientId);
    if (found) {
      clientName = found.name;
      clientPhone = found.phone || '';
    }
  }

  const discount = Math.max(0, Number(document.getElementById('posDiscountInput').value) || 0);
  const paymentMethod = document.getElementById('posPaymentMethod').value;
  const notes = document.getElementById('posSaleNotes').value.trim();

  const payload = {
    clientId,
    clientName,
    clientPhone,
    saveNewClient,
    items: cart.map((c) => ({
      productId: c.productId,
      code: c.code,
      name: c.name,
      unitPrice: c.unitPrice,
      quantity: c.quantity
    })),
    discount,
    paymentMethod,
    notes
  };

  let createdSale = null;

  if (syncMode === 'server') {
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        createdSale = data.sale;
        applyIncomingState(data.state);
      }
    } catch {}
  }

  // Fallback for Supabase mode or offline mode
  if (!createdSale) {
    if (saveNewClient && clientName) {
      const newClient = {
        id: generateLocalId('cli'),
        name: clientName,
        phone: clientPhone,
        notes: '',
        createdAt: new Date().toISOString()
      };
      state.clients.unshift(newClient);
      clientId = newClient.id;
    }

    let subtotal = 0;
    const saleItems = cart.map((c) => {
      const prod = state.products.find((p) => p.id === c.productId);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - c.quantity);
        prod.updatedAt = new Date().toISOString();
      }
      const itemSub = c.quantity * c.unitPrice;
      subtotal += itemSub;
      return {
        productId: c.productId,
        code: c.code,
        name: c.name,
        unitPrice: c.unitPrice,
        quantity: c.quantity,
        subtotal: itemSub
      };
    });

    createdSale = {
      id: generateLocalId('sale'),
      number: state.nextSaleNumber++,
      createdAt: new Date().toISOString(),
      clientId,
      clientName,
      clientPhone,
      items: saleItems,
      subtotal,
      discount,
      total: Math.max(0, subtotal - discount),
      paymentMethod,
      notes
    };

    state.sales.unshift(createdSale);
    saveLocalState();
    if (syncMode === 'supabase') {
      await pushToSupabase();
    }
    renderAll();
  }

  // Reset POS ticket
  cart = [];
  document.getElementById('posDiscountInput').value = '0';
  document.getElementById('posSaleNotes').value = '';
  document.getElementById('quickClientName').value = '';
  document.getElementById('quickClientPhone').value = '';
  if (quickNewClientMode) {
    document.getElementById('btnToggleQuickClient').click();
  }
  renderPosTicket();
  renderPosCatalog();

  showToast(`Venta #${createdSale.number} registrada con éxito`);
  openReceiptModal(createdSale);
}

// ==================== RECEIPT & WHATSAPP SHARING ====================
function buildReceiptText(sale) {
  const lines = [];
  lines.push(`*${state.businessName || 'Artículos de Pesca'} — Comprobante #${sale.number || ''}*`);
  lines.push(`Fecha: ${formatDateTime(sale.createdAt)}`);
  lines.push(`Cliente: ${sale.clientName || 'Cliente Mostrador'}`);
  lines.push(`--------------------------------`);
  lines.push(`*Detalle de la compra:*`);
  (sale.items || []).forEach((item) => {
    lines.push(
      `• ${item.quantity}x ${item.name} (${formatCurrency(item.unitPrice)} c/u) = *${formatCurrency(item.subtotal)}*`
    );
  });
  lines.push(`--------------------------------`);
  if (sale.discount > 0) {
    lines.push(`Subtotal: ${formatCurrency(sale.subtotal)}`);
    lines.push(`Descuento: -${formatCurrency(sale.discount)}`);
  }
  lines.push(`*PRECIO TOTAL: ${formatCurrency(sale.total)}*`);
  lines.push(`Medio de pago: ${sale.paymentMethod || 'Efectivo'}`);
  if (sale.notes) {
    lines.push(`Nota: ${sale.notes}`);
  }
  lines.push(`¡Gracias por tu compra!`);
  return lines.join('\n');
}

function openReceiptModal(sale) {
  currentReceiptSale = sale;
  document.getElementById('receiptModalTitle').textContent = `Comprobante de Venta #${sale.number || ''}`;
  document.getElementById('receiptTextPreview').textContent = buildReceiptText(sale);
  openModal('receiptModal');
}

function normalizeWhatsAppPhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/[^\d]/g, '');
}

// ==================== MODULE 2: STOCK / INVENTARIO ====================
function bindStockEvents() {
  document.getElementById('btnNewProduct').addEventListener('click', () => {
    openProductModal(null);
  });

  document.getElementById('stockSearchInput').addEventListener('input', renderStockSection);
  document.getElementById('stockCategorySelect').addEventListener('change', renderStockSection);
  document.getElementById('stockLowOnlyCheckbox').addEventListener('change', renderStockSection);

  document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveProductFromModal();
  });

  document.getElementById('btnDeleteProduct').addEventListener('click', async () => {
    const prodId = document.getElementById('prodId').value;
    if (!prodId) return;
    if (!confirm('¿Seguro que querés eliminar este artículo del inventario?')) return;
    await deleteProduct(prodId);
    closeModal('productModal');
  });

  document.getElementById('stockAdjustForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const prodId = document.getElementById('adjustProdId').value;
    const delta = Math.round(Number(document.getElementById('adjustDeltaInput').value) || 0);
    const newPrice = Number(document.getElementById('adjustNewPriceInput').value) || 0;
    const prod = state.products.find((p) => p.id === prodId);
    if (!prod) return;

    const updated = {
      ...prod,
      stock: Math.max(0, prod.stock + delta),
      price: newPrice > 0 ? newPrice : prod.price
    };

    await upsertProduct(updated);
    closeModal('stockAdjustModal');
    showToast(`Stock actualizado: ${updated.name} (${updated.stock})`);
  });
}

function renderStockSection() {
  // Stats
  const totalProducts = state.products.length;
  const totalUnits = state.products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
  const lowStockCount = state.products.filter((p) => p.stock <= p.minStock).length;
  const inventoryValue = state.products.reduce((acc, p) => acc + (Number(p.stock) || 0) * (Number(p.price) || 0), 0);

  document.getElementById('statTotalProducts').textContent = totalProducts;
  document.getElementById('statTotalUnits').textContent = totalUnits;
  document.getElementById('statLowStockCount').textContent = lowStockCount;
  document.getElementById('statInventoryValue').textContent = formatCurrency(inventoryValue);

  // Category Select
  const catSelect = document.getElementById('stockCategorySelect');
  const prevCat = catSelect.value || 'ALL';
  const categories = getAllCategories();
  catSelect.innerHTML = [
    `<option value="ALL">Todas las categorías</option>`,
    ...categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
  ].join('');
  if (prevCat === 'ALL' || categories.includes(prevCat)) {
    catSelect.value = prevCat;
  }

  const query = document.getElementById('stockSearchInput').value.trim().toLowerCase();
  const selectedCat = catSelect.value;
  const lowOnly = document.getElementById('stockLowOnlyCheckbox').checked;

  const filtered = state.products.filter((p) => {
    if (selectedCat !== 'ALL' && p.category !== selectedCat) return false;
    if (lowOnly && p.stock > p.minStock) return false;
    if (!query) return true;
    const hay = `${p.name} ${p.code || ''} ${p.category || ''} ${p.notes || ''}`.toLowerCase();
    return hay.includes(query);
  });

  const tbody = document.getElementById('stockTableBody');
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted" style="padding: 2rem;">
          No hay artículos que coincidan con la búsqueda.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map((prod) => {
      const isOut = prod.stock <= 0;
      const isLow = !isOut && prod.stock <= prod.minStock;
      const rowClass = isOut ? 'row-out-stock' : isLow ? 'row-low-stock' : '';

      let statusBadge = `<span class="badge badge-ok">Normal</span>`;
      if (isOut) {
        statusBadge = `<span class="badge badge-danger">Sin stock</span>`;
      } else if (isLow) {
        statusBadge = `<span class="badge badge-warn">Stock bajo (mín. ${prod.minStock})</span>`;
      }

      return `
        <tr class="${rowClass}">
          <td>
            <div class="font-semibold">
              ${prod.code ? `<span class="text-muted">[${escapeHtml(prod.code)}]</span> ` : ''}${escapeHtml(prod.name)}
            </div>
            ${prod.notes ? `<div class="text-xs text-muted">${escapeHtml(prod.notes)}</div>` : ''}
          </td>
          <td>${escapeHtml(prod.category || 'Otros')}</td>
          <td class="text-right font-semibold">${formatCurrency(prod.price)}</td>
          <td class="text-center">
            <div class="stock-Quick-btns">
              <button type="button" class="btn btn-secondary btn-sm" data-quick-delta="-1" data-id="${escapeHtml(prod.id)}" title="Restar 1">−</button>
              <span class="stock-num">${prod.stock}</span>
              <button type="button" class="btn btn-secondary btn-sm" data-quick-delta="1" data-id="${escapeHtml(prod.id)}" title="Sumar 1">+</button>
            </div>
            <div class="text-xs text-muted">${escapeHtml(prod.unit || 'unid.')}</div>
          </td>
          <td class="text-center">${statusBadge}</td>
          <td class="text-right">
            <button type="button" class="btn btn-secondary btn-sm" data-restock-id="${escapeHtml(prod.id)}">+ Ingreso</button>
            <button type="button" class="btn btn-outline btn-sm" data-edit-prod="${escapeHtml(prod.id)}">Editar</button>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('[data-quick-delta]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const delta = Number(btn.getAttribute('data-quick-delta'));
      adjustProductStockQuick(id, delta);
    });
  });

  tbody.querySelectorAll('[data-restock-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openRestockModal(btn.getAttribute('data-restock-id'));
    });
  });

  tbody.querySelectorAll('[data-edit-prod]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prod = state.products.find((p) => p.id === btn.getAttribute('data-edit-prod'));
      if (prod) openProductModal(prod);
    });
  });
}

function openProductModal(product) {
  const isEdit = Boolean(product);
  document.getElementById('productModalTitle').textContent = isEdit ? 'Editar Artículo' : 'Nuevo Artículo de Pesca';
  document.getElementById('prodId').value = product ? product.id : '';
  document.getElementById('prodName').value = product ? product.name : '';
  document.getElementById('prodCode').value = product ? product.code || '' : '';
  document.getElementById('prodCategory').value = product ? product.category || 'Reels' : 'Reels';
  document.getElementById('prodUnit').value = product ? product.unit || 'unid.' : 'unid.';
  document.getElementById('prodPrice').value = product ? product.price : '';
  document.getElementById('prodStock').value = product ? product.stock : '0';
  document.getElementById('prodMinStock').value = product ? product.minStock ?? 3 : '3';
  document.getElementById('prodNotes').value = product ? product.notes || '' : '';

  document.getElementById('btnDeleteProduct').classList.toggle('hidden', !isEdit);
  openModal('productModal');
  document.getElementById('prodName').focus();
}

function openRestockModal(productId) {
  const prod = state.products.find((p) => p.id === productId);
  if (!prod) return;
  document.getElementById('adjustProdId').value = prod.id;
  document.getElementById('adjustProdName').textContent = prod.name;
  document.getElementById('adjustCurrentStock').textContent = `${prod.stock} ${prod.unit || 'unid.'}`;
  document.getElementById('adjustDeltaInput').value = '5';
  document.getElementById('adjustNewPriceInput').value = prod.price;
  openModal('stockAdjustModal');
  document.getElementById('adjustDeltaInput').focus();
}

async function saveProductFromModal() {
  const productData = {
    id: document.getElementById('prodId').value || undefined,
    name: document.getElementById('prodName').value.trim(),
    code: document.getElementById('prodCode').value.trim(),
    category: document.getElementById('prodCategory').value.trim() || 'Otros',
    unit: document.getElementById('prodUnit').value.trim() || 'unid.',
    price: Math.max(0, Number(document.getElementById('prodPrice').value) || 0),
    stock: Math.max(0, Math.round(Number(document.getElementById('prodStock').value) || 0)),
    minStock: Math.max(0, Math.round(Number(document.getElementById('prodMinStock').value) || 0)),
    notes: document.getElementById('prodNotes').value.trim()
  };

  if (!productData.name) return;
  await upsertProduct(productData);
  closeModal('productModal');
  showToast('Artículo guardado');
}

async function upsertProduct(productData) {
  if (syncMode === 'server') {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      if (res.ok) {
        const data = await res.json();
        applyIncomingState(data.state);
        return;
      }
    } catch {}
  }

  // Fallback for Supabase or offline
  const item = {
    ...productData,
    id: productData.id || generateLocalId('prod'),
    updatedAt: new Date().toISOString()
  };
  const idx = state.products.findIndex((p) => p.id === item.id);
  if (idx >= 0) {
    state.products[idx] = item;
  } else {
    state.products.unshift(item);
  }
  saveLocalState();
  if (syncMode === 'supabase') await pushToSupabase();
  renderAll();
}

async function adjustProductStockQuick(productId, delta) {
  if (syncMode === 'server') {
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta })
      });
      if (res.ok) {
        const data = await res.json();
        applyIncomingState(data.state);
        return;
      }
    } catch {}
  }

  const prod = state.products.find((p) => p.id === productId);
  if (!prod) return;
  prod.stock = Math.max(0, prod.stock + delta);
  prod.updatedAt = new Date().toISOString();
  saveLocalState();
  if (syncMode === 'supabase') await pushToSupabase();
  renderAll();
}

async function deleteProduct(productId) {
  if (syncMode === 'server') {
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        applyIncomingState(data.state);
        showToast('Artículo eliminado');
        return;
      }
    } catch {}
  }

  state.products = state.products.filter((p) => p.id !== productId);
  saveLocalState();
  if (syncMode === 'supabase') await pushToSupabase();
  renderAll();
  showToast('Artículo eliminado');
}

// ==================== MODULE 3: CLIENTES E HISTORIAL DE OPERACIONES ====================
function bindClientsEvents() {
  document.getElementById('btnNewClient').addEventListener('click', () => {
    openClientModal(null);
  });

  document.getElementById('clientSearchInput').addEventListener('input', renderClientsSection);

  document.getElementById('clientForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveClientFromModal();
  });

  document.getElementById('btnDeleteClient').addEventListener('click', async () => {
    const clientId = document.getElementById('clientId').value;
    if (!clientId) return;
    if (!confirm('¿Seguro que querés eliminar este cliente? Sus ventas pasadas se conservarán en el historial.')) return;
    await deleteClient(clientId);
    closeModal('clientModal');
  });
}

function getClientStats(clientId) {
  const clientSales = state.sales.filter((s) => s.clientId === clientId);
  const totalSpent = clientSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  const lastSaleDate = clientSales.length > 0 ? clientSales[0].createdAt : null;
  return {
    salesCount: clientSales.length,
    totalSpent,
    lastSaleDate,
    sales: clientSales
  };
}

function renderClientsSection() {
  const listContainer = document.getElementById('clientsListContainer');
  const query = document.getElementById('clientSearchInput').value.trim().toLowerCase();

  const filteredClients = state.clients.filter((c) => {
    if (!query) return true;
    const hay = `${c.name} ${c.phone || ''} ${c.notes || ''}`.toLowerCase();
    return hay.includes(query);
  });

  if (!selectedClientIdForDetail && filteredClients.length > 0) {
    selectedClientIdForDetail = filteredClients[0].id;
  }

  const walkInSales = state.sales.filter((s) => !s.clientId);

  let html = filteredClients
    .map((client) => {
      const stats = getClientStats(client.id);
      const isActive = selectedClientIdForDetail === client.id ? 'active' : '';
      return `
        <div class="client-item ${isActive}" data-select-client="${escapeHtml(client.id)}">
          <div>
            <div class="client-item-name">${escapeHtml(client.name)}</div>
            <div class="client-item-meta">
              ${client.phone ? `📞 ${escapeHtml(client.phone)} · ` : ''}
              ${stats.salesCount} compra${stats.salesCount === 1 ? '' : 's'}
            </div>
          </div>
          <div class="text-right">
            <div class="font-semibold">${formatCurrency(stats.totalSpent)}</div>
            <div class="text-xs text-muted">${stats.lastSaleDate ? formatDateShort(stats.lastSaleDate) : 'Sin compras'}</div>
          </div>
        </div>
      `;
    })
    .join('');

  // Also allow viewing Walk-in / Unassigned sales
  if (!query || 'cliente mostrador ocasional'.includes(query)) {
    const walkInTotal = walkInSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const isWalkInActive = selectedClientIdForDetail === '__WALKIN__' ? 'active' : '';
    html += `
      <div class="client-item ${isWalkInActive}" data-select-client="__WALKIN__">
        <div>
          <div class="client-item-name">Ventas de Mostrador (Ocasionales)</div>
          <div class="client-item-meta">${walkInSales.length} operación(es) sin cliente asignado</div>
        </div>
        <div class="text-right">
          <div class="font-semibold">${formatCurrency(walkInTotal)}</div>
        </div>
      </div>
    `;
  }

  listContainer.innerHTML = html || `<div class="cart-empty">No hay clientes registrados con ese filtro.</div>`;

  listContainer.querySelectorAll('[data-select-client]').forEach((el) => {
    el.addEventListener('click', () => {
      selectedClientIdForDetail = el.getAttribute('data-select-client');
      renderClientsSection();
    });
  });

  renderSelectedClientDetail();
}

function renderSelectedClientDetail() {
  const detailContainer = document.getElementById('clientDetailContent');

  if (selectedClientIdForDetail === '__WALKIN__') {
    const walkInSales = state.sales.filter((s) => !s.clientId);
    const total = walkInSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    detailContainer.innerHTML = `
      <div class="client-detail-header">
        <div>
          <h3>Ventas de Mostrador (Clientes Ocasionales)</h3>
          <p class="text-sm text-muted">Operaciones realizadas sin asociar a un cliente fijo</p>
        </div>
        <div class="text-right">
          <span class="text-xs text-muted">Total acumulado</span>
          <div class="stat-value">${formatCurrency(total)}</div>
        </div>
      </div>
      <h4 style="margin-bottom: 0.65rem;">Historial de operaciones (${walkInSales.length})</h4>
      <div class="client-history-list">
        ${walkInSales.length > 0 ? walkInSales.map(renderSaleCardHtml).join('') : `<div class="cart-empty">No hay ventas de mostrador registradas.</div>`}
      </div>
    `;
    bindSaleCardButtons(detailContainer);
    return;
  }

  const client = state.clients.find((c) => c.id === selectedClientIdForDetail);
  if (!client) {
    detailContainer.innerHTML = `
      <div class="cart-empty">
        Seleccioná un cliente de la lista de la izquierda para ver su historial completo de compras.
      </div>
    `;
    return;
  }

  const stats = getClientStats(client.id);
  const waPhone = normalizeWhatsAppPhone(client.phone);

  detailContainer.innerHTML = `
    <div class="client-detail-header">
      <div>
        <h3 style="font-size: 1.2rem;">${escapeHtml(client.name)}</h3>
        <div class="text-sm text-muted" style="margin-top: 0.2rem;">
          ${client.phone ? `Teléfono / WhatsApp: <strong>${escapeHtml(client.phone)}</strong>` : 'Sin teléfono registrado'}
        </div>
        ${client.notes ? `<div class="text-sm text-muted" style="margin-top: 0.2rem;">Nota: ${escapeHtml(client.notes)}</div>` : ''}
      </div>
      <div class="sync-btn-row">
        ${
          waPhone
            ? `<a href="https://wa.me/${waPhone}" target="_blank" rel="noopener" class="btn btn-whatsapp btn-sm">Abrir Chat WhatsApp</a>`
            : ''
        }
        <button type="button" class="btn btn-primary btn-sm" id="btnSellToThisClient">Nueva venta a este cliente</button>
        <button type="button" class="btn btn-outline btn-sm" id="btnEditSelectedClient">Editar datos</button>
      </div>
    </div>

    <div class="stats-strip" style="margin-bottom: 1rem;">
      <div class="stat-box">
        <span class="stat-label">Compras realizadas</span>
        <strong class="stat-value">${stats.salesCount}</strong>
      </div>
      <div class="stat-box">
        <span class="stat-label">Total histórico comprado</span>
        <strong class="stat-value">${formatCurrency(stats.totalSpent)}</strong>
      </div>
      <div class="stat-box">
        <span class="stat-label">Última operación</span>
        <strong class="stat-value" style="font-size: 1rem;">${stats.lastSaleDate ? formatDateTime(stats.lastSaleDate) : 'Sin compras'}</strong>
      </div>
    </div>

    <h4 style="margin-bottom: 0.65rem;">Historial de compras anteriores de ${escapeHtml(client.name)}</h4>
    <div class="client-history-list">
      ${
        stats.sales.length > 0
          ? stats.sales.map(renderSaleCardHtml).join('')
          : `<div class="cart-empty">Este cliente todavía no tiene compras registradas.</div>`
      }
    </div>
  `;

  document.getElementById('btnEditSelectedClient')?.addEventListener('click', () => {
    openClientModal(client);
  });

  document.getElementById('btnSellToThisClient')?.addEventListener('click', () => {
    if (quickNewClientMode) {
      document.getElementById('btnToggleQuickClient').click();
    }
    switchTab('pos');
    document.getElementById('posClientSelect').value = client.id;
    showToast(`Cliente seleccionado: ${client.name}`);
  });

  bindSaleCardButtons(detailContainer);
}

function openClientModal(client) {
  const isEdit = Boolean(client);
  document.getElementById('clientModalTitle').textContent = isEdit ? 'Editar Cliente' : 'Nuevo Cliente';
  document.getElementById('clientId').value = client ? client.id : '';
  document.getElementById('clientName').value = client ? client.name : '';
  document.getElementById('clientPhone').value = client ? client.phone || '' : '';
  document.getElementById('clientNotes').value = client ? client.notes || '' : '';
  document.getElementById('btnDeleteClient').classList.toggle('hidden', !isEdit);
  openModal('clientModal');
  document.getElementById('clientName').focus();
}

async function saveClientFromModal() {
  const clientData = {
    id: document.getElementById('clientId').value || undefined,
    name: document.getElementById('clientName').value.trim(),
    phone: document.getElementById('clientPhone').value.trim(),
    notes: document.getElementById('clientNotes').value.trim()
  };
  if (!clientData.name) return;

  if (syncMode === 'server') {
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData)
      });
      if (res.ok) {
        const data = await res.json();
        selectedClientIdForDetail = data.client.id;
        applyIncomingState(data.state);
        closeModal('clientModal');
        showToast('Cliente guardado');
        return;
      }
    } catch {}
  }

  const item = {
    ...clientData,
    id: clientData.id || generateLocalId('cli'),
    createdAt: new Date().toISOString()
  };
  const idx = state.clients.findIndex((c) => c.id === item.id);
  if (idx >= 0) {
    state.clients[idx] = item;
  } else {
    state.clients.unshift(item);
  }
  selectedClientIdForDetail = item.id;
  saveLocalState();
  if (syncMode === 'supabase') await pushToSupabase();
  renderAll();
  closeModal('clientModal');
  showToast('Cliente guardado');
}

async function deleteClient(clientId) {
  if (syncMode === 'server') {
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        if (selectedClientIdForDetail === clientId) selectedClientIdForDetail = null;
        applyIncomingState(data.state);
        showToast('Cliente eliminado');
        return;
      }
    } catch {}
  }

  state.clients = state.clients.filter((c) => c.id !== clientId);
  if (selectedClientIdForDetail === clientId) selectedClientIdForDetail = null;
  saveLocalState();
  if (syncMode === 'supabase') await pushToSupabase();
  renderAll();
  showToast('Cliente eliminado');
}

// ==================== MODULE 4: HISTORIAL GENERAL DE VENTAS ====================
function bindSalesEvents() {
  document.getElementById('salesSearchInput').addEventListener('input', renderSalesHistorySection);
}

function renderSaleCardHtml(sale) {
  const itemsHtml = (sale.items || [])
    .map(
      (item) => `
      <li>
        <span><strong>${item.quantity}x</strong> ${escapeHtml(item.name)} <span class="text-muted">(${formatCurrency(item.unitPrice)} c/u)</span></span>
        <span class="font-semibold">${formatCurrency(item.subtotal)}</span>
      </li>
    `
    )
    .join('');

  return `
    <div class="sale-card">
      <div class="sale-card-header">
        <div>
          <strong>Venta #${sale.number || '-'}</strong>
          <span class="text-muted text-sm"> · ${formatDateTime(sale.createdAt)}</span>
        </div>
        <div>
          <span class="badge badge-ok">${escapeHtml(sale.paymentMethod || 'Efectivo')}</span>
        </div>
      </div>

      <div class="text-sm" style="margin-bottom: 0.45rem;">
        Cliente: <strong>${escapeHtml(sale.clientName || 'Cliente Mostrador')}</strong>
        ${sale.clientPhone ? `<span class="text-muted">(${escapeHtml(sale.clientPhone)})</span>` : ''}
      </div>

      <ul class="sale-items-summary">
        ${itemsHtml}
      </ul>

      ${sale.notes ? `<div class="text-xs text-muted" style="margin-bottom: 0.4rem;">Nota: ${escapeHtml(sale.notes)}</div>` : ''}

      <div class="sale-card-footer">
        <div>
          ${sale.discount > 0 ? `<span class="text-xs text-muted">Desc: -${formatCurrency(sale.discount)} · </span>` : ''}
          <span style="font-size: 1.05rem; font-weight: 800;">Total: ${formatCurrency(sale.total)}</span>
        </div>
        <div class="sync-btn-row">
          <button type="button" class="btn btn-whatsapp btn-sm" data-receipt-sale="${escapeHtml(sale.id)}">
            Comprobante / WhatsApp
          </button>
          <button type="button" class="btn btn-danger btn-sm" data-cancel-sale="${escapeHtml(sale.id)}">
            Anular
          </button>
        </div>
      </div>
    </div>
  `;
}

function bindSaleCardButtons(container) {
  container.querySelectorAll('[data-receipt-sale]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sale = state.sales.find((s) => s.id === btn.getAttribute('data-receipt-sale'));
      if (sale) openReceiptModal(sale);
    });
  });

  container.querySelectorAll('[data-cancel-sale]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const saleId = btn.getAttribute('data-cancel-sale');
      const sale = state.sales.find((s) => s.id === saleId);
      if (!sale) return;
      if (!confirm(`¿Anular la Venta #${sale.number || ''} por ${formatCurrency(sale.total)}? Las cantidades vendidas se devolverán automáticamente al stock.`)) {
        return;
      }
      await cancelSale(saleId);
    });
  });
}

function renderSalesHistorySection() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

  let todayAmount = 0;
  let todayCount = 0;
  let monthAmount = 0;
  let monthCount = 0;
  let totalAmount = 0;

  state.sales.forEach((s) => {
    const t = new Date(s.createdAt).getTime();
    const val = Number(s.total) || 0;
    totalAmount += val;
    if (t >= startOfToday) {
      todayAmount += val;
      todayCount++;
    }
    if (t >= thirtyDaysAgo) {
      monthAmount += val;
      monthCount++;
    }
  });

  document.getElementById('statSalesTodayAmount').textContent = formatCurrency(todayAmount);
  document.getElementById('statSalesTodayCount').textContent = `${todayCount} operación(es)`;
  document.getElementById('statSalesMonthAmount').textContent = formatCurrency(monthAmount);
  document.getElementById('statSalesMonthCount').textContent = `${monthCount} operación(es)`;
  document.getElementById('statSalesTotalAmount').textContent = formatCurrency(totalAmount);
  document.getElementById('statSalesTotalCount').textContent = `${state.sales.length} operación(es)`;

  const query = document.getElementById('salesSearchInput').value.trim().toLowerCase();
  const filtered = state.sales.filter((s) => {
    if (!query) return true;
    const itemsText = (s.items || []).map((i) => i.name).join(' ');
    const hay = `#${s.number} ${s.clientName || ''} ${s.clientPhone || ''} ${s.paymentMethod || ''} ${s.notes || ''} ${itemsText}`.toLowerCase();
    return hay.includes(query);
  });

  const listEl = document.getElementById('salesHistoryList');
  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="card cart-empty">No se encontraron ventas registradas.</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(renderSaleCardHtml).join('');
  bindSaleCardButtons(listEl);
}

async function cancelSale(saleId) {
  if (syncMode === 'server') {
    try {
      const res = await fetch(`/api/sales/${encodeURIComponent(saleId)}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        applyIncomingState(data.state);
        showToast('Venta anulada y stock restaurado');
        return;
      }
    } catch {}
  }

  const idx = state.sales.findIndex((s) => s.id === saleId);
  if (idx === -1) return;
  const [removed] = state.sales.splice(idx, 1);
  (removed.items || []).forEach((item) => {
    if (item.productId) {
      const prod = state.products.find((p) => p.id === item.productId);
      if (prod) prod.stock += Number(item.quantity) || 0;
    }
  });
  saveLocalState();
  if (syncMode === 'supabase') await pushToSupabase();
  renderAll();
  showToast('Venta anulada y stock restaurado');
}

// ==================== MODALS & SYNC SETTINGS ====================
function openModal(id) {
  document.getElementById(id)?.classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

function bindSyncAndModalsEvents() {
  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeModal(btn.getAttribute('data-close'));
    });
  });

  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.classList.add('hidden');
      }
    });
  });

  // Receipt actions
  document.getElementById('btnShareWhatsApp').addEventListener('click', () => {
    if (!currentReceiptSale) return;
    const text = buildReceiptText(currentReceiptSale);
    const phone = normalizeWhatsAppPhone(currentReceiptSale.clientPhone);
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener');
  });

  document.getElementById('btnCopyReceipt').addEventListener('click', async () => {
    if (!currentReceiptSale) return;
    const text = buildReceiptText(currentReceiptSale);
    try {
      await navigator.clipboard.writeText(text);
      showToast('Resumen copiado al portapapeles');
    } catch {
      showToast('No se pudo copiar automáticamente');
    }
  });

  document.getElementById('btnPrintReceipt').addEventListener('click', () => {
    window.print();
  });

  // Sync Modal
  document.getElementById('btnSyncModal').addEventListener('click', () => {
    document.getElementById('settingsBusinessName').value = state.businessName || '';
    document.getElementById('supabaseUrlInput').value = supabaseConfig?.url || '';
    document.getElementById('supabaseKeyInput').value = supabaseConfig?.key || '';

    const urlsBox = document.getElementById('lanUrlsList');
    const urls = state.serverInfo?.lanUrls || [];
    if (urls.length > 0) {
      urlsBox.innerHTML = urls
        .map((u) => `<div>🔗 <strong>${escapeHtml(u)}</strong></div>`)
        .join('');
    } else {
      urlsBox.innerHTML = `<div>🔗 <strong>${escapeHtml(window.location.origin)}</strong></div>`;
    }

    openModal('syncModal');
  });

  document.getElementById('btnSaveBusinessName').addEventListener('click', async () => {
    const newName = document.getElementById('settingsBusinessName').value.trim();
    if (!newName) return;
    state.businessName = newName;
    if (syncMode === 'server') {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: newName })
      }).catch(() => {});
    }
    saveLocalState();
    if (syncMode === 'supabase') await pushToSupabase();
    renderAll();
    showToast('Nombre actualizado');
  });

  document.getElementById('btnSaveSupabase').addEventListener('click', async () => {
    const url = document.getElementById('supabaseUrlInput').value.trim();
    const key = document.getElementById('supabaseKeyInput').value.trim();
    if (!url || !key) {
      showToast('Ingresá tanto la URL como la Anon Key de Supabase');
      return;
    }
    supabaseConfig = { url, key };
    localStorage.setItem(STORAGE_KEY_SUPABASE, JSON.stringify(supabaseConfig));
    await initSync();
    showToast('Conectado a nube Supabase');
  });

  document.getElementById('btnDisconnectSupabase').addEventListener('click', async () => {
    supabaseConfig = null;
    localStorage.removeItem(STORAGE_KEY_SUPABASE);
    if (supabasePollTimer) clearInterval(supabasePollTimer);
    await initSync();
    showToast('Usando servidor integrado');
  });

  document.getElementById('btnCopySqlSchema').addEventListener('click', async () => {
    const sql = `create table if not exists public.pesca_sync_store (
  id text primary key default 'main',
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.pesca_sync_store enable row level security;
create policy "Acceso lectura/escritura sincronizado" on public.pesca_sync_store for all using (true) with check (true);`;
    try {
      await navigator.clipboard.writeText(sql);
      showToast('Código SQL copiado al portapapeles');
    } catch {}
  });

  // Export Backup
  document.getElementById('btnExportBackup').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `respaldo-pesca-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Import Backup
  document.getElementById('inputImportBackup').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.products) || !Array.isArray(parsed.clients) || !Array.isArray(parsed.sales)) {
        showToast('El archivo no tiene un formato de respaldo válido.');
        return;
      }
      if (syncMode === 'server') {
        const res = await fetch('/api/sync/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed)
        });
        if (res.ok) {
          const data = await res.json();
          applyIncomingState(data.state);
        }
      } else {
        applyIncomingState(parsed);
        if (syncMode === 'supabase') await pushToSupabase();
      }
      closeModal('syncModal');
      showToast('Respaldo importado y sincronizado');
    } catch {
      showToast('Error al leer el archivo de respaldo');
    }
    e.target.value = '';
  });

  // Clear demo data
  document.getElementById('btnClearAllData').addEventListener('click', async () => {
    if (!confirm('¿Querés borrar todos los artículos, clientes y ventas de prueba para empezar desde cero?')) {
      return;
    }
    if (syncMode === 'server') {
      const res = await fetch('/api/sync/clear', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        applyIncomingState(data.state);
      }
    } else {
      state.products = [];
      state.clients = [];
      state.sales = [];
      state.nextSaleNumber = 1001;
      saveLocalState();
      if (syncMode === 'supabase') await pushToSupabase();
      renderAll();
    }
    closeModal('syncModal');
    showToast('Datos reiniciados a cero');
  });
}
