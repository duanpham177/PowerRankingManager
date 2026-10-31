"use strict";

  function matchContent() {
    if (!roleIs("Admin", "Operator")) {
      return `
        <section class="panel">
          <h2>Record match</h2>
          <p class="muted">Your Viewer role can view ranking and match history, but cannot submit results.</p>
        </section>
      `;
    }

    return `
      <section class="panel">
        <div class="help-heading" style="margin-bottom:14px">
          <h2 title="Choose 2–4 ranks and assign each player once.">Record a match</h2>
        </div>

        <form id="match-form">
          <div class="form-grid">
            <div class="field">
              <label>Match date</label>
              <input name="date" type="date" required value="${getLocalDateString()}">
            </div>

            <div class="field">
              <label>Number of teams / ranks</label>
              <select name="team_count" id="team-count">
                <option value="2">2 ranks</option>
                <option value="3">3 ranks</option>
                <option value="4" selected>4 ranks</option>
              </select>
            </div>
          </div>

          <div class="field search-input">
            <label for="player-search">Search player</label>
            <input id="player-search" type="search" placeholder="Type a player name...">
          </div>

          <div id="team-fields" style="margin-top:16px"></div>

          <section class="team-box" style="margin-top:16px">
            <h2 title="Updates when player ranks change."
              style="margin-bottom:14px">Match Result Summary</h2>
            <div id="match-result-summary"></div>
          </section>

          <div class="form-actions">
            <button class="primary" type="submit">Save match result</button>
            <button type="reset">Reset form</button>
          </div>
        </form>
      </section>
    `;
  }
