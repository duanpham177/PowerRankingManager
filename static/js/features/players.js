"use strict";

  function playersContent() {
    if (!roleIs("Admin")) return "";
    const players = state.players || [];

    return `
      <div class="section-grid">
        <section class="panel">
          <h2 title="New players use the selected Tier and stars."
            style="margin-bottom:14px">Add player</h2>

          <form id="add-player-form">
            <div class="field">
              <label>Player name</label>
              <input name="name" maxlength="80" required>
            </div>

            <div class="form-grid" style="margin-top:12px">
              <div class="field">
                <label>Tier</label>
                <select name="tier">
                  ${[1, 2, 3, 4, 5].map(t => `
                    <option value="${t}" ${t === 5 ? "selected" : ""}>Tier ${t}</option>
                  `).join("")}
                </select>
              </div>

              <div class="field">
                <label>Stars (0-10)</label>
                <input name="stars" type="number" min="0" max="10" value="0" required>
              </div>
            </div>

            <div class="form-actions">
              <button class="primary" type="submit">Add player</button>
            </div>
          </form>
        </section>

        <section class="panel">
          <div class="toolbar">
            <h2 title="Deleting players keeps their match history and logs.">Player roster</h2>
            <button class="danger" data-action="delete-selected-players" disabled>Delete selected</button>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" data-select-all-players aria-label="Select all players"></th>
                  <th>Player</th><th>Tier</th><th>Stars</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${players.map(p => `
                  <tr>
                    <td><input type="checkbox" name="selected-player" value="${escapeHtml(p.name)}" aria-label="Select ${escapeHtml(p.name)}"></td>
                    <td>${escapeHtml(p.name)}</td>
                    <td>Tier ${p.tier}</td>
                    <td>${p.stars}</td>
                    <td>
                      <button class="danger" data-action="delete-player" data-name="${escapeHtml(p.name)}">Delete</button>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    `;
  }
