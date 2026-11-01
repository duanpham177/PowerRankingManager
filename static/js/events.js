"use strict";

  function renderApp() {
    if (!state?.current_user) return renderLogin();

    const content =
      activeTab === "ranking" ? rankingContent() :
      activeTab === "random-teams" ? randomTeamsContent() :
      activeTab === "matches" ? matchContent() :
      activeTab === "drink-shop" ? drinkShopContent() :
      activeTab === "history" ? historyContent() :
      activeTab === "players" ? playersContent() :
      usersContent();

    shell(`
      ${sidebar()}

      <main id="main-content">
        ${state.current_user.must_change_password ? `
          <div class="panel">
            <strong>Password update required.</strong>
            Please change your password before continuing.
          </div>
        ` : ""}

        ${content}

        ${activeTab === "matches" ? `
          <p class="footer-note">
            Result changes: 4 ranks = +2, +1, -1, -2 stars;
            3 ranks = +1, 0, -1; 2 ranks = +1, -1.
            Streak rewards and penalties are applied after the match result.
          </p>
        ` : ""}
      </main>
    `, "has-sidebar");

    setupPasswordToggles();

    if (activeTab === "matches") buildTeamFields();
    if (activeTab === "ranking") updateExportPreview();
    if (activeTab === "random-teams") renderRandomTeamOption(randomTeamOption);
    if (activeTab !== "drink-shop") drinkMenuDraft = null;
  }

  async function refreshState() {
    state = await request("/state");
    if (!state.current_user) activeTab = "ranking";
    renderApp();
    if (roleIs("Admin")) startApprovalNotificationPolling();
  }

  function buildTeamFields() {
    const container = $("#team-fields");
    if (!container) return;

    const players = state.players || [];
    const count = Number($("#team-count")?.value || 4);

    container.innerHTML = `
      <div class="team-box">
        <h3>Assign player ranks</h3>
        <p class="muted small">
          Choose one rank for each player. Leave non-participating players as Not selected.
        </p>

        ${players.map(p => `
          <div class="player-rank-row ${Number(p.tier) === 1 ? 'tier-1-rank' : ''}" data-player-row="${escapeHtml(p.name).toLowerCase()}">
            <label style="margin:0">
              ${Number(p.tier) === 1 ? '<span class="tier-1-crown" aria-hidden="true">👑</span>' : '<span class="player-icon" aria-hidden="true">⚽</span>'}<span class="player-rank-name">${escapeHtml(p.name)}</span>
              <span class="muted small">· Tier ${p.tier}</span>
            </label>

            <select name="player_rank" data-player="${escapeHtml(p.name)}"
              aria-label="Rank for ${escapeHtml(p.name)}">
              <option value="">Not selected</option>
              ${Array.from({ length: count }, (_, i) => `
                <option value="${i + 1}">Rank ${i + 1}</option>
              `).join("")}
            </select>
          </div>
        `).join("")}
      </div>
    `;

    updateMatchSummary();
    applyPlayerSearch();
  }

  function applyPlayerSearch() {
    const query = ($("#player-search")?.value || "").trim().toLowerCase();

    $$("[data-player-row]").forEach(row => {
      row.style.display = (row.dataset.playerRow || "").includes(query) ? "" : "none";
    });
  }

  function updateMatchSummary() {
    const summary = $("#match-result-summary");
    if (!summary) return;

    const count = Number($("#team-count")?.value || 4);
    const assignments = $$("[name='player_rank']").map(select => ({
      name: select.dataset.player,
      rank: select.value
    }));

    const selectedPlayers = assignments.filter(item => item.rank !== "");

    // Rebuild only when the number of ranks changes; otherwise patch in place so chips can animate.
    if (summary.children.length !== count || summary.dataset.count !== String(count)) {
      summary.dataset.count = String(count);
      summary.innerHTML = Array.from({ length: count }, (_, i) => {
        const rank = i + 1;
        return `
          <div class="summary-rank${rank === 1 ? " first-place" : ""}">
            <h3>${rank === 1 ? '<span class="rank-trophy" aria-label="First place">🏆</span>' : ""}Rank ${rank}</h3>
          </div>
        `;
      }).join("");
      for (const card of summary.children) {
        card.insertAdjacentHTML("beforeend", `<span class="muted small summary-empty">No players assigned</span>`);
      }
    }

    Array.from(summary.children).forEach((card, i) => {
      const rank = i + 1;
      const names = selectedPlayers
        .filter(item => Number(item.rank) === rank)
        .map(item => item.name);
      const chips = new Map(
        Array.from(card.querySelectorAll(".summary-player:not(.leaving)"))
          .map(el => [el.dataset.name, el])
      );

      let leaveIndex = 0;
      for (const [name, el] of chips) {
        if (names.includes(name)) continue;
        const slow = summary.classList.contains("resetting");
        const delay = slow ? Math.min(leaveIndex, 12) * 45 : 0;
        const duration = slow ? 450 : 200;
        leaveIndex += 1;
        el.style.transitionDuration = `${duration}ms`;
        el.style.transitionDelay = `${delay}ms`;
        el.classList.add("leaving");
        setTimeout(() => el.remove(), duration + delay);
      }

      let previous = card.querySelector("h3");
      for (const name of names) {
        let chip = chips.get(name);
        if (!chip) {
          chip = document.createElement("span");
          chip.className = "summary-player chip-enter";
          chip.dataset.name = name;
          chip.textContent = name;
          previous.after(chip);
        }
        previous = chip;
      }

      const empty = card.querySelector(".summary-empty");
      if (names.length && empty) {
        empty.remove();
      } else if (!names.length && !empty) {
        const placeholder = document.createElement("span");
        placeholder.className = "muted small summary-empty chip-enter";
        placeholder.textContent = "No players assigned";
        card.append(placeholder);
      }
    });
  }

  function formObject(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  async function submitForm(form, path, transform = x => x, success = "Saved successfully.") {
    const body = transform(formObject(form), form);
    await request(path, { method: "POST", body });
    showNotice(success);
    await refreshState();
  }
