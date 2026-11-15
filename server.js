const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
}

function getInitialSeedData() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const products = [
    {
      id: 'prod_reel_frontal_4000',
      code: 'R-001',
      name: 'Reel Frontal 4000 (3 Rulemanes)',
      category: 'Reels',
      price: 38500,
      stock: 8,
      minStock: 3,
      unit: 'unid.',
      notes: 'Carretel de aluminio, ideal variada de río',
      updatedAt: threeDaysAgo
    },
    {
      id: 'prod_reel_rotativo_huevito',
      code: 'R-002',
      name: 'Reel Rotativo Bajo Perfil (Manija Izq.)',
      category: 'Reels',
      price: 64000,
      stock: 2,
      minStock: 3,
      unit: 'unid.',
      notes: 'Freno magnético, apto señuelos y baitcast',
      updatedAt: threeDaysAgo
    },
    {
      id: 'prod_cana_210_maciza',
      code: 'C-001',
      name: 'Caña Fibra Maciza 2.10m (2 Tramos)',
      category: 'Cañas',
      price: 29000,
      stock: 11,
      minStock: 4,
      unit: 'unid.',
      notes: 'Resistencia 15-30 lbs, pasahilos reforzados',
      updatedAt: threeDaysAgo
    },
    {
      id: 'prod_cana_telescopica_360',
      code: 'C-002',
      name: 'Caña Telescópica 3.60m Pejerrey',
      category: 'Cañas',
      price: 34500,
      stock: 3,
      minStock: 3,
      unit: 'unid.',
      notes: 'Liviana, plegado compacto 70cm',
      updatedAt: threeDaysAgo
    },
    {
      id: 'prod_mosqueton_esmerillon_n3',
      code: 'M-001',
      name: 'Mosquetón con Esmerillón Nº 3 (Blíster x10)',
      category: 'Mosquetones',
      price: 2200,
      stock: 25,
      minStock: 10,
      unit: 'blíster',
      notes: 'Acero inoxidable reforzado',
      updatedAt: threeDaysAgo
    },
    {
      id: 'prod_mosqueton_rapido_n1',
      code: 'M-002',
      name: 'Mosquetón Destorcedor Reforzado Nº 1 (x10)',
      category: 'Mosquetones',
      price: 2800,
      stock: 6,
      minStock: 8,
      unit: 'blíster',
      notes: 'Para pesca pesada / dorado / surubí',
      updatedAt: threeDaysAgo
    },
    {
      id: 'prod_anzuelo_mustad_3_0',
      code: 'A-001',
      name: 'Anzuelos Pata Larga Nº 3/0 (Sobre x10)',
      category: 'Anzuelos',
      price: 3100,
      stock: 18,
      minStock: 8,
      unit: 'sobre',
      notes: 'Ojal recto, punta aguja',
      updatedAt: threeDaysAgo
    },
    {
      id: 'prod_anzuelo_bogueros_n2',
      code: 'A-002',
      name: 'Anzuelos Bogueros/Variada Nº 2 (Sobre x10)',
      category: 'Anzuelos',
      price: 2600,
      stock: 4,
      minStock: 10,
      unit: 'sobre',
      notes: 'Curvo forjado corto',
      updatedAt: threeDaysAgo
    },
    {
      id: 'prod_senuelo_media_agua',
      code: 'S-001',
      name: 'Señuelo Minnow Media Agua 11cm',
      category: 'Señuelos',
      price: 11500,
      stock: 9,
      minStock: 4,
      unit: 'unid.',
      notes: 'Con triples reforzados y sonajero',
      updatedAt: threeDaysAgo
    },
    {
      id: 'prod_senuelo_rana_antienganche',
      code: 'S-002',
      name: 'Señuelo Rana Silicona Antienganche',
      category: 'Señuelos',
      price: 8900,
      stock: 2,
      minStock: 5,
      unit: 'unid.',
      notes: 'Especial tararira en vegetación',
      updatedAt: threeDaysAgo
    },
    {
      id: 'prod_multi_4hebras_023',
      code: 'L-001',
      name: 'Multifilamento 4 Hebras 0.23mm x 100m',
      category: 'Líneas y Tanzas',
      price: 12800,
      stock: 14,
      minStock: 5,
      unit: 'rollo',
      notes: 'Color verde musgo, 30 lbs',
      updatedAt: threeDaysAgo
    },
    {
      id: 'prod_plomada_pasante_40g',
      code: 'P-001',
      name: 'Plomada Pasante Hexagonal 40g (Pack x5)',
      category: 'Plomadas y Boyas',
      price: 2500,
      stock: 16,
      minStock: 6,
      unit: 'pack',
      notes: 'Ideal lanzamiento costa',
      updatedAt: threeDaysAgo
    }
  ];

  const clients = [
    {
      id: 'cli_carlos_gomez',
      name: 'Carlos Gómez',
      phone: '5491145678901',
      notes: 'Suele llevar artículos de variada y pejerrey',
      createdAt: threeDaysAgo
    },
    {
      id: 'cli_martin_ledesma',
      name: 'Martín Ledesma',
      phone: '5491133445566',
      notes: 'Pesca con señuelos / baitcast',
      createdAt: yesterday
    }
  ];

  const sales = [
    {
      id: 'sale_demo_1',
      number: 1001,
      createdAt: threeDaysAgo,
      clientId: 'cli_carlos_gomez',
      clientName: 'Carlos Gómez',
      clientPhone: '5491145678901',
      items: [
        {
          productId: 'prod_cana_210_maciza',
          code: 'C-001',
          name: 'Caña Fibra Maciza 2.10m (2 Tramos)',
          unitPrice: 29000,
          quantity: 1,
          subtotal: 29000
        },
        {
          productId: 'prod_mosqueton_esmerillon_n3',
          code: 'M-001',
          name: 'Mosquetón con Esmerillón Nº 3 (Blíster x10)',
          unitPrice: 2200,
          quantity: 2,
          subtotal: 4400
        },
        {
          productId: 'prod_anzuelo_mustad_3_0',
          code: 'A-001',
          name: 'Anzuelos Pata Larga Nº 3/0 (Sobre x10)',
          unitPrice: 3100,
          quantity: 1,
          subtotal: 3100
        }
      ],
      subtotal: 36500,
      discount: 0,
      total: 36500,
      paymentMethod: 'Transferencia',
      notes: 'Retiró por el local'
    },
    {
      id: 'sale_demo_2',
      number: 1002,
      createdAt: yesterday,
      clientId: 'cli_martin_ledesma',
      clientName: 'Martín Ledesma',
      clientPhone: '5491133445566',
      items: [
        {
          productId: 'prod_senuelo_media_agua',
          code: 'S-001',
          name: 'Señuelo Minnow Media Agua 11cm',
          unitPrice: 11500,
          quantity: 2,
          subtotal: 23000
        },
        {
          productId: 'prod_multi_4hebras_023',
          code: 'L-001',
          name: 'Multifilamento 4 Hebras 0.23mm x 100m',
          unitPrice: 12800,
          quantity: 1,
          subtotal: 12800
        }
      ],
      subtotal: 35800,
      discount: 800,
      total: 35000,
      paymentMethod: 'Efectivo',
      notes: 'Atención precio redondo'
    }
  ];

  return {
    businessName: 'Pesca & Aventura',
    nextSaleNumber: 1003,
    updatedAt: now.toISOString(),
    products,
    clients,
    sales
  };
}

