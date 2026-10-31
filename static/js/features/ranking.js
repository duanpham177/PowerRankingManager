"use strict";

  function shell(content, layoutClass = "") {
    document.body.innerHTML =
      `<div class="shell${layoutClass ? ` ${layoutClass}` : ""}">
         ${content}
         <footer class="footer-note app-footer">
           For educational purposes only. Use responsibly and in accordance with applicable laws.
         </footer>
       </div>
       <div id="app-notice" class="notice hidden"></div>`;
  }

  function header() {
    return `
      <header class="topbar">
        <div class="brand">
          <div class="logo">PR</div>
          <div>
            <h1>Power Ranking</h1>
            <div class="subtitle">Player tiers, match results, and ranking history</div>
          </div>
        </div>

        <div class="topbar-actions">
          ${state?.current_user ? `
            <div class="muted small" style="text-align:right">
              ${escapeHtml(state.current_user.username)}
              · <span class="badge">${escapeHtml(state.current_user.role)}</span>
            </div>
          ` : ""}
          ${themePicker()}
          ${state?.current_user ? `
            <button class="ghost" data-action="password">Change password</button>
            <button data-action="logout">Log out</button>
          ` : ""}
        </div>
      </header>
    `;
  }

  function themePicker() {
    return `
      <label class="theme-control" for="theme-select">
        <span>Theme</span>
        <select id="theme-select" aria-label="Color theme">
          <option value="ocean" ${activeTheme === "ocean" ? "selected" : ""}>Ocean</option>
          <option value="midnight" ${activeTheme === "midnight" ? "selected" : ""}>Midnight</option>
          <option value="light" ${activeTheme === "light" ? "selected" : ""}>Light</option>
        </select>
      </label>
    `;
  }

  function sidebar() {
    const user = state.current_user;
    return `
      <aside class="sidebar">
        <div class="brand">
          <div class="logo">PR</div>
          <div>
            <h1>Power Ranking</h1>
            <div class="subtitle">Tiers, results and history</div>
          </div>
        </div>

        ${themePicker()}
        ${nav()}

        <div class="sidebar-account">
          <div class="muted small">
            ${escapeHtml(user.username)}
            · <span class="badge">${escapeHtml(user.role)}</span>
          </div>
          <button class="ghost" data-action="password">Change password</button>
          <button data-action="logout">Log out</button>
        </div>
      </aside>
    `;
  }

  function renderLogin() {
    if (state?.bootstrap_required) {
      shell(`
        ${header()}
        <div class="login-wrap">
          <section class="panel">
            <h2>Set up the first Admin</h2>
            <p class="muted">Create the first administrator account. Password must contain at least 10 characters.</p>

            <form id="bootstrap-form">
              <div class="field">
                <label>Username</label>
                <input name="username" minlength="3" maxlength="64" required autocomplete="username">
              </div>

              <div class="field" style="margin-top:12px">
                <label>Password</label>
                <input name="password" type="password" minlength="10" required autocomplete="new-password">
              </div>

              <div class="field" style="margin-top:12px">
                <label>Backup password (optional, minimum 10 characters)</label>
                <input name="backup_password" type="password" minlength="10" autocomplete="new-password">
              </div>

              <div class="field" style="margin-top:12px">
                <label>Confirm backup password</label>
                <input name="backup_confirm" type="password" minlength="10" autocomplete="new-password">
              </div>

              <div class="form-actions">
                <button class="primary" type="submit">Create Admin account</button>
              </div>
            </form>
          </section>
        </div>
      `);

      setupPasswordToggles();
      return;
    }

    shell(`
      ${header()}
      <div class="login-wrap">
        <section class="panel auth-view" id="login-view">
          <h2>Welcome back</h2>
          <p class="muted">Sign in to view your Power Ranking workspace.</p>

          <form id="login-form">
            <div class="field">
              <label>Username</label>
              <input name="username" required autocomplete="username">
            </div>

            <div class="field" style="margin-top:12px">
              <label>Main password</label>
              <input name="password" type="password" required autocomplete="current-password">
            </div>

            <div class="form-actions">
              <button class="primary" type="submit">Sign in</button>
              <button type="button" data-action="show-auth-view" data-view="recovery-view">Forgot password?</button>
              <button type="button" data-action="show-auth-view" data-view="register-view">Create account</button>
            </div>
          </form>
        </section>

        <section class="panel auth-view hidden" id="recovery-view">
          <h2>Reset main password</h2>
          <p class="muted small">Use your backup password to set a new main password. The old password cannot be retrieved.</p>

          <form id="recovery-form">
            <div class="field">
              <label>Username</label>
              <input name="username" required autocomplete="username">
            </div>
            <div class="field" style="margin-top:12px">
              <label>Backup password</label>
              <input name="backup_password" type="password" required autocomplete="current-password">
            </div>
            <div class="field" style="margin-top:12px">
              <label>New main password (minimum 10 characters)</label>
              <input name="new_password" type="password" minlength="10" required autocomplete="new-password">
            </div>
            <div class="field" style="margin-top:12px">
              <label>Confirm new main password</label>
              <input name="confirm_password" type="password" minlength="10" required autocomplete="new-password">
            </div>
            <div class="form-actions">
              <button class="primary" type="submit">Reset password</button>
              <button type="button" data-action="show-auth-view" data-view="login-view">Back to sign in</button>
            </div>
          </form>
        </section>

        <section class="panel auth-view hidden" id="register-view">
          <h2>Create account</h2>
          <p class="muted small">New accounts are inactive until an Admin approves them. The approval queue is limited to 100 accounts. A backup password is optional but recommended.</p>

          <form id="register-form">
            <div class="field">
              <label>Username</label>
              <input name="username" minlength="3" maxlength="64" required autocomplete="username">
            </div>
            <div class="field" style="margin-top:12px">
              <label>Main password (minimum 10 characters)</label>
              <input name="password" type="password" minlength="10" required autocomplete="new-password">
            </div>
            <div class="field" style="margin-top:12px">
              <label>Confirm main password</label>
              <input name="confirm_password" type="password" minlength="10" required autocomplete="new-password">
            </div>
            <div class="field" style="margin-top:12px">
              <label>Backup password (optional, minimum 10 characters)</label>
              <input name="backup_password" type="password" minlength="10" autocomplete="new-password">
            </div>
            <div class="field" style="margin-top:12px">
              <label>Confirm backup password</label>
              <input name="backup_confirm" type="password" minlength="10" autocomplete="new-password">
            </div>
            <div class="form-actions">
              <button class="primary" type="submit">Create account</button>
              <button type="button" data-action="show-auth-view" data-view="login-view">Back to sign in</button>
            </div>
          </form>
        </section>
      </div>
    `);

    setupPasswordToggles();
  }

  function nav() {
    const tabs = [
      ["ranking", "Ranking"],
      ["random-teams", "Random teams"],
      ["matches", "Record match"],
      ["drink-shop", "Drink orders"],
      ["history", "Match history"],
      ...(roleIs("Admin") ? [["players", "Manage players"], ["users", "Manage users"]] : [])
    ];

    return `
      <nav class="tabs">
        ${tabs.map(([id, label]) => `
          <button data-tab="${id}" class="${activeTab === id ? "active" : ""}">
            ${label}
            ${id === "users" && state.pending_user_approval_count > 0
              ? `<span class="tab-notification" aria-label="${state.pending_user_approval_count} pending registration requests">${state.pending_user_approval_count}</span>`
              : ""}
          </button>
        `).join("")}
      </nav>
    `;
  }

  function updateApprovalNotification(count) {
    const usersTab = $('[data-tab="users"]');
    if (!usersTab) return;

    let badge = $(".tab-notification", usersTab);
    if (count > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "tab-notification";
        usersTab.appendChild(badge);
      }
      badge.textContent = String(count);
      badge.setAttribute(
        "aria-label",
        `${count} pending registration requests`
      );
    } else if (badge) {
      badge.remove();
    }
  }

  function startApprovalNotificationPolling() {
    if (approvalPollTimer !== null) return;

    approvalPollTimer = setInterval(async () => {
      if (!roleIs("Admin")) return;

      try {
        const latestState = await request("/state");
        if (latestState.current_user?.role !== "Admin") return;

        state.pending_user_approval_count =
          latestState.pending_user_approval_count || 0;
        state.users = latestState.users || [];
        updateApprovalNotification(state.pending_user_approval_count);
      } catch (error) {
        console.error("Unable to refresh pending registration count:", error);
      }
    }, 30000);
  }

  // Export the current ranking to a UTF-8 text file.
  function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDateDDMM(dateValue) {
    const parts = String(dateValue || "").split("-");
    if (parts.length !== 3) return "";
    return `${parts[2]}/${parts[1]}`;
  }

  function normalizePlayerName(name) {
    return String(name ?? "").trim();
  }

  function getExportPlayers() {
    return (state?.players || []).slice();
  }

  function getRankingExportSections() {
    const players = getExportPlayers();
    const tierPoints = { 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 };
    return Array.from({ length: 5 }, (_, index) => {
      const tier = index + 1;
      const members = players.filter(p => Number(p.tier) === tier);
      return {
        tier,
        points: tierPoints[tier],
        players: members.map(player => ({
          name: normalizePlayerName(player.name),
          stars: Math.max(0, Math.min(10, Number(player.stars) || 0)),
          winStreak: Math.max(0, Number(player.win_streak) || 0),
          playStreak: Math.max(0, Number(player.play_streak) || 0),
          offStreak: Math.max(0, Number(player.off_streak) || 0)
        }))
      };
    });
  }

  function buildRankingExportText(dateValue) {
    return buildRankingPreviewMarkdown(dateValue);
  }

  function buildRankingPreviewMarkdown(dateValue) {
    const lines = [
      "# Power Ranking",
      "",
      `## ${formatDateDDMM(dateValue)}`,
      ""
    ];
    lines.push("Legend: 💠 Stars | 👑 Win streak | 🔥 Play streak | 🧊 Off streak", "");

    const header = ["Tier", "Player", "💠", "👑", "🔥", "🧊"];
    const rows = [];

    for (const { tier, players } of getRankingExportSections()) {
      players.forEach(player => {
        rows.push([
          String(tier),
          player.name,
          String(player.stars),
          String(player.winStreak),
          String(player.playStreak),
          String(player.offStreak)
        ]);
      });
    }
    if (!getExportPlayers().length) {
      rows.push(["—", "No players", "—", "—", "—", "—"]);
    }

    const displayWidth = value => Array.from(value).reduce((width, character) => {
      const codePoint = character.codePointAt(0);
      if (
        codePoint === 0x200d
        || (codePoint >= 0xfe00 && codePoint <= 0xfe0f)
        || (codePoint >= 0x0300 && codePoint <= 0x036f)
      ) return width;
      return width + (
        codePoint >= 0x1100
        && (
          codePoint <= 0x11ff
          || (codePoint >= 0x2e80 && codePoint <= 0xa4cf)
          || (codePoint >= 0xac00 && codePoint <= 0xd7ff)
          || (codePoint >= 0xf900 && codePoint <= 0xfaff)
          || (codePoint >= 0xfe10 && codePoint <= 0xfe6f)
          || (codePoint >= 0xff00 && codePoint <= 0xff60)
          || (codePoint >= 0x1f000 && codePoint <= 0x1faff)
        ) ? 2 : 1
      );
    }, 0);
    const widths = header.map((cell, index) =>
      Math.max(3, displayWidth(cell), ...rows.map(row => displayWidth(row[index])))
    );
    const formatRow = cells => `| ${cells.map((cell, index) => {
      const escapedCell = String(cell).replace(/\|/g, "\\|");
      return escapedCell + " ".repeat(widths[index] - displayWidth(cell));
    }).join(" | ")} |`;

    lines.push(
      formatRow(header),
      `| ${widths.map(width => "-".repeat(width)).join(" | ")} |`,
      ...rows.map(formatRow)
    );
    lines.push("");

    return lines.join("\n").trimEnd() + "\n";
  }

  function renderRankingMarkdown(markdown) {
    let inList = false;
    const html = [];
    const lines = markdown.split(/\r?\n/);
    const parseTableRow = line => {
      const content = line.trim().slice(1, -1);
      const cells = [];
      let cell = "";
      for (let index = 0; index < content.length; index++) {
        if (content[index] === "\\" && content[index + 1] === "|") {
          cell += "|";
          index++;
        } else if (content[index] === "|") {
          cells.push(cell.trim());
          cell = "";
        } else {
          cell += content[index];
        }
      }
      cells.push(cell.trim());
      return cells;
    };

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index].trim();
      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      const listItem = line.match(/^[-+]\s+(.+)$/);
      const isTable = line.startsWith("|") && line.endsWith("|")
        && index + 1 < lines.length
        && /^\|[\s:|-]+\|$/.test(lines[index + 1].trim());

      if (listItem) {
        if (!inList) {
          html.push("<ul>");
          inList = true;
        }
        html.push(`<li>${escapeHtml(listItem[1])}</li>`);
        continue;
      }

      if (inList) {
        html.push("</ul>");
        inList = false;
      }

      if (isTable) {
        const headerCells = parseTableRow(line);
        html.push("<table><thead><tr>");
        html.push(headerCells.map(cell => `<th>${escapeHtml(cell)}</th>`).join(""));
        html.push("</tr></thead><tbody>");
        index += 2;
        while (index < lines.length) {
          const row = lines[index].trim();
          if (!row.startsWith("|") || !row.endsWith("|")) break;
          html.push("<tr>");
          html.push(parseTableRow(row).map(cell => `<td>${escapeHtml(cell)}</td>`).join(""));
          html.push("</tr>");
          index++;
        }
        html.push("</tbody></table>");
        index--;
      } else if (heading) {
        const level = heading[1].length;
        html.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`);
      } else if (line) {
        html.push(`<p>${escapeHtml(line)}</p>`);
      }
    }

    if (inList) html.push("</ul>");
    return html.join("");
  }

  function formatRankingChange(event) {
    const before = event.before;
    const after = event.after;
    if (!before || !after) return String(event.description || "");

    const beforeText = `Tier ${before.tier}, ${before.stars} stars`;
    const afterText = `Tier ${after.tier}, ${after.stars} stars`;
    const descriptions = {
      promotion: `Promoted: ${beforeText} → ${afterText}`,
      demotion: `Demoted: ${beforeText} → ${afterText}`,
      star_up: `Stars increased: ${beforeText} → ${afterText}`,
      star_down: `Stars decreased: ${beforeText} → ${afterText}`,
      unchanged: `Unchanged: ${afterText}`
    };
    return descriptions[event.type] || String(event.description || "");
  }

  function formatRankingChangeReason(event) {
    if (event.category === "attendance_penalty") {
      return "Absent for 2 consecutive matches: -1 star";
    }
    if (event.category === "attendance_reward") {
      return "Played 3 consecutive matches: +1 star";
    }
    if (event.category === "win_streak_reward") {
      return String(event.reason || "Won 3 consecutive matches: +1 star");
    }
    return String(event.reason || "");
  }

  function defaultExportFilename(dateValue) {
    const parts = String(dateValue || getLocalDateString()).split("-");
    if (parts.length !== 3) return "Power ranking.txt";
    return `Power ranking ${parts[2]}-${parts[1]}-${parts[0]}.txt`;
  }

  function getExportSettings() {
    const dateValue = $("#export-date")?.value || getLocalDateString();
    let filename = ($("#export-filename")?.value || "").trim();

    if (!filename) filename = defaultExportFilename(dateValue);
    if (!filename.toLowerCase().endsWith(".txt")) filename += ".txt";

    filename = filename.replace(/[\\/:*?"<>|]/g, "_");

    return { dateValue, filename };
  }

  function updateExportPreview() {
    const preview = $("#export-preview");
    if (!preview) return;

    const { dateValue } = getExportSettings();
    preview.innerHTML = renderRankingMarkdown(
      buildRankingPreviewMarkdown(dateValue)
    );
  }

  async function copyRankingPreviewMarkdown() {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard access is unavailable in this browser.");
    }

    const { dateValue } = getExportSettings();
    await navigator.clipboard.writeText(
      buildRankingPreviewMarkdown(dateValue)
    );
    showNotice("Markdown copied.");
  }

  async function saveRankingExport() {
    const { dateValue, filename } = getExportSettings();

    if (!dateValue) {
      throw new Error("Please select an export date.");
    }

    const content = buildRankingExportText(dateValue);
    const blob = new Blob(["\uFEFF", content], {
      type: "text/plain;charset=utf-8"
    });

    if (typeof window.showSaveFilePicker === "function") {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: "Text file",
          accept: { "text/plain": [".txt"] }
        }]
      });

      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();

      showNotice(`Exported ${filename}`);
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showNotice(
      "Export started. Choose the save location in your browser settings if prompted."
    );
  }

  function exportPanel() {
    const today = getLocalDateString();
    const defaultName = defaultExportFilename(today);

    return `
      <section class="panel">
        <div class="toolbar">
          <h2 title="Exports as .txt; rename to .md to render.">Export Player Ranking</h2>
        </div>

        <div class="export-settings">
          <div class="field">
            <label for="export-date">Ranking date</label>
            <input id="export-date" type="date" value="${today}" required>
          </div>

          <div class="field">
            <label for="export-filename">File name</label>
            <div class="export-filename-control">
              <input id="export-filename" value="${escapeHtml(defaultName)}"
                placeholder="Power ranking.txt">
              <button id="export-ranking-button" type="button"
                title="Download the ranking as a .txt file."
                aria-label="Download ranking as a text file">
                <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"
                  style="display:block;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round">
                  <path d="M8 1.75v8.5m0 0 3-3m-3 3-3-3M2.5 12v2.25h11V12"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div class="toolbar" style="margin-top:18px;margin-bottom:8px">
          <h3 style="margin:0">Preview</h3>
          <button type="button" data-action="copy-ranking-preview"
            title="Copy the Markdown table to your clipboard">
            Copy
          </button>
        </div>
        <div id="export-preview" class="export-preview"></div>
      </section>
    `;
  }

  function rankingContent() {
    const players = state.players || [];
    const tierCounts = [1, 2, 3, 4, 5].map(
      tier => players.filter(p => Number(p.tier) === tier).length
    );

    return `
      ${exportPanel()}

      <section class="panel">
        <div class="toolbar">
          <h2 title="Tier 1 is highest; stars sort players within each tier.">Current ranking</h2>
        </div>

        <div class="rank-cards">
          ${tierCounts.map((count, i) => `
            <div class="rank-card">
              <span>Tier ${i + 1}</span>
              <b>${count}</b>
              <span>player${count === 1 ? "" : "s"}</span>
            </div>
          `).join("")}
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Player</th><th>Tier</th><th>Stars</th>
                <th>Win streak</th><th>Play streak</th><th>Off streak</th>
                ${roleIs("Admin") ? "<th>Admin actions</th>" : ""}
              </tr>
            </thead>
            <tbody>
              ${players.length ? players.map((p, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td><strong>${escapeHtml(p.name)}</strong></td>
                  <td><span class="tier">Tier ${p.tier}</span></td>
                  <td>${starsText(p.stars)} <span class="muted small">(${p.stars})</span></td>
                  <td>${p.win_streak ?? 0}</td>
                  <td>${p.play_streak ?? 0}</td>
                  <td>${p.off_streak ?? 0}</td>
                  ${roleIs("Admin") ? `
                    <td>
                      <div class="row-actions">
                        <button data-action="edit-player" data-name="${escapeHtml(p.name)}">Edit</button>
                      </div>
                    </td>
                  ` : ""}
                </tr>
              `).join("") : `
                <tr><td colspan="${roleIs("Admin") ? 8 : 7}" class="empty">No players found.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }
