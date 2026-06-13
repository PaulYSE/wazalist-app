/**
 * @file groups.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-14
 * @brief Groups tab view. Two-panel browse/detail layout for discovering, joining,
 *        and managing Wotagei Groups.
 */

import { api } from '../services/api.js';
import { state } from '../state/state.js';
import { escapeHtml } from '../lib/escape.js';
import { showToast } from '../components/show-toast.js';
import { openCreateGroup, openEditGroup } from '../modals/create-group.js';

// ── Module state ──────────────────────────────────────────────

let selectedGroupId = null;
let groupsCache = []; // all groups from /api/groups
let groupsLoaded = false;

// ── Entry point ───────────────────────────────────────────────

/**
 * @brief Renders the Groups tab. Fetches group list on first open, then renders.
 *
 * @return {Promise<void>}
 */
export async function renderGroups() {
  if (!groupsLoaded) {
    await refreshGroups();
  } else {
    renderGroupList();
    if (selectedGroupId) renderGroupDetail(selectedGroupId);
  }
}

/**
 * @brief Forces a fresh fetch of all groups and re-renders the list.
 *
 * @return {Promise<void>}
 */
export async function refreshGroups() {
  document.getElementById('groupCountBar').textContent = 'Loading…';
  try {
    const res = await api('/api/groups');
    groupsCache = Array.isArray(res) ? res : [];
    groupsLoaded = true;

    // Also refresh state.myGroups for Compare dropdown
    await refreshMyGroups();
  } catch (e) {
    console.error('Failed to load groups:', e);
    groupsCache = [];
  }
  renderGroupList();
  if (selectedGroupId) renderGroupDetail(selectedGroupId);
}

/**
 * @brief Fetches the current user's group memberships into state.myGroups.
 *
 * @return {Promise<void>}
 */
export async function refreshMyGroups() {
  if (state.isGuest || !state.token) {
    state.myGroups = [];
    state.myGroupsLoaded = true;
    return;
  }
  try {
    const res = await api('/api/groups/mine');
    state.myGroups = Array.isArray(res) ? res : [];
    state.myGroupsLoaded = true;
  } catch (e) {
    console.error('Failed to load my groups:', e);
    state.myGroups = [];
  }
}

// ── Group list panel ──────────────────────────────────────────

const POLICY_LABEL = {
  open: 'Open',
  approval: 'Approval',
  invite: 'Invite only',
};

const POLICY_CLASS = {
  open: 'cs-approved',
  approval: 'cs-pending',
  invite: 'ct-edit',
};

/**
 * @brief Renders the left-panel group list.
 *
 * @return {void}
 */
function renderGroupList() {
  const countBar = document.getElementById('groupCountBar');
  const listEl = document.getElementById('groupList');
  if (!countBar || !listEl) return;

  const loggedIn = !state.isGuest && !!state.token;
  const createBtn = loggedIn
    ? '<button class="btn" id="createGroupBtn" style="margin-left:auto;font-size:12px">+ Create Group</button>'
    : '';

  countBar.innerHTML =
    '<span>' +
    groupsCache.length +
    ' Group' +
    (groupsCache.length !== 1 ? 's' : '') +
    '</span>' +
    createBtn;

  document.getElementById('createGroupBtn')?.addEventListener('click', () => {
    openCreateGroup(async () => {
      groupsLoaded = false;
      await refreshGroups();
    });
  });

  if (!groupsCache.length) {
    listEl.innerHTML =
      '<div style="padding:24px 20px;text-align:center;color:var(--text3);font-size:13px">' +
      'No Groups yet.' +
      (loggedIn ? ' Be the first to <b>create one</b>!' : ' Sign in to create one.') +
      '</div>';
    return;
  }

  listEl.innerHTML = groupsCache
    .map(
      (g) =>
        '<div class="waza-list' +
        (selectedGroupId === g.id ? ' selected' : '') +
        '" data-gid="' +
        g.id +
        '">' +
        '<div class="njp">' +
        escapeHtml(g.name) +
        '</div>' +
        '<div class="badges" style="margin-top:5px;display:flex;gap:4px;align-items:center">' +
        '<span class="badge ' +
        (POLICY_CLASS[g.join_policy] || 'b-tag') +
        '">' +
        (POLICY_LABEL[g.join_policy] || g.join_policy) +
        '</span>' +
        '<span class="badge b-tag">' +
        (g.member_count || 0) +
        ' member' +
        ((g.member_count || 0) !== 1 ? 's' : '') +
        '</span>' +
        '</div>' +
        '</div>',
    )
    .join('');

  listEl.querySelectorAll('[data-gid]').forEach((el) => {
    el.addEventListener('click', () => {
      selectedGroupId = +el.dataset.gid;
      renderGroupList();
      renderGroupDetail(selectedGroupId);
      document.querySelector('.main').classList.add('waza-selected');
    });
  });
}