function loadStore() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      const seed = getInitialSeedData();
      saveStore(seed);
      return seed;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      businessName: parsed.businessName || 'Artículos de Pesca',
      nextSaleNumber: parsed.nextSaleNumber || 1001,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      products: Array.isArray(parsed.products) ? parsed.products : [],
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
      sales: Array.isArray(parsed.sales) ? parsed.sales : []
    };
  } catch (err) {
    console.error('Error cargando base de datos, iniciando con respaldo:', err);
    return getInitialSeedData();
  }
}

function saveStore(state) {
  state.updatedAt = new Date().toISOString();
  const tmpFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpFile, DATA_FILE);
  return state;
}

let store = loadStore();

// Connected SSE clients for instant multi-device sync
const sseClients = new Set();

function broadcastSync(eventType = 'state_updated', payload = {}) {
  const message = JSON.stringify({
    type: eventType,
    updatedAt: store.updatedAt,
    ...payload
  });
  for (const res of sseClients) {
    try {
      res.write(`data: ${message}\n\n`);
    } catch {
      sseClients.delete(res);
    }
  }
}

function getLocalIpAddresses() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  return results;
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString('utf8');
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error('Payload demasiado grande'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      return res.end();
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // 1. Server-Sent Events for real-time sync across devices
    if (pathname === '/api/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write(`data: ${JSON.stringify({ type: 'connected', updatedAt: store.updatedAt, activeDevices: sseClients.size + 1 })}\n\n`);
      sseClients.add(res);
      broadcastSync('presence', { activeDevices: sseClients.size });

      req.on('close', () => {
        sseClients.delete(res);
        broadcastSync('presence', { activeDevices: sseClients.size });
      });
      return;
    }

    // 2. Get full synchronized state
    if (pathname === '/api/state' && req.method === 'GET') {
      const ips = getLocalIpAddresses();
      return sendJson(res, 200, {
        ...store,
        serverInfo: {
          port: PORT,
          lanUrls: ips.map((ip) => `http://${ip}:${PORT}`),
          activeDevices: Math.max(1, sseClients.size)
        }
      });
    }

    // 3. Update business settings
    if (pathname === '/api/settings' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (typeof body.businessName === 'string' && body.businessName.trim()) {
        store.businessName = body.businessName.trim();
      }
      saveStore(store);
      broadcastSync('state_updated');
      return sendJson(res, 200, { ok: true, state: store });
    }

    // 4. Create or Update Product
    if (pathname === '/api/products' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const name = String(body.name || '').trim();
      if (!name) {
        return sendJson(res, 400, { error: 'El nombre del artículo es obligatorio.' });
      }
      const productData = {
        id: body.id || generateId('prod'),
        code: String(body.code || '').trim(),
        name,
        category: String(body.category || 'Otros').trim(),
        price: Math.max(0, Number(body.price) || 0),
        stock: Math.max(0, Math.round(Number(body.stock) || 0)),
        minStock: Math.max(0, Math.round(Number(body.minStock ?? 3))),
        unit: String(body.unit || 'unid.').trim(),
        notes: String(body.notes || '').trim(),
        updatedAt: new Date().toISOString()
      };

      const existingIdx = store.products.findIndex((p) => p.id === productData.id);
      if (existingIdx >= 0) {
        store.products[existingIdx] = productData;
      } else {
        store.products.unshift(productData);
      }

      saveStore(store);
      broadcastSync('state_updated');
      return sendJson(res, 200, { ok: true, product: productData, state: store });
    }

    // 5. Quick stock adjustment
    if (pathname.startsWith('/api/products/') && pathname.endsWith('/stock') && req.method === 'PATCH') {
      const parts = pathname.split('/');
      const productId = decodeURIComponent(parts[3]);
      const body = await readJsonBody(req);
      const prod = store.products.find((p) => p.id === productId);
      if (!prod) {
        return sendJson(res, 404, { error: 'Artículo no encontrado.' });
      }
      if (typeof body.stock === 'number') {
        prod.stock = Math.max(0, Math.round(body.stock));
      } else if (typeof body.delta === 'number') {
        prod.stock = Math.max(0, Math.round(prod.stock + body.delta));
      }
      prod.updatedAt = new Date().toISOString();
      saveStore(store);
      broadcastSync('state_updated');
      return sendJson(res, 200, { ok: true, product: prod, state: store });
    }

    // 6. Delete Product
    if (pathname.startsWith('/api/products/') && req.method === 'DELETE') {
      const productId = decodeURIComponent(pathname.replace('/api/products/', ''));
      store.products = store.products.filter((p) => p.id !== productId);
      saveStore(store);
      broadcastSync('state_updated');
      return sendJson(res, 200, { ok: true, state: store });
    }

    // 7. Create or Update Client
    if (pathname === '/api/clients' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const name = String(body.name || '').trim();
      if (!name) {
        return sendJson(res, 400, { error: 'El nombre del cliente es obligatorio.' });
      }
      const existingIdx = store.clients.findIndex((c) => c.id === body.id);
      const clientData = {
        id: body.id || generateId('cli'),
        name,
        phone: String(body.phone || '').trim(),
        notes: String(body.notes || '').trim(),
        createdAt: existingIdx >= 0 ? store.clients[existingIdx].createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (existingIdx >= 0) {
        store.clients[existingIdx] = clientData;
        // Also update clientName/clientPhone in past sales linked to this client
        store.sales.forEach((s) => {
          if (s.clientId === clientData.id) {
            s.clientName = clientData.name;
            s.clientPhone = clientData.phone;
          }
        });
      } else {
        store.clients.unshift(clientData);
      }

      saveStore(store);
      broadcastSync('state_updated');
      return sendJson(res, 200, { ok: true, client: clientData, state: store });
    }

    // 8. Delete Client
    if (pathname.startsWith('/api/clients/') && req.method === 'DELETE') {
      const clientId = decodeURIComponent(pathname.replace('/api/clients/', ''));
      store.clients = store.clients.filter((c) => c.id !== clientId);
      saveStore(store);
      broadcastSync('state_updated');
      return sendJson(res, 200, { ok: true, state: store });
    }

    // 9. Create Sale (Decrements stock & links client history)
    if (pathname === '/api/sales' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const rawItems = Array.isArray(body.items) ? body.items : [];
      if (rawItems.length === 0) {
        return sendJson(res, 400, { error: 'La venta debe incluir al menos un artículo.' });
      }

      // Resolve or create client if provided
      let clientId = body.clientId || null;
      let clientName = String(body.clientName || 'Cliente Mostrador').trim() || 'Cliente Mostrador';
      let clientPhone = String(body.clientPhone || '').trim();

      if (clientId) {
        const existingClient = store.clients.find((c) => c.id === clientId);
        if (existingClient) {
          clientName = existingClient.name;
          if (clientPhone && clientPhone !== existingClient.phone) {
            existingClient.phone = clientPhone;
          } else {
            clientPhone = existingClient.phone || '';
          }
        }
      } else if (body.saveNewClient && clientName && clientName.toLowerCase() !== 'cliente mostrador') {
        const newClient = {
          id: generateId('cli'),
          name: clientName,
          phone: clientPhone,
          notes: '',
          createdAt: new Date().toISOString()
        };
        store.clients.unshift(newClient);
        clientId = newClient.id;
      }

      const saleItems = [];
      let subtotal = 0;

      // Update product stocks
      for (const item of rawItems) {
        const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
        const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
        const itemSubtotal = qty * unitPrice;
        subtotal += itemSubtotal;

        const prod = store.products.find((p) => p.id === item.productId);
        if (prod) {
          prod.stock = Math.max(0, prod.stock - qty);
          prod.updatedAt = new Date().toISOString();
        }

        saleItems.push({
          productId: item.productId || null,
          code: prod ? prod.code : (item.code || ''),
          name: prod ? prod.name : String(item.name || 'Artículo'),
          unitPrice,
          quantity: qty,
          subtotal: itemSubtotal
        });
      }

      const discount = Math.max(0, Number(body.discount) || 0);
      const total = Math.max(0, subtotal - discount);

      const sale = {
        id: body.id || generateId('sale'),
        number: store.nextSaleNumber++,
        createdAt: new Date().toISOString(),
        clientId,
        clientName,
        clientPhone,
        items: saleItems,
        subtotal,
        discount,
        total,
        paymentMethod: String(body.paymentMethod || 'Efectivo').trim(),
        notes: String(body.notes || '').trim()
      };

      store.sales.unshift(sale);
      saveStore(store);
      broadcastSync('state_updated');
      return sendJson(res, 200, { ok: true, sale, state: store });
    }

    // 10. Delete / Cancel Sale (Restores stock automatically)
    if (pathname.startsWith('/api/sales/') && req.method === 'DELETE') {
      const saleId = decodeURIComponent(pathname.replace('/api/sales/', ''));
      const saleIdx = store.sales.findIndex((s) => s.id === saleId);
      if (saleIdx === -1) {
        return sendJson(res, 404, { error: 'Venta no encontrada.' });
      }
      const [removedSale] = store.sales.splice(saleIdx, 1);
      // Restore stock of items in the canceled sale
      if (Array.isArray(removedSale.items)) {
        for (const item of removedSale.items) {
          if (item.productId) {
            const prod = store.products.find((p) => p.id === item.productId);
            if (prod) {
              prod.stock += Number(item.quantity) || 0;
              prod.updatedAt = new Date().toISOString();
            }
          }
        }
      }
      saveStore(store);
      broadcastSync('state_updated');
      return sendJson(res, 200, { ok: true, state: store });
    }

    // 11. Import / Sync Full State or Clear Demo Data
    if (pathname === '/api/sync/import' && req.method === 'POST') {
      const body = await readJsonBody(req);
      if (Array.isArray(body.products) && Array.isArray(body.clients) && Array.isArray(body.sales)) {
        store = {
          businessName: body.businessName || store.businessName,
          nextSaleNumber: body.nextSaleNumber || store.nextSaleNumber,
          updatedAt: new Date().toISOString(),
          products: body.products,
          clients: body.clients,
          sales: body.sales
        };
        saveStore(store);
        broadcastSync('state_updated');
        return sendJson(res, 200, { ok: true, state: store });
      }
      return sendJson(res, 400, { error: 'Formato de respaldo inválido.' });
    }

    if (pathname === '/api/sync/clear' && req.method === 'POST') {
      store = {
        businessName: store.businessName || 'Pesca & Aventura',
        nextSaleNumber: 1001,
        updatedAt: new Date().toISOString(),
        products: [],
        clients: [],
        sales: []
      };
      saveStore(store);
      broadcastSync('state_updated');
      return sendJson(res, 200, { ok: true, state: store });
    }

    // Static files from public/
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') {
      safePath = '/index.html';
    }
    const filePath = path.join(PUBLIC_DIR, safePath);
    if (filePath.startsWith(PUBLIC_DIR) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300'
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // Fallback to index.html for SPA
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
  } catch (err) {
    console.error('Error en servidor:', err);
    sendJson(res, 500, { error: err.message || 'Error interno del servidor' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIpAddresses();
  console.log(`\n==================================================`);
  console.log(`  Sistema de Gestión de Pesca iniciado`);
  console.log(`  En esta PC:      http://localhost:${PORT}`);
  ips.forEach((ip) => {
    console.log(`  En celulares/LAN: http://${ip}:${PORT}`);
  });
  console.log(`==================================================\n`);
});
