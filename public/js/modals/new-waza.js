import { api } from '../services/api.js';

// ── New Waza modal ────────────────────────────────────────────
const NW_FIELDS = [
  'name_jp',
  'name_en',
  'name_en_literal',
  'tag',
  'parent_jp0',
  'parent_en0',
  'author_jp0',
  'author_en0',
  'author_jp1',
  'author_en1',
  'video0',
  'video1',
  'video2',
  'video3',
  'video4',
  'reference',
];

export function openNewWazaModal() {
  NW_FIELDS.forEach((f) => {
    const el = document.getElementById('nw-' + f);
    if (el) el.value = '';
  });
  document.getElementById('nw-err').textContent = '';
  document.getElementById('newWazaBg').style.display = 'flex';
}

export function initNewWaza() {
  document.getElementById('newWazaBtn').addEventListener('click', openNewWazaModal);
  document.getElementById('newWazaClose').addEventListener('click', () => {
    document.getElementById('newWazaBg').style.display = 'none';
  });
  document.getElementById('newWazaCancel').addEventListener('click', () => {
    document.getElementById('newWazaBg').style.display = 'none';
  });
  document.getElementById('newWazaBg').addEventListener('click', (e) => {
    if (e.target === document.getElementById('newWazaBg'))
      document.getElementById('newWazaBg').style.display = 'none';
  });

  document.getElementById('nw-submit').addEventListener('click', async () => {
    const payload = {};
    NW_FIELDS.forEach((f) => {
      const v = document.getElementById('nw-' + f)?.value.trim();
      if (v) payload[f] = v;
    });
    const errEl = document.getElementById('nw-err');
    if (!payload.name_jp) {
      errEl.textContent = 'Japanese name is required.';
      return;
    }
    if (!payload.video0) {
      errEl.textContent = 'At least one video link is required.';
      return;
    }
    const btn = document.getElementById('nw-submit');
    btn.disabled = true;
    btn.textContent = 'Submitting…';
    errEl.textContent = '';
    try {
      const res = await api('/api/contributions', 'POST', { type: 'new_waza', payload });
      if (res.error) {
        errEl.textContent = res.error;
        btn.disabled = false;
        btn.textContent = 'Submit Waza';
        return;
      }
      document.getElementById('newWazaBg').style.display = 'none';
      btn.disabled = false;
      btn.textContent = 'Submit Waza';
      const fb = document.createElement('div');
      fb.style.cssText =
        'position:fixed;bottom:20px;right:20px;background:#002a10;color:#4caf82;border:1px solid #4caf82;border-radius:8px;padding:10px 16px;font-size:13px;z-index:300';
      fb.textContent = 'Waza submitted for review — thank you!';
      document.body.appendChild(fb);
      setTimeout(() => fb.remove(), 3000);
    } catch (e) {
      console.error('Waza submit failed:', e);
      errEl.textContent = 'Network error. Please try again.';
      btn.disabled = false;
      btn.textContent = 'Submit Waza';
    }
  });
}
