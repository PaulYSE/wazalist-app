/* browse-list.js */

import {
  markingStyle,
  markingPips,
  cardLikePill,
  videoButtons,
} from '../components/render-helpers.js';
import { state } from '../state/state.js';
import { filterWaza, dispName } from '../lib/search.js';
import { getP } from '../services/progress.js';
import { selectWaza } from './waza-detail.js';

export function renderList() {
  const filtered = filterWaza();
  document.getElementById('countBar').textContent =
    filtered.length + ' of ' + state.wazaData.length + ' Waza';
  const list = document.getElementById('wazaList');
  if (!filtered.length) {
    list.innerHTML =
      '<div style="padding:20px;text-align:center;color:#6a6880;font-size:14px">No Waza found</div>';
    return;
  }

  if (state.browseListView === 'expanded') {
    list.innerHTML = filtered
      .map((w) => {
        const p = getP(w.id);
        const markings = p.markings || Array(6).fill(false);
        const pill = cardLikePill(w, p);
        const bottomRow =
          '<div class="card-bottom-row">' +
          '<div class="markings-row wce-markings">' +
          markingPips(markings) +
          '</div>' +
          pill +
          '</div>';
        const _ms1 = markingStyle(markings);
        return (
          '<div class="waza-card ' +
          _ms1.cls +
          (state.selectedId === w.id ? ' selected' : '') +
          '" data-id="' +
          w.id +
          '" style="' +
          _ms1.style +
          '">' +
          '<div class="wce-header">' +
          '<div class="njp">' +
          (w.name_jp || '—') +
          '</div>' +
          '<div class="nen">' +
          dispName(w) +
          '</div>' +
          bottomRow +
          '</div>' +
          videoButtons(w) +
          '</div>'
        );
      })
      .join('');
    list
      .querySelectorAll('.waza-card')
      .forEach((el) => el.addEventListener('click', () => selectWaza(+el.dataset.id)));
  } else if (state.browseListView === 'list') {
    list.innerHTML = filtered
      .map((w) => {
        const p = getP(w.id);
        const markings = p.markings || Array(6).fill(false);
        const pill = cardLikePill(w, p);
        const bottomRow =
          '<div class="card-bottom-row">' +
          '<div class="markings-row wce-markings">' +
          markingPips(markings) +
          '</div>' +
          pill +
          '</div>';
        const _ms2 = markingStyle(markings);
        return (
          '<div class="waza-list ' +
          _ms2.cls +
          (state.selectedId === w.id ? ' selected' : '') +
          '" data-id="' +
          w.id +
          '" style="' +
          _ms2.style +
          '">' +
          '<div class="njp">' +
          (w.name_jp || '—') +
          '</div>' +
          '<div class="nen">' +
          dispName(w) +
          '</div>' +
          bottomRow +
          '</div>'
        );
      })
      .join('');
    list
      .querySelectorAll('.waza-list')
      .forEach((el) => el.addEventListener('click', () => selectWaza(+el.dataset.id)));
  } else {
    // Compact — no likes, equal truncating names
    list.innerHTML = filtered
      .map((w) => {
        const p = getP(w.id);
        const markings = p.markings || Array(6).fill(false);
        const _ms3 = markingStyle(markings);
        return (
          '<div class="waza-compact ' +
          _ms3.cls +
          (state.selectedId === w.id ? ' selected' : '') +
          '" data-id="' +
          w.id +
          '" style="' +
          _ms3.style +
          '">' +
          '<span class="drn">' +
          (w.name_jp || '—') +
          '</span>' +
          '<span class="drs">' +
          dispName(w) +
          '</span>' +
          '<div class="markings-row" style="flex-shrink:0">' +
          markingPips(markings) +
          '</div>' +
          '</div>'
        );
      })
      .join('');
    list
      .querySelectorAll('.waza-compact')
      .forEach((el) => el.addEventListener('click', () => selectWaza(+el.dataset.id)));
  }
}
