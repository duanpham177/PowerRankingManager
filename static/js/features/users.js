"use strict";

  function usersContent() {
    if (!roleIs("Admin")) return "";
    const users = state.users || [];

    return `
      <div class="section-grid users-grid">
        <section class="panel">
          <h2>Create user</h2>
          <p class="muted small">Password must contain at least 10 characters.</p>

          <form id="create-user-form">
            <div class="field">
              <label>Username</label>
              <input name="username" minlength="3" maxlength="64" required>
            </div>

            <div class="form-grid" style="margin-top:12px">
              <div class="field">
                <label>Temporary password</label>
                <input name="password" type="password" minlength="10" required>
              </div>

              <div class="field">
                <label>Role</label>
                <select name="role">
                  <option>Viewer</option>
                  <option>Operator</option>
                  <option>Admin</option>
                </select>
              </div>
            </div>

            <div class="form-grid" style="margin-top:12px">
              <div class="field">
                <label>Backup password (optional)</label>
                <input name="backup_password" type="password" minlength="10" autocomplete="new-password">
              </div>
              <div class="field">
                <label>Confirm backup password</label>
                <input name="backup_confirm" type="password" minlength="10" autocomplete="new-password">
              </div>
            </div>

            <div class="form-actions">
              <button class="primary" type="submit">Create user</button>
            </div>
          </form>
        </section>

        <section class="panel">
          <h2>User accounts</h2>
          <p class="muted small">
            Pending approval: ${state.pending_user_approval_count || 0} / 100
          </p>

          <div class="user-account-list">
            ${users.map(u => `
              <article class="user-account-card">
                <div class="user-account-heading">
                  <h3>
                      ${escapeHtml(u.username)}
                      ${u.username === state.current_user.username ? ' <span class="badge">you</span>' : ""}
                  </h3>
                  <div class="user-account-heading-actions">
                    <span class="user-account-status ${u.approved === false ? "pending" : u.active === false ? "inactive" : "active"}">
                      ${u.approved === false ? "Pending approval" : u.active === false ? "Inactive" : "Active"}
                    </span>
                    <details class="user-action-menu">
                      <summary class="user-action-menu-trigger"
                        aria-label="More actions for ${escapeHtml(u.username)}"
                        title="More actions">...</summary>
                      <div class="user-actions">
                        <button data-action="save-user" data-name="${escapeHtml(u.username)}">Save role</button>

                        ${u.username !== state.current_user.username ? `
                          <button data-action="toggle-user" data-name="${escapeHtml(u.username)}" data-active="${u.active === false ? "false" : "true"}">
                            ${u.active === false ? "Activate" : "Deactivate"}
                          </button>
                          <button class="danger" data-action="delete-user" data-name="${escapeHtml(u.username)}">Delete</button>
                        ` : ""}

                        ${u.approved === false ? `
                          <button class="primary" data-action="approve-user" data-name="${escapeHtml(u.username)}">Approve</button>
                        ` : ""}
                        <button data-action="reset-password" data-name="${escapeHtml(u.username)}">Reset password</button>
                        ${u.locked ? `
                          <button class="primary" data-action="unlock-user" data-name="${escapeHtml(u.username)}">Unlock</button>
                        ` : ""}
                      </div>
                    </details>
                  </div>
                </div>

                <div class="user-account-details">
                  <div class="field">
                    <label for="user-role-${escapeHtml(u.username)}">Role</label>
                    <select id="user-role-${escapeHtml(u.username)}" data-user-role="${escapeHtml(u.username)}">
                      ${["Admin", "Operator", "Viewer"].map(r => `
                        <option ${u.role === r ? "selected" : ""}>${r}</option>
                      `).join("")}
                    </select>
                  </div>
                  <div class="user-account-flags" aria-label="Account details">
                    ${u.approved === false ? '<span class="user-account-flag">Inactive</span>' : ""}
                    ${u.locked ? '<span class="user-account-flag">Locked</span>' : ""}
                    ${u.must_change_password ? '<span class="user-account-flag">Password change required</span>' : ""}
                    <span class="user-account-flag">
                      ${u.has_backup_password ? "Backup password set" : "No backup password"}
                    </span>
                  </div>
                </div>
              </article>
            `).join("")}
          </div>
        </section>
      </div>
    `;
  }

  function passwordModal() {
    return `
      <div class="panel" id="password-panel">
        <h2>Change password</h2>

        <form id="password-form">
          <div class="form-grid">
            <div class="field">
              <label>Current password</label>
              <input type="password" name="current_password" required>
            </div>

            <div class="field">
              <label>New password (minimum 10 characters)</label>
              <input type="password" name="new_password" minlength="10" required>
            </div>

            <div class="field">
              <label>Confirm new password</label>
              <input type="password" name="confirm_password" minlength="10" required>
            </div>
          </div>

          <div class="form-actions">
            <button class="primary" type="submit">Update password</button>
            <button type="button" data-action="close-password">Cancel</button>
          </div>
        </form>

        <hr style="border:0;border-top:1px solid var(--line);margin:22px 0">
        <h3>Backup password</h3>
        <p class="muted small">A backup password lets you reset your main password if you forget it. Changing it requires your current main password.</p>

        <form id="backup-password-form">
          <div class="form-grid">
            <div class="field">
              <label>Current main password</label>
              <input type="password" name="current_password" required autocomplete="current-password">
            </div>
            <div class="field">
              <label>New backup password (minimum 10 characters)</label>
              <input type="password" name="new_backup_password" minlength="10" required autocomplete="new-password">
            </div>
            <div class="field">
              <label>Confirm backup password</label>
              <input type="password" name="confirm_backup_password" minlength="10" required autocomplete="new-password">
            </div>
          </div>
          <div class="form-actions">
            <button class="primary" type="submit">Save backup password</button>
          </div>
        </form>
      </div>
    `;
  }

  // Render the Edit Player modal with direct streak controls.
  function editPlayerModal(player) {
    const streaks = [
      ["win_streak", "Win streak", "Consecutive wins"],
      ["play_streak", "Play streak", "Consecutive matches played"],
      ["off_streak", "Off streak", "Consecutive matches missed"]
    ];

    return `
      <div class="edit-modal-backdrop" id="edit-player-backdrop">
        <section class="edit-modal" role="dialog"
          aria-modal="true" aria-labelledby="edit-player-title">

          <h2 id="edit-player-title">Edit player</h2>
          <p class="muted">${escapeHtml(player.name)}</p>

          <form id="edit-player-form" data-name="${escapeHtml(player.name)}">
            <div class="form-grid">
              <div class="field">
                <label for="edit-tier">Tier</label>
                <select id="edit-tier" name="tier" required>
                  ${[1, 2, 3, 4, 5].map(t => `
                    <option value="${t}" ${Number(player.tier) === t ? "selected" : ""}>
                      Tier ${t}
                    </option>
                  `).join("")}
                </select>
              </div>

              <div class="field">
                <label for="edit-stars">Stars (0-10)</label>
                <input id="edit-stars" name="stars" type="number"
                  min="0" max="10" step="1" required
                  value="${Math.max(0, Math.min(10, Number(player.stars) || 0))}">
              </div>
            </div>

            <h3 style="margin-top:22px;margin-bottom:4px">Streak settings</h3>
            <p class="muted small">Use − and + to adjust each value.</p>

            ${streaks.map(([field, label, description]) => `
              <div class="streak-control">
                <div>
                  <strong>${label}</strong>
                  <div class="muted small">${description}</div>
                </div>

                <div class="streak-buttons">
                  <button type="button" class="ghost"
                    data-action="adjust-streak"
                    data-field="${field}" data-step="-1"
                    aria-label="Decrease ${label}">−</button>

                  <input class="streak-value" type="number"
                    name="${field}" min="0" step="1" required
                    value="${Math.max(0, Number(player[field]) || 0)}"
                    aria-label="${label}">

                  <button type="button" class="ghost"
                    data-action="adjust-streak"
                    data-field="${field}" data-step="1"
                    aria-label="Increase ${label}">+</button>
                </div>
              </div>
            `).join("")}

            <div class="edit-modal-actions">
              <button type="button" class="ghost"
                data-action="cancel-player-edit">Cancel</button>
              <button type="submit" class="primary">Save changes</button>
            </div>
          </form>
        </section>
      </div>
    `;
  }