// ── Group detail panel ────────────────────────────────────────

/**
 * @brief Renders the right-panel group detail for the given group ID.
 *
 * @param {number} groupId
 * @return {Promise<void>}
 */
async function renderGroupDetail(groupId) {
  const panel = document.getElementById('groupDetailContent');
  if (!panel) return;

  panel.innerHTML = '<div class="d-empty" style="color:var(--text3)">Loading…</div>';

  const loggedIn = !state.isGuest && !!state.token;

  try {
    // Fetch detail + status in parallel
    const [groupRes, statusRes] = await Promise.all([
      api('/api/groups/' + groupId),
      api('/api/groups/' + groupId + '/my-status'),
    ]);

    if (groupRes.error) {
      panel.innerHTML = '<div class="d-empty">Group not found.</div>';
      return;
    }

    const g = groupRes;
    const myStatus = statusRes; // { status: 'guest'|'none'|'applied'|'member', role?, application_status? }

    const isMember = myStatus.status === 'member';
    const isAdmin = myStatus.status === 'member' && myStatus.role === 'admin';

    // Social links
    let social = [];
    try {
      social = JSON.parse(g.social || '[]');
    } catch {
      /* empty */
    }
    const socialHTML = social.length
      ? '<div class="dsec"><h3>Links</h3><div style="display:flex;flex-wrap:wrap;gap:8px">' +
        social
          .map(
            (s) =>
              '<a href="' +
              escapeHtml(s.url) +
              '" target="_blank" rel="noopener" class="vid-btn">' +
              escapeHtml(s.platform) +
              ' ↗</a>',
          )
          .join('') +
        '</div></div>'
      : '';

    // Action button
    let actionHTML = '';
    if (!loggedIn) {
      actionHTML =
        '<div style="font-size:13px;color:var(--text3);margin-top:4px">Sign in to join this Group.</div>';
    } else if (myStatus.status === 'none') {
      const btnLabel =
        g.join_policy === 'open'
          ? 'Join Group'
          : g.join_policy === 'approval'
            ? 'Apply to join'
            : 'Enter invite key';
      actionHTML = '<button class="cbtn cbtn-primary" id="joinGroupBtn">' + btnLabel + '</button>';
    } else if (myStatus.status === 'applied') {
      const appStatus = myStatus.application_status;
      if (appStatus === 'pending') {
        actionHTML = '<span class="contrib-status cs-pending">Application pending</span>';
      } else if (appStatus === 'rejected') {
        actionHTML =
          '<span class="contrib-status cs-rejected">Application rejected</span>' +
          '<button class="cbtn cbtn-ghost" id="joinGroupBtn" style="margin-left:8px">Apply again</button>';
      }
    } else if (myStatus.status === 'member') {
      actionHTML =
        '<button class="btn" id="leaveGroupBtn" style="color:var(--red);border-color:var(--red)">Leave Group</button>';
      if (isAdmin) {
        actionHTML +=
          ' <button class="btn" id="editGroupBtn">Edit Group</button>' +
          ' <button class="btn" id="deleteGroupBtn" style="color:var(--red)">Delete Group</button>';
      }
    }

    // Member list (members only)
    let membersHTML = '';
    let pendingHTML = '';
    if (isMember) {
      try {
        const members = await api('/api/groups/' + groupId + '/members');
        membersHTML =
          '<div class="dsec"><h3>Members</h3>' +
          '<div style="display:flex;flex-direction:column;gap:4px">' +
          members
            .map(
              (m) =>
                '<div class="waza-compact" data-uid="' +
                m.user_id +
                '" style="cursor:default">' +
                '<span class="drn">' +
                escapeHtml(m.username) +
                '</span>' +
                (m.tag
                  ? '<span class="badge b-tag" style="flex-shrink:0">' +
                    escapeHtml(m.tag) +
                    '</span>'
                  : '') +
                '<span class="badge ' +
                (m.role === 'admin' ? 'cs-approved' : 'b-tag') +
                '" style="flex-shrink:0">' +
                (m.role === 'admin' ? 'Admin' : 'Member') +
                '</span>' +
                (isAdmin && m.user_id !== state.currentUserId
                  ? '<div class="vlink-actions" style="flex-shrink:0">' +
                    '<button class="btn" data-action="set-tag" data-uid="' +
                    m.user_id +
                    '" data-uname="' +
                    escapeHtml(m.username) +
                    '" style="font-size:11px;padding:2px 8px">Tag</button>' +
                    '<button class="btn" data-action="toggle-role" data-uid="' +
                    m.user_id +
                    '" data-role="' +
                    m.role +
                    '" style="font-size:11px;padding:2px 8px">' +
                    (m.role === 'admin' ? 'Demote' : 'Promote') +
                    '</button>' +
                    '<button class="btn" data-action="remove" data-uid="' +
                    m.user_id +
                    '" data-uname="' +
                    escapeHtml(m.username) +
                    '" style="font-size:11px;padding:2px 8px;color:var(--red)">Remove</button>' +
                    '</div>'
                  : '') +
                '</div>',
            )
            .join('') +
          '</div></div>';
      } catch (e) {
        membersHTML =
          '<div class="dsec"><h3>Members</h3><div style="color:var(--text3);font-size:13px">Couldn\'t load members.</div></div>';
      }

      if (isAdmin) {
        try {
          const apps = await api('/api/groups/' + groupId + '/applications');
          if (apps.length) {
            pendingHTML =
              '<div class="dsec"><h3>Pending applications <span class="badge cs-pending" style="font-size:11px">' +
              apps.length +
              '</span></h3>' +
              '<div style="display:flex;flex-direction:column;gap:4px">' +
              apps
                .map(
                  (a) =>
                    '<div class="waza-compact" style="cursor:default">' +
                    '<span class="drn">' +
                    escapeHtml(a.username) +
                    '</span>' +
                    '<span class="drs" style="color:var(--text3)">' +
                    new Date(a.applied_at).toLocaleDateString() +
                    '</span>' +
                    '<div class="vlink-actions" style="flex-shrink:0">' +
                    '<button class="btn" data-action="approve" data-uid="' +
                    a.user_id +
                    '" style="font-size:11px;padding:2px 8px;color:var(--green);border-color:var(--green)">Approve</button>' +
                    '<button class="btn" data-action="reject"  data-uid="' +
                    a.user_id +
                    '" style="font-size:11px;padding:2px 8px;color:var(--red);border-color:var(--red)">Reject</button>' +
                    '</div></div>',
                )
                .join('') +
              '</div></div>';
          }
        } catch {
          /* non-fatal */
        }

        // Show invite key if policy is invite
        if (g.join_policy === 'invite') {
          const keyRes = await api('/api/groups/' + groupId + '/my-status');
          // Key is only visible to admins — fetch it separately via edit endpoint
          // We'll reveal it via the Edit Group modal instead of inline
        }
      }
    }

    // Assemble
    panel.innerHTML =
      '<div class="d-njp">' +
      escapeHtml(g.name) +
      '</div>' +
      '<div class="d-nen" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">' +
      '<span class="badge ' +
      (POLICY_CLASS[g.join_policy] || 'b-tag') +
      '">' +
      (POLICY_LABEL[g.join_policy] || g.join_policy) +
      '</span>' +
      '<span class="badge b-tag">' +
      (g.member_count || 0) +
      ' member' +
      ((g.member_count || 0) !== 1 ? 's' : '') +
      '</span>' +
      '</div>' +
      '<div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      actionHTML +
      '</div>' +
      socialHTML +
      pendingHTML +
      membersHTML;

    // ── Wire action buttons ───────────────────────────────────

    // Join / Apply
    panel.querySelector('#joinGroupBtn')?.addEventListener('click', async () => {
      if (g.join_policy === 'invite') {
        const key = prompt('Enter the invite key for this Group:')?.trim();
        if (!key) return;
        const res = await api('/api/groups/' + groupId + '/join', 'POST', { invite_key: key });
        if (res.error) {
          showToast(res.error, 'red');
          return;
        }
        showToast('Application submitted — waiting for admin approval.', 'green');
      } else if (g.join_policy === 'open') {
        const res = await api('/api/groups/' + groupId + '/join', 'POST', {});
        if (res.error) {
          showToast(res.error, 'red');
          return;
        }
        showToast('You joined ' + g.name + '!', 'green');
      } else {
        const res = await api('/api/groups/' + groupId + '/join', 'POST', {});
        if (res.error) {
          showToast(res.error, 'red');
          return;
        }
        showToast('Application submitted — waiting for admin approval.', 'green');
      }
      groupsLoaded = false;
      await refreshGroups();
      renderGroupDetail(groupId);
    });

    // Leave
    panel.querySelector('#leaveGroupBtn')?.addEventListener('click', async () => {
      if (!confirm('Leave ' + g.name + '?')) return;
      const res = await api('/api/groups/' + groupId + '/members/' + state.currentUserId, 'DELETE');
      if (res.error) {
        showToast(res.error, 'red');
        return;
      }
      showToast('You left ' + g.name + '.', 'green');
      groupsLoaded = false;
      await refreshGroups();
      renderGroupDetail(groupId);
    });

    // Edit
    panel.querySelector('#editGroupBtn')?.addEventListener('click', () => {
      openEditGroup(g, async () => {
        groupsLoaded = false;
        await refreshGroups();
        renderGroupDetail(groupId);
      });
    });

    // Delete
    panel.querySelector('#deleteGroupBtn')?.addEventListener('click', async () => {
      if (
        !confirm(
          'Permanently delete "' + g.name + '" and remove all members? This cannot be undone.',
        )
      )
        return;
      const res = await api('/api/groups/' + groupId, 'DELETE');
      if (res.error) {
        showToast(res.error, 'red');
        return;
      }
      showToast(g.name + ' has been deleted.', 'green');
      selectedGroupId = null;
      groupsLoaded = false;
      await refreshGroups();
      document.getElementById('groupDetailContent').innerHTML =
        '<div class="d-empty"><div style="font-size:32px">👥</div><div>Select a Group to view details</div></div>';
      document.querySelector('.main').classList.remove('waza-selected');
    });

    // Approve / Reject applications
    panel.querySelectorAll('[data-action="approve"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uid = +btn.dataset.uid;
        const res = await api('/api/groups/' + groupId + '/members/' + uid + '/approve', 'POST');
        if (res.error) {
          showToast(res.error, 'red');
          return;
        }
        showToast('Application approved.', 'green');
        groupsLoaded = false;
        await refreshGroups();
        renderGroupDetail(groupId);
      });
    });
    panel.querySelectorAll('[data-action="reject"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uid = +btn.dataset.uid;
        const res = await api('/api/groups/' + groupId + '/members/' + uid + '/reject', 'POST');
        if (res.error) {
          showToast(res.error, 'red');
          return;
        }
        showToast('Application rejected.', 'green');
        renderGroupDetail(groupId);
      });
    });

    // Set tag
    panel.querySelectorAll('[data-action="set-tag"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uid = +btn.dataset.uid;
        const uname = btn.dataset.uname;
        const current =
          panel.querySelector('[data-uid="' + uid + '"] .badge.b-tag')?.textContent || '';
        const tag = prompt('Set tag for ' + uname + ':', current);
        if (tag === null) return;
        const res = await api('/api/groups/' + groupId + '/members/' + uid, 'PUT', {
          tag: tag.trim() || null,
        });
        if (res.error) {
          showToast(res.error, 'red');
          return;
        }
        showToast('Tag updated.', 'green');
        renderGroupDetail(groupId);
      });
    });

    // Promote / Demote
    panel.querySelectorAll('[data-action="toggle-role"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uid = +btn.dataset.uid;
        const currentRole = btn.dataset.role;
        const newRole = currentRole === 'admin' ? 'member' : 'admin';
        const action = newRole === 'admin' ? 'promote to admin' : 'demote to member';
        if (!confirm('Are you sure you want to ' + action + '?')) return;
        const res = await api('/api/groups/' + groupId + '/members/' + uid, 'PUT', {
          role: newRole,
        });
        if (res.error) {
          showToast(res.error, 'red');
          return;
        }
        showToast('Role updated.', 'green');
        groupsLoaded = false;
        await refreshGroups();
        renderGroupDetail(groupId);
      });
    });

    // Remove member
    panel.querySelectorAll('[data-action="remove"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uid = +btn.dataset.uid;
        const uname = btn.dataset.uname;
        if (!confirm('Remove ' + uname + ' from the group?')) return;
        const res = await api('/api/groups/' + groupId + '/members/' + uid, 'DELETE');
        if (res.error) {
          showToast(res.error, 'red');
          return;
        }
        showToast(uname + ' removed.', 'green');
        groupsLoaded = false;
        await refreshGroups();
        renderGroupDetail(groupId);
      });
    });
  } catch (e) {
    console.error('Failed to load group detail:', e);
    panel.innerHTML = '<div class="d-empty">Couldn\'t load this Group. Please try again.</div>';
  }
}

/**
 * @brief Initialises the Groups tab mobile back button.
 *
 * @return {void}
 */
export function initGroups() {
  document.getElementById('groupMobileBack')?.addEventListener('click', () => {
    selectedGroupId = null;
    document.querySelector('.main').classList.remove('waza-selected');
    renderGroupList();
    document.getElementById('groupDetailContent').innerHTML =
      '<div class="d-empty"><div style="font-size:32px">👥</div><div>Select a Group to view details</div></div>';
  });
}
