let compliments = [];

const rows = document.getElementById('rows');
const empty = document.getElementById('empty');
const total = document.getElementById('total');
const search = document.getElementById('search');
const cards = document.getElementById('cards');
const order = document.getElementById('order');
const cols = document.getElementById('cols');
const size = document.getElementById('size');

// Build elements with textContent so submitted text can never inject HTML.
function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// Resolve against the origin so a page opened as http://user:pass@host/admin can still fetch.
function api(path, options) {
  return fetch(new URL(path, location.origin), options);
}

async function load() {
  const res = await api('/api/compliments', { cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) {
    total.textContent = 'Could not load compliments. Try refreshing the page.';
    return;
  }
  compliments = await res.json();
  render();
}

function render() {
  total.textContent = `${compliments.length} compliment${compliments.length === 1 ? '' : 's'}`;
  renderTable();
  renderCards();
}

function renderTable() {
  const q = search.value.trim().toLowerCase();
  const shown = compliments
    .filter((c) => !q || [c.to, c.from, c.message].some((v) => v.toLowerCase().includes(q)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  rows.replaceChildren(
    ...shown.map((c) => {
      const del = el('button', { className: 'secondary', textContent: 'Delete' });
      del.addEventListener('click', () => remove(c));
      return el('tr', {}, [
        el('td', { className: 'nowrap', textContent: c.to }),
        el('td', { className: 'message', textContent: c.message }),
        el('td', { className: 'nowrap', textContent: c.from }),
        el('td', { className: 'nowrap', textContent: formatDate(c.createdAt) }),
        el('td', {}, [del]),
      ]);
    })
  );
  empty.hidden = shown.length > 0;
  empty.textContent = compliments.length ? 'No matches.' : 'No compliments yet.';
}

function renderCards() {
  const list = [...compliments];
  if (order.value === 'recipient') {
    list.sort((a, b) => a.to.localeCompare(b.to, undefined, { sensitivity: 'base' }) || a.createdAt.localeCompare(b.createdAt));
  } else if (order.value === 'newest') {
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } else {
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  cards.style.setProperty('--cols', cols.value);
  cards.style.setProperty('--card-font', size.value);
  // Author is intentionally left off the printed cards.
  cards.replaceChildren(
    ...list.map((c) =>
      el('article', { className: 'card' }, [
        el('div', { className: 'to' }, ['To ', el('strong', { textContent: c.to })]),
        el('p', { className: 'text', textContent: c.message }),
      ])
    )
  );
}

async function remove(c) {
  if (!confirm(`Delete this message to ${c.to} from ${c.from}?\n\n"${c.message}"`)) return;
  const res = await api(`/api/compliments/${encodeURIComponent(c.id)}`, { method: 'DELETE' }).catch(() => null);
  if (!res || (!res.ok && res.status !== 404)) {
    alert('Could not delete. Please try again.');
    return;
  }
  compliments = compliments.filter((x) => x.id !== c.id);
  render();
}

function selectTab(name) {
  for (const tab of ['entries', 'print']) {
    document.getElementById(`tab-${tab}`).setAttribute('aria-selected', String(tab === name));
    document.getElementById(tab).hidden = tab !== name;
  }
}

document.getElementById('tab-entries').addEventListener('click', () => selectTab('entries'));
document.getElementById('tab-print').addEventListener('click', () => selectTab('print'));
document.getElementById('refresh').addEventListener('click', load);
document.getElementById('print-btn').addEventListener('click', () => window.print());
search.addEventListener('input', renderTable);
for (const control of [order, cols, size]) control.addEventListener('change', renderCards);

if (location.hash === '#print') selectTab('print');
load();
