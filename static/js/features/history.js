"use strict";

  function historyContent() {
    const history = state.match_history || [];
    const logs = state.match_logs || [];

    return `
      <section class="panel">
        <div class="toolbar">
          <div>
            <h2>Match history</h2>
            <div class="muted small">${history.length} displayed record(s)</div>
          </div>

          ${roleIs("Admin") ? `
            <div class="row-actions">
              ${Number(state.hidden_match_count) > 0 ? `
                <button data-action="restore-history">Restore hidden history</button>
              ` : ""}
              ${history.length > 0 ? `
                <button data-action="clear-history">Hide displayed history</button>
              ` : ""}
              ${Number(state.source_match_count) > 0 ? `
                <button class="danger" data-action="delete-all-history">Delete all history permanently</button>
              ` : ""}
            </div>
          ` : ""}
        </div>

        ${history.length ? history.slice().reverse().map(m => `
          <div class="team-box" style="margin-bottom:10px">
            <div class="toolbar">
              <strong>Match #${m.id ?? "?"}</strong>
              <div class="row-actions">
                <span class="muted small">${escapeHtml(m.date)} · ${m.team_count} ranks</span>
                ${roleIs("Admin") ? `
                  <button class="danger" data-action="delete-match" data-match-id="${m.id}">Delete permanently</button>
                ` : ""}
              </div>
            </div>

            <div class="section-grid">
              ${(m.results || []).map(r => `
                <div>
                  <span class="badge">Rank ${r.rank}</span>
                  <div style="margin-top:7px">
                    ${(r.members || []).map(n => `
                      <span class="badge" style="margin:2px">${escapeHtml(n)}</span>
                    `).join("")}
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        `).join("") : `<div class="empty">No displayed match history yet.</div>`}
      </section>

      <section class="panel">
        <div class="toolbar">
          <div>
            <h2>Recent ranking changes</h2>
            <div class="muted small">
              Showing ${logs.length} of the latest ${Number(state.match_log_limit) || 0} match log(s).
            </div>
          </div>
          ${roleIs("Admin") && logs.length ? `
            <button class="danger" data-action="clear-logs">Clear match logs</button>
          ` : ""}
        </div>

        ${logs.length ? logs.slice().reverse().map(log => `
          <div class="team-box" style="margin-bottom:10px">
            <div class="toolbar">
              <strong>Match #${log.match_id ?? "?"}${log.rebuilt ? " · Rebuilt" : ""}</strong>
              <span class="muted small">${escapeHtml(log.date)} · ${log.team_count} ranks</span>
            </div>
            ${(log.events || []).length ? `
              <details>
                <summary class="small muted">Show ${log.events.length} ranking change(s)</summary>
                <div style="margin-top:8px">
                  ${log.events.map(event => `
                    <div class="small" style="padding:5px 0">
                      <strong>${escapeHtml(event.player)}</strong>
                      <span class="muted">· ${escapeHtml([
                        formatRankingChangeReason(event),
                        formatRankingChange(event)
                      ].filter(Boolean).join("; "))}</span>
                    </div>
                  `).join("")}
                </div>
              </details>
            ` : `<div class="muted small">No ranking changes recorded.</div>`}
          </div>
        `).join("") : `<div class="empty">No recent ranking changes.</div>`}
      </section>
    `;
  }
