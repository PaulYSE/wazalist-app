const token = localStorage.getItem('wl_token') || '';
const api = async (path, method='GET', body=null) => {
  const opts = { method, headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  return r.json();
};

// Readable field labels
const FIELD_LABELS = {
  name_jp: 'Name (JP)', name_en: 'Name (EN)', name_en_literal: 'Literal', name_en_gtranslate: 'Google Translate',
  tag: 'Skill level', reference: 'Reference / lore',
  parent_jp0: 'Parent JP 0', parent_en0: 'Parent EN 0', parent_jp1: 'Parent JP 1', parent_en1: 'Parent EN 1',
  author_jp0: 'Author (JP) 0', author_en0: 'Author (EN) 0', author_jp1: 'Author (JP) 1', author_en1: 'Author (EN) 1',
  video0:'Video 1', video1:'Video 2', video2:'Video 3', video3:'Video 4', video4:'Video 5', video5:'Video 6',
  video6:'Video 7', video7:'Video 8', video8:'Video 9', video9:'Video 10',
};
const ALL_FIELDS = Object.keys(FIELD_LABELS);

let queue = [], selectedId = null, currentStatus = 'pending';

// ── Load queue ────────────────────────────────────────────────
async function loadQueue(status='pending') {
  currentStatus = status;
  queue = await api('/api/admin/contributions?status=' + status);
  renderQueue();
  document.getElementById('detailPanel').innerHTML = '<div class="d-empty">Select a contribution to review</div>';
  selectedId = null;
  if (status === 'pending') {
    document.getElementById('pendingCount').textContent = queue.length + ' pending';
  }
}

function renderQueue() {
  const el = document.getElementById('queueList');
  if (!queue.length) { el.innerHTML = '<div class="empty-queue">Nothing here</div>'; return; }
  el.innerHTML = queue.map(c => {
    const isNew = c.type === 'new_waza';
    const label = isNew ? (JSON.parse(c.payload).name_jp || 'New Waza') : (c.waza_name_jp || 'Waza #' + c.waza_id);
    const ago = timeAgo(c.created_at);
    return `<div class="queue-item${selectedId===c.id?' selected':''}" data-id="${c.id}">
      <div class="qi-type ${isNew?'new':'edit'}">${isNew ? 'New Waza' : 'Edit'}</div>
      <div class="qi-name">${label}</div>
      <div class="qi-meta">${c.username} · ${ago}</div>
    </div>`;
  }).join('');
  el.querySelectorAll('.queue-item').forEach(el => {
    el.addEventListener('click', () => selectItem(+el.dataset.id));
  });
}

// ── Select item ───────────────────────────────────────────────
async function selectItem(id) {
  selectedId = id;
  renderQueue();
  const c = queue.find(x => x.id === id);
  if (!c) return;

  const panel = document.getElementById('detailPanel');
  panel.innerHTML = '<div class="d-empty" style="font-size:13px;color:var(--text3)">Loading…</div>';

  const payload = JSON.parse(c.payload);
  const isNew = c.type === 'new_waza';
  const isPending = c.status === 'pending';

  // For edits, fetch the current live waza for diffing
  let currentWaza = null;
  if (!isNew && c.waza_id) {
    currentWaza = await api('/api/admin/waza/' + c.waza_id);
  }

  const statusBadge = `<span class="status-badge s-${c.status}">${c.status}</span>`;
  const typeLabel = isNew ? '<span style="color:var(--amber);font-weight:600">New Waza</span>' : '<span style="color:var(--blue);font-weight:600">Edit Suggestion</span>';
  const wazaLabel = isNew ? (payload.name_jp || '(no JP name)') : (c.waza_name_jp || 'Waza #' + c.waza_id);

  // Build diff / field view
  let fieldsHTML = '';
  if (isNew) {
    // New waza — show all submitted fields in a grid with editable inputs
    fieldsHTML = `<div class="section"><h3>Submitted fields</h3><div class="edit-grid" id="editGrid">`;
    ALL_FIELDS.forEach(f => {
      const v = payload[f] || '';
      const isVideo = f.startsWith('video');
      fieldsHTML += `<div class="efield">
        <label>${FIELD_LABELS[f]}</label>
        ${isVideo
          ? `<input type="url" data-field="${f}" value="${escapeHtml(v)}" placeholder="https://…">`
          : `<input type="text" data-field="${f}" value="${escapeHtml(v)}">`}
      </div>`;
    });
    fieldsHTML += `</div></div>`;
  } else {
    // Edit — diff table + editable proposed values
    const changedFields = Object.keys(payload);
    fieldsHTML = `<div class="section"><h3>Proposed changes</h3>
      <table class="diff-table">
        <thead><tr><th>Field</th><th>Current</th><th>Proposed (editable)</th></tr></thead>
        <tbody id="diffBody">`;
    changedFields.forEach(f => {
      const cur = currentWaza ? (currentWaza[f] || '') : '—';
      const prop = payload[f] || '';
      const changed = cur !== prop;
      fieldsHTML += `<tr class="${changed?'changed':''}">
        <td class="field-name">${FIELD_LABELS[f] || f}</td>
        <td class="val-current">${cur ? escapeHtml(cur) : '<span class="val-empty">empty</span>'}</td>
        <td><input type="text" data-field="${f}" value="${escapeHtml(prop)}" style="width:100%;padding:4px 6px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;color:var(--text1);font-size:13px;outline:none" ${!isPending?'disabled':''}></td>
      </tr>`;
    });
    fieldsHTML += `</tbody></table></div>`;
  }

  // Admin note (read-only for non-pending)
  const noteSection = c.admin_note
    ? `<div class="section"><h3>Admin note</h3><div style="font-size:13px;color:var(--text2);padding:8px;background:var(--bg2);border-radius:var(--r)">${escapeHtml(c.admin_note)}</div></div>`
    : '';

  // Actions (only for pending)
  const actionsHTML = isPending ? `
    <div class="actions">
      <div class="note-wrap">
        <label>Note to contributor (optional)</label>
        <textarea id="adminNote" placeholder="Explain any changes you made, or reason for rejection…"></textarea>
      </div>
      <div class="btn-group">
        <button class="btn btn-approve" id="approveBtn">✓ Approve</button>
        <button class="btn btn-reject" id="rejectBtn">✕ Reject</button>
      </div>
    </div>
    <div id="actionFeedback"></div>
  ` : '';

  panel.innerHTML = `
    <div class="d-header">
      <div class="d-title">${escapeHtml(wazaLabel)}</div>
      <div class="d-meta">
        ${typeLabel} ${statusBadge}
        <span>by <b>${escapeHtml(c.username)}</b></span>
        <span>${timeAgo(c.created_at)}</span>
        ${c.reviewed_at ? '<span>reviewed ' + timeAgo(c.reviewed_at) + '</span>' : ''}
      </div>
    </div>
    ${fieldsHTML}
    ${noteSection}
    ${actionsHTML}
  `;

  // Track modifications on inputs
  if (isPending) {
    panel.querySelectorAll('input[data-field],textarea[data-field]').forEach(inp => {
      const orig = inp.value;
      inp.addEventListener('input', () => inp.classList.toggle('modified', inp.value !== orig));
    });

    panel.querySelector('#approveBtn')?.addEventListener('click', () => doAction(c, 'approve'));
    panel.querySelector('#rejectBtn')?.addEventListener('click', () => doAction(c, 'reject'));
  }
}

// ── Approve / Reject ─────────────────────────────────────────
async function doAction(c, action) {
  const panel = document.getElementById('detailPanel');
  const note = panel.querySelector('#adminNote')?.value.trim() || null;
  const feedback = panel.querySelector('#actionFeedback');

  // Collect (possibly edited) payload from inputs
  const inputs = panel.querySelectorAll('input[data-field],textarea[data-field]');
  const payload = {};
  inputs.forEach(inp => { if (inp.value.trim()) payload[inp.dataset.field] = inp.value.trim(); });

  const btn = panel.querySelector(action === 'approve' ? '#approveBtn' : '#rejectBtn');
  btn.disabled = true; btn.textContent = action === 'approve' ? 'Approving…' : 'Rejecting…';

  let res;
  try {
    res = await api(`/api/admin/contributions/${c.id}/${action}`, 'POST', { payload, note });
  } catch(e) {
    res = { error: 'Network error' };
  }

  if (res.error) {
    feedback.innerHTML = `<div class="feedback fail">${escapeHtml(res.error)}</div>`;
    btn.disabled = false;
    btn.textContent = action === 'approve' ? '✓ Approve' : '✕ Reject';
    return;
  }

  feedback.innerHTML = `<div class="feedback ok">${action === 'approve' ? 'Approved and applied to database.' : 'Rejected.'}</div>`;
  panel.querySelector('#approveBtn').disabled = true;
  panel.querySelector('#rejectBtn').disabled = true;

  // Reload queue after short delay
  setTimeout(() => loadQueue(currentStatus), 900);
}

// ── Helpers ───────────────────────────────────────────────────
function escapeHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff/60000), h = Math.floor(m/60), d = Math.floor(h/24);
  if (d > 0) return d + 'd ago';
  if (h > 0) return h + 'h ago';
  if (m > 0) return m + 'm ago';
  return 'just now';
}

// ── Tab switching ─────────────────────────────────────────────
document.querySelectorAll('.stab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.stab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadQueue(tab.dataset.status);
  });
});

// ── Boot ──────────────────────────────────────────────────────
if (!token) {
  document.body.innerHTML = '<div style="padding:40px;text-align:center;color:#e05555">Not authenticated — please sign in to the main app first.</div>';
} else {
  loadQueue('pending');
}