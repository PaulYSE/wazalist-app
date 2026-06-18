/**
 * @file groups-detail.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-17
 * @brief Groups detail panel. Renders single group view with join/leave/apply actions, member management, and admin controls.
 */

import { api } from '../services/api.js';
import { escapeHtml } from '../lib/escape.js';
import { showToast } from '../components/show-toast.js';
import { openEditGroup } from '../modals/group-edit.js';
import { refreshGroups } from './groups-browse-list.js';
import { POLICY_LABEL, POLICY_CLASS } from '../config/groups-config.js';
import { resetGroupsLoaded, resetGroupsSelectedId } from '../state/groups-state.js';
import { getCurrentUserId, isLoggedIn } from '../state/user-state.js';

// ── Group detail panel ────────────────────────────────────────

/**
 * @brief Renders the right-panel group detail for the given group ID.
 *
 * @param {number} groupId
 * @return {Promise<void>}
 */
export async function renderGroupDetail(groupId) {
  const panel = document.getElementById('groupDetailContent');
  if (!panel) return;

  panel.innerHTML = '<div class="d-empty" style="color:var(--text3)">Loading…</div>';

  const loggedIn = isLoggedIn();

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
                (isAdmin && m.user_id !== getCurrentUserId()
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
        console.error('Group member load failed:', e);
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
      resetGroupsLoaded();
      await refreshGroups();
      renderGroupDetail(groupId);
    });

    // Leave
    panel.querySelector('#leaveGroupBtn')?.addEventListener('click', async () => {
      if (!confirm('Leave ' + g.name + '?')) return;
      const res = await api('/api/groups/' + groupId + '/members/' + getCurrentUserId(), 'DELETE');
      if (res.error) {
        showToast(res.error, 'red');
        return;
      }
      showToast('You left ' + g.name + '.', 'green');
      resetGroupsLoaded();
      await refreshGroups();
      renderGroupDetail(groupId);
    });

    // Edit
    panel.querySelector('#editGroupBtn')?.addEventListener('click', () => {
      openEditGroup(g, async () => {
        resetGroupsLoaded();
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
      resetGroupsSelectedId;
      resetGroupsLoaded();
      await refreshGroups();
      document.getElementById('groupDetailContent').innerHTML =
        '<div class="d-empty"><div style="font-size:32px">👥</div><div>Select a Group to view details</div></div>';
      document.querySelector('#groupsView .main').classList.remove('waza-selected');
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
        resetGroupsLoaded();
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
        resetGroupsLoaded();
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
        resetGroupsLoaded();
        await refreshGroups();
        renderGroupDetail(groupId);
      });
    });
  } catch (e) {
    console.error('Failed to load group detail:', e);
    panel.innerHTML = '<div class="d-empty">Couldn\'t load this Group. Please try again.</div>';
  }
}
