// Tiny front end: talks to the API under /api (same origin).
const $ = (s) => document.querySelector(s);
const fmt = new Intl.NumberFormat('en-PK');
const label = { pump: 'Pump', wire: 'Wire', safety_cable: 'Safety cable', other: 'Other' };

async function api(path, opts = {}) {
  const r = await fetch('/api' + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (r.status === 204) return null;
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || 'Request failed');
  return body;
}

function esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

async function load() {
  try {
    const items = await api('/products');
    $('#count').textContent = items.length + (items.length === 1 ? ' product' : ' products');
    $('#rows').innerHTML = items.length ? items.map((p) => `
      <tr>
        <td>${esc(p.name)}</td>
        <td>${label[p.category] || esc(p.category)}</td>
        <td class="num">Rs ${fmt.format(p.price)}</td>
        <td class="num"><span class="qty">
          <button class="ghost" data-step="-1" data-id="${p.id}" aria-label="One less">−</button>
          <b class="${p.quantity <= 2 ? 'low' : ''}">${p.quantity}</b>
          <button class="ghost" data-step="1" data-id="${p.id}" aria-label="One more">+</button>
        </span></td>
        <td class="actions"><button class="danger" data-del="${p.id}">Delete</button></td>
      </tr>`).join('') : '<tr><td colspan="5" class="muted">No products yet — add one above.</td></tr>';
  } catch (e) {
    $('#rows').innerHTML = `<tr><td colspan="5" class="msg err">Could not load products: ${esc(e.message)}</td></tr>`;
  }
}

async function health() {
  try {
    const r = await fetch('/readyz');
    $('#health').className = 'dot ' + (r.ok ? 'ok' : 'bad');
    $('#health-text').textContent = r.ok ? 'healthy' : 'degraded';
    const v = await api('/version');
    $('#version').textContent = 'v' + v.version;
  } catch { $('#health').className = 'dot bad'; $('#health-text').textContent = 'offline'; }
}

$('#add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const msg = $('#form-msg');
  try {
    await api('/products', { method: 'POST', body: JSON.stringify({
      name: f.get('name'), category: f.get('category'),
      price: Number(f.get('price')), quantity: Number(f.get('quantity')) }) });
    e.target.reset(); msg.className = 'msg ok'; msg.textContent = 'Product added.';
    load();
  } catch (err) { msg.className = 'msg err'; msg.textContent = err.message; }
});

$('#rows').addEventListener('click', async (e) => {
  const step = e.target.closest('[data-step]');
  const del = e.target.closest('[data-del]');
  try {
    if (step) {
      const id = step.dataset.id;
      const p = await api('/products/' + id);
      await api('/products/' + id, { method: 'PATCH', body: JSON.stringify({ quantity: Math.max(0, p.quantity + Number(step.dataset.step)) }) });
      load();
    } else if (del && confirm('Delete this product?')) {
      await api('/products/' + del.dataset.del, { method: 'DELETE' });
      load();
    }
  } catch (err) { alert(err.message); }
});

load(); health(); setInterval(health, 15000);
