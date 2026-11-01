"use strict";

  function exportPlayers() {
    const exportData = {
      format: "power-ranking-players",
      version: 1,
      players: (state.players || []).map(({ name, tier, stars }) => ({ name, tier, stars }))
    };
    const blob = new Blob(
      [`${JSON.stringify(exportData, null, 2)}\n`],
      { type: "application/json;charset=utf-8" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "players.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function importPlayersFile(input) {
    const file = input.files?.[0];
    if (!file) return;

    try {
      if (file.size > 1024 * 1024) {
        throw new Error("Players file must be 1 MB or smaller.");
      }

      let parsed;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        throw new Error("The selected file is not valid JSON.");
      }
      if (
        !parsed || parsed.format !== "power-ranking-players"
        || parsed.version !== 1 || !Array.isArray(parsed.players)
      ) {
        throw new Error("This is not a supported players export file.");
      }

      const existingNames = new Set((state.players || []).map(player => player.name));
      const duplicates = parsed.players
        .map(player => String(player?.name ?? "").trim())
        .filter(name => existingNames.has(name));
      const overwrite = duplicates.length > 0 && await appConfirm(
        `${duplicates.length} player(s) already exist: ${duplicates.join(", ")}.\n\n`
        + "Overwrite their Tier and Stars with the values from the file?\n"
        + "Choose Overwrite to replace them, or Keep existing to leave them unchanged (new players are still added).",
        { confirmText: "Overwrite", cancelText: "Keep existing", danger: false }
      );

      const result = await request("/admin/players/import", {
        method: "POST",
        body: { players: parsed.players, overwrite }
      });
      showNotice(result.message);
      activeTab = "players";
      await refreshState();
    } catch (error) {
      showNotice(error.message, "error");
    } finally {
      input.value = "";
    }
  }

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
            <div class="row-actions">
              <button type="button" data-action="export-players">Export players</button>
              <button type="button" data-action="import-players">Import players</button>
              <input id="players-import-file" type="file" accept=".json,application/json"
                hidden aria-label="Choose a players JSON file">
              <button class="danger" data-action="delete-selected-players" disabled>Delete selected</button>
            </div>
          </div>

          <div class="table-wrap">
            <table class="players-roster-table">
              <thead>
                <tr>
                  <th><input type="checkbox" data-select-all-players aria-label="Select all players"></th>
                  <th>Player</th><th>Tier</th><th>Stars</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${players.map(p => `
                  <tr class="${Number(p.tier) === 1 ? 'tier-1-row' : ''}">
                    <td><input type="checkbox" name="selected-player" value="${escapeHtml(p.name)}" aria-label="Select ${escapeHtml(p.name)}"></td>
                    <td><strong class="player-name-cell">${Number(p.tier) === 1 ? '<span class="tier-1-crown" aria-hidden="true">👑</span>' : '<span class="player-icon" aria-hidden="true">⚽</span>'}${escapeHtml(p.name)}</strong></td>
                    <td><span class="tier ${Number(p.tier) === 1 ? 'tier-1' : ''}">${Number(p.tier) === 1 ? '★ ' : ''}Tier ${p.tier}</span></td>
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
