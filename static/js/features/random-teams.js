"use strict";

  function getRandomTeamScore(player) {
    return Number(player.tier_points) * 4;
  }

  function formatRandomTeamScore(scoreUnits) {
    return Number((scoreUnits / 4).toFixed(2));
  }

  function createRandomTeamOption(players, teamCount, excludedSignature = "") {
    let bestOption = null;
    let bestSignature = "";
    let fallbackOption = null;
    let fallbackSignature = "";
    const attempts = 1000;

    function isBetter(candidate, current) {
      return !current || candidate.violation < current.violation
        || (candidate.violation === current.violation
          && (candidate.tierSpread < current.tierSpread
            || (candidate.tierSpread === current.tierSpread
              && candidate.spread < current.spread)));
    }

    function getMetrics(teams) {
      let violation = 0;
      for (let first = 0; first < teams.length; first++) {
        for (let second = first + 1; second < teams.length; second++) {
          const firstTeam = teams[first];
          const secondTeam = teams[second];
          if (firstTeam.points < secondTeam.points
            && firstTeam.players.length <= secondTeam.players.length) {
            violation += secondTeam.points - firstTeam.points;
          } else if (secondTeam.points < firstTeam.points
            && secondTeam.players.length <= firstTeam.players.length) {
            violation += firstTeam.points - secondTeam.points;
          }
        }
      }

      const tierSpread = [1, 2, 3, 4].reduce((total, tier) => {
        const tierCounts = teams.map(team =>
          team.players.filter(player => Number(player.tier) === tier).length
        );
        const countSpread = Math.max(...tierCounts) - Math.min(...tierCounts);
        return total + countSpread * (5 - tier);
      }, 0);

      const totals = teams.map(team => team.points);
      return {
        violation,
        tierSpread,
        spread: Math.max(...totals) - Math.min(...totals),
        countSpread: Math.max(...teams.map(team => team.players.length))
          - Math.min(...teams.map(team => team.players.length))
      };
    }

    for (let attempt = 0; attempt < attempts; attempt++) {
      const rankedPlayers = players
        .map(player => ({ player, random: Math.random() }))
        .sort((a, b) => getRandomTeamScore(b.player) - getRandomTeamScore(a.player)
          || a.random - b.random)
        .map(item => item.player);

      const baseSize = Math.floor(players.length / teamCount);
      const extraCount = players.length % teamCount;
      const teamSizes = Array(teamCount).fill(baseSize);
      const extraTeamIndexes = Array.from({ length: teamCount }, (_, index) => index)
        .sort(() => Math.random() - 0.5)
        .slice(0, extraCount);
      for (const index of extraTeamIndexes) teamSizes[index]++;

      const teams = teamSizes.map(size => ({
        players: [],
        capacity: size,
        points: 0
      }));

      for (const player of rankedPlayers) {
        const availableTeams = teams.filter(team =>
          team.players.length < team.capacity
        );
        const fewestPlayers = Math.min(
          ...availableTeams.map(team => team.players.length)
        );
        const candidates = availableTeams.filter(team =>
          team.players.length === fewestPlayers
        );
        const lowestPoints = Math.min(...candidates.map(team => team.points));
        const balancedCandidates = candidates.filter(team =>
          team.points === lowestPoints
        );
        const team = balancedCandidates[
          Math.floor(Math.random() * balancedCandidates.length)
        ];
        team.players.push(player);
        team.points += getRandomTeamScore(player);
      }

      for (let step = 0; step < players.length * 2; step++) {
        const currentMetrics = getMetrics(teams);
        let bestSwapMetrics = currentMetrics;
        const improvingSwaps = [];

        for (let firstIndex = 0; firstIndex < teams.length; firstIndex++) {
          for (let secondIndex = firstIndex + 1; secondIndex < teams.length; secondIndex++) {
            const firstTeam = teams[firstIndex];
            const secondTeam = teams[secondIndex];

            for (let firstPlayerIndex = 0;
              firstPlayerIndex < firstTeam.players.length;
              firstPlayerIndex++) {
              for (let secondPlayerIndex = 0;
                secondPlayerIndex < secondTeam.players.length;
                secondPlayerIndex++) {
                const firstPoints = getRandomTeamScore(
                  firstTeam.players[firstPlayerIndex]
                );
                const secondPoints = getRandomTeamScore(
                  secondTeam.players[secondPlayerIndex]
                );
                firstTeam.points += secondPoints - firstPoints;
                secondTeam.points += firstPoints - secondPoints;
                const metrics = getMetrics(teams);
                firstTeam.points -= secondPoints - firstPoints;
                secondTeam.points -= firstPoints - secondPoints;

                const improves = metrics.violation < bestSwapMetrics.violation
                  || (metrics.violation === bestSwapMetrics.violation
                    && (metrics.tierSpread < bestSwapMetrics.tierSpread
                      || (metrics.tierSpread === bestSwapMetrics.tierSpread
                        && metrics.spread < bestSwapMetrics.spread)));
                const tiesBest = improvingSwaps.length > 0
                  && metrics.violation === bestSwapMetrics.violation
                  && metrics.tierSpread === bestSwapMetrics.tierSpread
                  && metrics.spread === bestSwapMetrics.spread;
                if (improves) {
                  bestSwapMetrics = metrics;
                  improvingSwaps.length = 0;
                  improvingSwaps.push({
                    firstIndex,
                    secondIndex,
                    firstPlayerIndex,
                    secondPlayerIndex,
                    firstPoints,
                    secondPoints
                  });
                } else if (tiesBest) {
                  improvingSwaps.push({
                    firstIndex,
                    secondIndex,
                    firstPlayerIndex,
                    secondPlayerIndex,
                    firstPoints,
                    secondPoints
                  });
                }
              }
            }
          }
        }

        if (!improvingSwaps.length) break;
        const bestSwap = improvingSwaps[
          Math.floor(Math.random() * improvingSwaps.length)
        ];
        const firstTeam = teams[bestSwap.firstIndex];
        const secondTeam = teams[bestSwap.secondIndex];
        [firstTeam.players[bestSwap.firstPlayerIndex],
          secondTeam.players[bestSwap.secondPlayerIndex]] =
          [secondTeam.players[bestSwap.secondPlayerIndex],
            firstTeam.players[bestSwap.firstPlayerIndex]];
        firstTeam.points += bestSwap.secondPoints - bestSwap.firstPoints;
        secondTeam.points += bestSwap.firstPoints - bestSwap.secondPoints;
      }

      const metrics = getMetrics(teams);
      const signature = JSON.stringify(
        teams.map(team => team.players.map(player => player.name).sort())
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
      );

      const candidate = { teams, ...metrics };
      if (isBetter(candidate, fallbackOption)) {
        fallbackOption = candidate;
        fallbackSignature = signature;
      }
      if (signature === excludedSignature) continue;

      if (isBetter(candidate, bestOption)) {
        bestOption = candidate;
        bestSignature = signature;
      }
    }

    return bestOption || fallbackOption
      ? {
        option: bestOption || fallbackOption,
        signature: bestOption ? bestSignature : fallbackSignature
      }
      : null;
  }

  function renderRandomTeamOption(option) {
    const container = $("#random-team-results");
    if (!container) return;

    container.innerHTML = option ? `
      ${option.violation > 0 ? `
        <p class="muted small">
          The current player count, tiers, and stars cannot fully satisfy this rule.
          This is the closest option. Click Reroll to try another distribution.
        </p>
      ` : ""}
      <div class="muted small" style="margin-bottom:10px">
        Score difference: ${formatRandomTeamScore(option.spread)}
      </div>
      <div class="random-team-options">
        ${option.teams.map((team, teamIndex) => `
          <div class="random-team">
            <h3>Team ${teamIndex + 1}
              <span class="badge">${formatRandomTeamScore(team.points)} points · ${team.players.length} players</span>
            </h3>
            <ul>
              ${team.players.slice().sort((a, b) =>
                Number(a.tier) - Number(b.tier)
                || a.name.localeCompare(b.name)
              ).map(player => `
                <li>
                  ${escapeHtml(player.name)}
                  <span class="muted small">(Tier ${player.tier})</span>
                </li>
              `).join("")}
            </ul>
          </div>
        `).join("")}
      </div>
    ` : `<p class="empty">No option yet. Generate teams to try again.</p>`;
  }

  function randomTeamsContent() {
    const players = state.players || [];
    const activeNames = new Set(players.map(player => player.name));
    const selectedNames = randomTeamSelection === null
      ? activeNames
      : new Set([...randomTeamSelection].filter(name => activeNames.has(name)));

    return `
      <section class="panel">
        <h2 title="Balances by Tier points; lower-scoring teams get more players."
          style="margin-bottom:14px">Random teams</h2>

        <div class="field" style="max-width:320px">
          <label for="random-team-count">Number of teams</label>
          <select id="random-team-count">
            <option value="2">2 teams</option>
            <option value="3">3 teams</option>
            <option value="4">4 teams</option>
          </select>
        </div>

        <div class="toolbar" style="margin-top:16px">
          <strong id="random-player-count">Players (${selectedNames.size}/${players.length})</strong>
          <label class="random-player">
            <input id="random-select-all" type="checkbox"
              ${selectedNames.size === players.length && players.length ? "checked" : ""}>
            Select all
          </label>
        </div>

        ${players.length ? `
          <div class="random-player-list">
            ${players.map(player => `
              <label class="random-player">
                <input type="checkbox" name="random-player"
                  value="${escapeHtml(player.name)}"
                  ${selectedNames.has(player.name) ? "checked" : ""}>
                <span>
                  <strong>${escapeHtml(player.name)}</strong>
                  <span class="muted small">
                    Tier ${player.tier} · ${player.tier_points} points · ${player.stars} stars
                  </span>
                </span>
              </label>
            `).join("")}
          </div>
        ` : `<p class="empty">No players available.</p>`}

        <div class="form-actions">
          <button class="primary" data-action="generate-random-teams"
            ${players.length < 2 ? "disabled" : ""}>${randomTeamOption ? "Reroll teams" : "Randomize teams"}</button>
        </div>
      </section>

      <section class="panel">
        <h2>Random team results</h2>
        <div id="random-team-results">
          ${randomTeamOption
            ? ""
            : `<p class="muted">Select players and randomize to see the teams.</p>`}
        </div>
      </section>
    `;
  }
