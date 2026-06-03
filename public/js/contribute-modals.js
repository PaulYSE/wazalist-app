/* contribute-modals.js — the Suggest-Edit and New-Waza modal dialogs
   (field lists SE_FIELDS / NW_FIELDS live here too). */
const SE_FIELDS = ['name_jp', 'name_en', 'name_en_literal', 'name_en_gtranslate', 'tag', 'reference', 'parent_jp0', 'parent_en0', 'parent_jp1', 'parent_en1', 'author_jp0', 'author_en0', 'author_jp1', 'author_en1', 'video0', 'video1', 'video2', 'video3', 'video4', 'video5', 'video6', 'video7', 'video8', 'video9'];

function openSuggestEdit(w) {
  // Pre-fill with current values as placeholders
  SE_FIELDS.forEach(f => {
    const el = document.getElementById('se-' + f);
    if (el) { el.value = ''; el.placeholder = w[f] || ''; }
  });
  document.getElementById('suggestWazaName').textContent = w.name_jp || (w.name_en || 'Waza #' + w.id);
  document.getElementById('se-err').textContent = '';
  document.getElementById('suggestBg').style.display = 'flex';
  document.getElementById('suggestBg').dataset.wazaId = w.id;
}

document.getElementById('suggestClose').addEventListener('click', () => { document.getElementById('suggestBg').style.display = 'none'; });
document.getElementById('suggestCancel').addEventListener('click', () => { document.getElementById('suggestBg').style.display = 'none'; });
document.getElementById('suggestBg').addEventListener('click', e => { if (e.target === document.getElementById('suggestBg')) document.getElementById('suggestBg').style.display = 'none'; });

document.getElementById('se-submit').addEventListener('click', async () => {
  const wazaId = +document.getElementById('suggestBg').dataset.wazaId;
  const payload = {};
  SE_FIELDS.forEach(f => { const v = document.getElementById('se-' + f)?.value.trim(); if (v) payload[f] = v; });
  const errEl = document.getElementById('se-err');
  if (!Object.keys(payload).length) { errEl.textContent = 'Please fill in at least one field.'; return; }
  const btn = document.getElementById('se-submit');
  btn.disabled = true; btn.textContent = 'Submitting…';
  errEl.textContent = '';
  try {
    const res = await api('/api/contributions', 'POST', { type: 'edit', waza_id: wazaId, payload });
    if (res.error) { errEl.textContent = res.error; btn.disabled = false; btn.textContent = 'Submit suggestion'; return; }
    document.getElementById('suggestBg').style.display = 'none';
    btn.disabled = false; btn.textContent = 'Submit suggestion';
    // Flash feedback in detail panel
    const fb = document.createElement('div');
    fb.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#002a10;color:#4caf82;border:1px solid #4caf82;border-radius:8px;padding:10px 16px;font-size:13px;z-index:300';
    fb.textContent = 'Suggestion submitted — thank you!';
    document.body.appendChild(fb); setTimeout(() => fb.remove(), 3000);
  } catch (e) { errEl.textContent = 'Network error. Please try again.'; btn.disabled = false; btn.textContent = 'Submit suggestion'; }
});

// ── New Waza modal ────────────────────────────────────────────
const NW_FIELDS = ['name_jp', 'name_en', 'name_en_literal', 'tag', 'parent_jp0', 'parent_en0', 'author_jp0', 'author_en0', 'author_jp1', 'author_en1', 'video0', 'video1', 'video2', 'video3', 'video4', 'reference'];

function openNewWazaModal() {
  NW_FIELDS.forEach(f => { const el = document.getElementById('nw-' + f); if (el) el.value = ''; });
  document.getElementById('nw-err').textContent = '';
  document.getElementById('newWazaBg').style.display = 'flex';
}

document.getElementById('newWazaBtn').addEventListener('click', openNewWazaModal);
document.getElementById('newWazaClose').addEventListener('click', () => { document.getElementById('newWazaBg').style.display = 'none'; });
document.getElementById('newWazaCancel').addEventListener('click', () => { document.getElementById('newWazaBg').style.display = 'none'; });
document.getElementById('newWazaBg').addEventListener('click', e => { if (e.target === document.getElementById('newWazaBg')) document.getElementById('newWazaBg').style.display = 'none'; });

document.getElementById('nw-submit').addEventListener('click', async () => {
  const payload = {};
  NW_FIELDS.forEach(f => { const v = document.getElementById('nw-' + f)?.value.trim(); if (v) payload[f] = v; });
  const errEl = document.getElementById('nw-err');
  if (!payload.name_jp) { errEl.textContent = 'Japanese name is required.'; return; }
  if (!payload.video0) { errEl.textContent = 'At least one video link is required.'; return; }
  const btn = document.getElementById('nw-submit');
  btn.disabled = true; btn.textContent = 'Submitting…';
  errEl.textContent = '';
  try {
    const res = await api('/api/contributions', 'POST', { type: 'new_waza', payload });
    if (res.error) { errEl.textContent = res.error; btn.disabled = false; btn.textContent = 'Submit Waza'; return; }
    document.getElementById('newWazaBg').style.display = 'none';
    btn.disabled = false; btn.textContent = 'Submit Waza';
    const fb = document.createElement('div');
    fb.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#002a10;color:#4caf82;border:1px solid #4caf82;border-radius:8px;padding:10px 16px;font-size:13px;z-index:300';
    fb.textContent = 'Waza submitted for review — thank you!';
    document.body.appendChild(fb); setTimeout(() => fb.remove(), 3000);
  } catch (e) { errEl.textContent = 'Network error. Please try again.'; btn.disabled = false; btn.textContent = 'Submit Waza'; }
});

// ── List Share — localStorage ────────────────────────────────
