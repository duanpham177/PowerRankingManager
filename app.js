
(() => {
  "use strict";

  const API = "/api";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  let state = null;
  let activeTab = "ranking";
  let noticeTimer = null;
  let approvalPollTimer = null;
  let randomTeamSelection = null;
  let randomTeamOption = null;
  let previousRandomTeamSignature = "";

  const css = `
    :root {
      color-scheme: dark;
      --bg: #0b1020;
      --panel: #131b2e;
      --line: #2a3855;
      --text: #edf3ff;
      --muted: #9eacc7;
      --accent: #7c9cff;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      background: radial-gradient(ellipse at top, #172545, #0b1020 65%);
      color: var(--text);
      font: 15px/1.5 system-ui, sans-serif;
    }

    button, input, select { font: inherit; }

    button {
      cursor: pointer;
      border: 1px solid #40547b;
      background: #243658;
      color: var(--text);
      padding: 9px 13px;
      border-radius: 9px;
      font-weight: 650;
    }

    button:hover { filter: brightness(1.12); }
    button:disabled { opacity: .45; cursor: not-allowed; }
    button.primary { background: var(--accent); color: #071126; }
    button.danger { background: #4a202b; border-color: #813b4a; }
    button.ghost { background: transparent; }

    input, select {
      width: 100%;
      padding: 10px 11px;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: #0c1426;
      color: var(--text);
      outline: none;
    }

    input:focus, select:focus { border-color: var(--accent); }

    /* Password visibility toggle */
    .password-field {
      position: relative;
      width: 100%;
    }

    .password-field input {
      padding-right: 46px;
    }

    .password-field input[type="password"]::-ms-reveal,
    .password-field input[type="password"]::-ms-clear {
      display: none;
    }

    .password-toggle {
      position: absolute;
      right: 5px;
      top: 50%;
      transform: translateY(-50%);
      display: grid;
      place-items: center;
      width: 36px;
      height: 34px;
      padding: 0;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: #9eacc7;
      transition: color .18s ease, background .18s ease;
    }

    .password-toggle svg {
      display: block;
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .password-toggle:hover {
      color: #edf3ff;
      background: #ffffff0a;
      filter: none;
    }

    .password-toggle:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 1px;
    }

    /* Player edit modal */
    .edit-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: grid;
      place-items: center;
      padding: 16px;
      background: #050914cc;
      backdrop-filter: blur(5px);
    }

    .edit-modal {
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      overflow-y: auto;
      padding: 24px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: #131b2e;
      box-shadow: 0 24px 70px #0008;
    }

    .edit-modal .form-grid {
      margin-top: 14px;
    }

    .streak-control {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      padding: 13px 0;
      border-bottom: 1px solid #26334d;
    }

    .streak-control:last-of-type {
      border-bottom: 0;
    }

    .streak-buttons {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .streak-buttons button {
      flex: 0 0 38px;
      width: 38px;
      height: 38px;
      padding: 0;
      font-size: 20px;
      line-height: 1;
      border-radius: 9px;
    }

    .streak-value {
      width: 68px;
      min-width: 0;
      padding: 8px 4px;
      text-align: center;
      font-size: 16px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .edit-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 20px;
    }

    label {
      display: block;
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 5px;
    }

    h1, h2, h3, p { margin-top: 0; }
    h1 { font-size: clamp(24px, 4vw, 34px); margin-bottom: 4px; }
    h2 { font-size: 19px; margin-bottom: 14px; }
    h3 { font-size: 15px; margin-bottom: 10px; }

    .muted { color: var(--muted); }
    .small { font-size: 12px; }
    .hidden { display: none !important; }

    .shell { max-width: 1200px; margin: auto; padding: 28px 20px 60px; }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 18px;
      margin-bottom: 24px;
    }

    .brand { display: flex; align-items: center; gap: 12px; }

    .logo {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: linear-gradient(135deg, #8ca7ff, #8ce7d0);
      display: grid;
      place-items: center;
      color: #10182a;
      font-weight: 900;
      font-size: 22px;
    }

    .subtitle { color: var(--muted); font-size: 13px; }

    .panel {
      background: linear-gradient(145deg, #162036f5, #10182af5);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 18px;
      box-shadow: 0 12px 35px #0002;
    }

    .login-wrap { max-width: 440px; margin: 8vh auto; }
    .login-wrap .panel { padding: 28px; }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 13px;
    }

    .field { min-width: 0; }

    .form-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 14px;
    }

    .tabs { display: flex; gap: 7px; flex-wrap: wrap; margin-bottom: 18px; }
    .tabs button { background: #111a2d; color: var(--muted); }
    .tabs button.active { background: #dbe5ff; color: #17213a; }
    .tab-notification {
      display: inline-grid;
      min-width: 19px;
      height: 19px;
      place-items: center;
      margin-left: 6px;
      padding: 0 5px;
      border-radius: 999px;
      background: #d94b5b;
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      line-height: 1;
      vertical-align: middle;
    }

    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }

    .toolbar h2 { margin: 0; }

    .table-wrap {
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 11px;
    }

    table { width: 100%; border-collapse: collapse; min-width: 580px; }

    th, td {
      text-align: left;
      padding: 11px 13px;
      border-bottom: 1px solid #26334d;
      white-space: nowrap;
    }

    th {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: var(--muted);
      background: #111a2b;
    }

    tr:last-child td { border-bottom: 0; }
    tbody tr:hover { background: #ffffff06; }

    .tier {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 60px;
      padding: 4px 9px;
      border-radius: 20px;
      background: #253658;
      font-weight: 750;
    }

    .stars { color: #ffd878; letter-spacing: 1px; }
    .row-actions { display: flex; gap: 6px; }
    .row-actions button { padding: 6px 9px; font-size: 12px; }
    .user-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
      min-width: 0;
      align-items: stretch;
    }
    .user-actions button {
      min-width: 0;
      min-height: 36px;
      padding: 6px 8px;
      white-space: normal;
    }

    .users-grid {
      grid-template-columns: minmax(280px, .8fr) minmax(0, 1.6fr);
      align-items: start;
    }

    .users-table {
      min-width: 720px;
      table-layout: fixed;
    }

    .users-table th,
    .users-table td {
      vertical-align: middle;
    }

    .users-table td:nth-child(2) select {
      min-width: 112px;
    }

    .users-table td:nth-child(3) {
      white-space: normal;
      overflow-wrap: anywhere;
    }

    .empty { padding: 28px; text-align: center; color: var(--muted); }

    .notice {
      position: fixed;
      right: 20px;
      top: 18px;
      z-index: 120;
      max-width: min(420px, calc(100vw - 40px));
      padding: 13px 16px;
      border-radius: 11px;
      border: 1px solid #42577d;
      background: #192844;
      box-shadow: 0 15px 40px #0007;
    }

    .notice.error { border-color: #9e4655; background: #3a202b; }
    .notice.success { border-color: #397d69; background: #17352f; }

    .section-grid, .team-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }

    .rank-cards {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 18px;
    }

    .rank-card, .team-box, .summary-rank {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 13px;
      background: #10192b;
    }

    .rank-card b { display: block; font-size: 21px; }
    .rank-card span { color: var(--muted); font-size: 12px; }

    .random-player-list, .random-team-options {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 10px;
      margin-top: 14px;
    }

    .random-player, .random-team {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 11px;
      background: #10192b;
    }

    .random-player {
      display: flex;
      align-items: center;
      gap: 9px;
    }

    .random-player input { width: auto; }
    .random-team h3 { margin: 0 0 8px; }
    .random-team ul { margin: 0; padding-left: 20px; }
    .random-team-total { margin-bottom: 8px; }

    .badge {
      display: inline-block;
      border-radius: 20px;
      padding: 3px 8px;
      background: #263652;
      color: #d9e4ff;
      font-size: 12px;
    }

    .footer-note { color: var(--muted); font-size: 12px; margin-top: 18px; }

    .player-rank-row {
      display: grid;
      grid-template-columns: minmax(130px, 1fr) minmax(150px, 1fr);
      gap: 12px;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #26334d;
    }

    .player-rank-row:last-child { border-bottom: 0; }
    .player-rank-name {
      color: #f3f6ff;
      font-size: 16px;
      font-weight: 750;
      letter-spacing: .01em;
    }

    .summary-rank { margin-top: 10px; }
    .summary-rank h3 { margin-bottom: 6px; }
    .summary-rank.first-place {
      border-color: #8d7135;
      background: linear-gradient(135deg, #342d1d, #10192b 70%);
    }

    .summary-rank.first-place h3 { color: #ffdc82; }
    .rank-trophy { margin-right: 6px; }

    .summary-player {
      display: inline-block;
      margin: 3px 4px 3px 0;
      padding: 4px 9px;
      border-radius: 20px;
      background: #263652;
      color: #d9e4ff;
      font-size: 12px;
    }

    .search-input { margin: 10px 0 14px; }

    .export-settings {
      display: grid;
      grid-template-columns: minmax(160px, .8fr) minmax(220px, 1.2fr);
      gap: 12px;
      align-items: end;
      margin-top: 8px;
    }

    .export-filename-control {
      position: relative;
    }

    .export-filename-control input {
      padding-right: 52px;
    }

    .export-filename-control button {
      position: absolute;
      top: 50%;
      right: 5px;
      display: grid;
      place-items: center;
      width: 34px;
      min-width: 34px;
      height: 34px;
      padding: 0;
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: #f3f6ff;
      transform: translateY(-50%);
    }

    .export-filename-control button:hover {
      background: #ffffff10;
      filter: none;
    }

    .export-filename-control button img {
      display: block;
      width: 16px;
      height: 16px;
      opacity: 1;
      filter: brightness(0) invert(1);
    }

    .export-filename-control button:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    .export-preview {
      overflow-wrap: anywhere;
      max-height: 360px;
      overflow: auto;
      background: #0c1426;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px;
      margin-top: 14px;
    }

    .export-preview h1, .export-preview h2, .export-preview h3 {
      line-height: 1.3;
    }

    .export-preview h1 { font-size: 21px; }
    .export-preview h2 { font-size: 17px; }
    .export-preview h3 { font-size: 15px; }
    .export-preview ul { padding-left: 22px; }
    .export-preview li { margin: 4px 0; }
    .export-preview table {
      width: 100%;
      min-width: 620px;
      border-collapse: collapse;
      margin: 8px 0 20px;
      text-align: left;
    }
    .export-preview th, .export-preview td {
      border: 1px solid var(--line);
      padding: 8px 10px;
      white-space: nowrap;
    }
    .export-preview th { background: rgba(255, 255, 255, .06); }

    @media(max-width: 760px) {
      .shell { padding: 18px 12px 40px; }
      .topbar { align-items: flex-start; }
      .rank-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .section-grid, .team-grid, .form-grid, .export-settings {
        grid-template-columns: 1fr;
      }
      .panel { padding: 15px; }
      .topbar .subtitle { max-width: 210px; }
      .topbar-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .player-rank-row { grid-template-columns: 1fr; gap: 5px; }
      .edit-modal { padding: 18px; }
      .streak-control { gap: 8px; }
      .streak-buttons { gap: 5px; }
      .streak-value { width: 54px; }
      .streak-buttons button { flex-basis: 34px; width: 34px; height: 36px; }
    }
  `;

  function injectStyles() {
    if ($("#power-ranking-style")) return;

    const style = document.createElement("style");
    style.id = "power-ranking-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // Return a clean outline SVG icon for the password visibility button.
  function passwordIcon(showPassword) {
    if (showPassword) {
      return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 3l18 18"></path>
          <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path>
          <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.5 4.5 9.5 6.5a1 1 0 0 1 0 1 15 15 0 0 1-3.1 3.8"></path>
          <path d="M6.6 6.6A15.5 15.5 0 0 0 2.5 11.5a1 1 0 0 0 0 1C3.5 14.5 6.8 19 12 19a10.5 10.5 0 0 0 3.2-.5"></path>
        </svg>
      `;
    }

    return `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2.5 12s3.3-7 9.5-7 9.5 7 9.5 7-3.3 7-9.5 7-9.5-7-9.5-7Z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
  }

  // Add a Show/Hide button to every password input.
  function setupPasswordToggles() {
    $$('input[type="password"]').forEach(input => {
      if (input.dataset.passwordToggleInitialized) return;

      input.dataset.passwordToggleInitialized = "true";

      const wrapper = document.createElement("div");
      wrapper.className = "password-field";

      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "password-toggle";
      toggle.innerHTML = passwordIcon(false);
      toggle.title = "Show password";
      toggle.setAttribute("aria-label", "Show password");
      toggle.setAttribute("aria-pressed", "false");

      toggle.addEventListener("click", () => {
        const showPassword = input.type === "password";

        input.type = showPassword ? "text" : "password";
        toggle.innerHTML = passwordIcon(showPassword);
        toggle.title = showPassword ? "Hide password" : "Show password";
        toggle.setAttribute(
          "aria-label",
          showPassword ? "Hide password" : "Show password"
        );
        toggle.setAttribute("aria-pressed", String(showPassword));
      });

      wrapper.appendChild(toggle);
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }

  function showNotice(message, type = "success") {
    let node = $("#app-notice");

    if (!node) {
      node = document.createElement("div");
      node.id = "app-notice";
      node.className = "notice";
      document.body.appendChild(node);
    }

    node.className = `notice ${type}`;
    node.textContent = message;
    node.classList.remove("hidden");

    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => node.classList.add("hidden"), 4200);
  }

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch (_) {}

    if (!response.ok) {
      throw new Error(
        payload.error || payload.message || `Request failed (${response.status})`
      );
    }

    return payload;
  }

  function roleIs(...roles) {
    return !!state?.current_user && roles.includes(state.current_user.role);
  }

  function starsText(n) {
    const count = Math.max(0, Math.min(10, Number(n) || 0));

    return `<span class="stars" title="${count} stars">${
      "★".repeat(Math.min(count, 5))
    }${count > 5 ? ` +${count - 5}` : ""}${count === 0 ? "☆" : ""}</span>`;
  }

  function shell(content) {
    document.body.innerHTML =
      `<div class="shell">
         ${content}
         <footer class="footer-note" style="text-align:center">
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

        ${state?.current_user ? `
          <div class="topbar-actions">
            <div class="muted small" style="text-align:right;margin-bottom:6px">
              ${escapeHtml(state.current_user.username)}
              · <span class="badge">${escapeHtml(state.current_user.role)}</span>
            </div>
            <button class="ghost" data-action="password">Change password</button>
            <button data-action="logout">Log out</button>
          </div>
        ` : ""}
      </header>
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
      const listItem = line.match(/^-\s+(.+)$/);
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
          <h2>Record a match</h2>
          <span class="help-tip" tabindex="0" role="note"
            aria-label="Choose 2–4 ranks and assign each player once."
            data-tooltip="Choose 2–4 ranks and assign each player once.">ⓘ</span>
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

          <div class="table-wrap">
            <table class="users-table">
              <colgroup>
                <col style="width:20%">
                <col style="width:17%">
                <col style="width:29%">
                <col style="width:34%">
              </colgroup>
              <thead><tr><th>Username</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                ${users.map(u => `
                  <tr>
                    <td>
                      ${escapeHtml(u.username)}
                      ${u.username === state.current_user.username ? ' <span class="badge">you</span>' : ""}
                    </td>

                    <td>
                      <select data-user-role="${escapeHtml(u.username)}">
                        ${["Admin", "Operator", "Viewer"].map(r => `
                          <option ${u.role === r ? "selected" : ""}>${r}</option>
                        `).join("")}
                      </select>
                    </td>

                    <td>
                      ${u.approved === false ? "Pending approval · inactive" : u.active === false ? "Inactive" : "Active"}
                      ${u.locked ? " · Locked" : ""}
                      ${u.must_change_password ? " · password change required" : ""}
                      ${u.has_backup_password ? " · backup password set" : " · no backup password"}
                    </td>

                    <td>
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

  function renderApp() {
    if (!state?.current_user) return renderLogin();

    const content =
      activeTab === "ranking" ? rankingContent() :
      activeTab === "random-teams" ? randomTeamsContent() :
      activeTab === "matches" ? matchContent() :
      activeTab === "history" ? historyContent() :
      activeTab === "players" ? playersContent() :
      usersContent();

    shell(`
      ${header()}
      ${nav()}

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
    `);

    setupPasswordToggles();

    if (activeTab === "matches") buildTeamFields();
    if (activeTab === "ranking") updateExportPreview();
    if (activeTab === "random-teams") renderRandomTeamOption(randomTeamOption);
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
          <div class="player-rank-row" data-player-row="${escapeHtml(p.name).toLowerCase()}">
            <label style="margin:0">
              <span class="player-rank-name">${escapeHtml(p.name)}</span>
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

    summary.innerHTML = Array.from({ length: count }, (_, i) => {
      const rank = i + 1;
      const members = selectedPlayers.filter(item => Number(item.rank) === rank);

      return `
        <div class="summary-rank${rank === 1 ? " first-place" : ""}">
          <h3>${rank === 1 ? '<span class="rank-trophy" aria-label="First place">🏆</span>' : ""}Rank ${rank}</h3>
          ${members.length
            ? members.map(item => `<span class="summary-player">${escapeHtml(item.name)}</span>`).join("")
            : `<span class="muted small">No players assigned</span>`}
        </div>
      `;
    }).join("");
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

  async function onSubmit(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    event.preventDefault();

    try {
      if (form.id === "bootstrap-form") {
        await submitForm(
          form,
          "/bootstrap-admin",
          x => x,
          "Admin account created. You are now signed in."
        );

      } else if (form.id === "register-form") {
        const values = formObject(form);
        await request("/register", { method: "POST", body: values });
        renderLogin();
        showNotice("Your account is inactive and waiting for Admin approval. You can sign in after it is approved.");

      } else if (form.id === "login-form") {
        await submitForm(form, "/login", x => x, "Signed in successfully.");

      } else if (form.id === "recovery-form") {
        await request("/recover-password", {
          method: "POST",
          body: formObject(form)
        });
        renderLogin();
        showNotice("Main password reset. You can now sign in.");

      } else if (form.id === "password-form") {
        const values = formObject(form);

        if (values.new_password !== values.confirm_password) {
          throw new Error("New password and confirmation do not match.");
        }

        await submitForm(
          form,
          "/change-password",
          x => x,
          "Password changed successfully."
        );

      } else if (form.id === "backup-password-form") {
        const values = formObject(form);
        if (values.new_backup_password !== values.confirm_backup_password) {
          throw new Error("Backup password and confirmation do not match.");
        }

        await request("/change-backup-password", {
          method: "POST",
          body: values
        });
        showNotice("Backup password saved successfully.");
        form.reset();

      } else if (form.id === "edit-player-form") {
        if (!roleIs("Admin")) {
          throw new Error("Only Admin can edit players.");
        }

        const values = formObject(form);
        const name = form.dataset.name;

        for (const field of [
          "tier",
          "stars",
          "win_streak",
          "play_streak",
          "off_streak"
        ]) {
          values[field] = Number(values[field]);

          if (!Number.isInteger(values[field])) {
            throw new Error(`${field} must be an integer.`);
          }
        }

        if (values.tier < 1 || values.tier > 5) {
          throw new Error("Tier must be an integer from 1 to 5.");
        }

        if (values.stars < 0 || values.stars > 10) {
          throw new Error("Stars must be an integer from 0 to 10.");
        }

        for (const field of ["win_streak", "play_streak", "off_streak"]) {
          if (values[field] < 0) {
            throw new Error(`${field} must be a non-negative integer.`);
          }
        }

        await request(`/admin/players/${encodeURIComponent(name)}`, {
          method: "PATCH",
          body: {
            tier: values.tier,
            stars: values.stars,
            win_streak: values.win_streak,
            play_streak: values.play_streak,
            off_streak: values.off_streak
          }
        });

        $("#edit-player-backdrop")?.remove();
        showNotice("Player ranking and streaks updated.");
        await refreshState();

      } else if (form.id === "add-player-form") {
        const values = formObject(form);
        values.tier = Number(values.tier);
        values.stars = Number(values.stars);

        await request("/admin/players", {
          method: "POST",
          body: values
        });

        showNotice("Player added successfully.");
        activeTab = "players";
        await refreshState();

      } else if (form.id === "create-user-form") {
        await submitForm(
          form,
          "/admin/users",
          x => x,
          "User created successfully."
        );

      } else if (form.id === "match-form") {
        const count = Number(form.elements.team_count.value);
        const assignments = $$("[name='player_rank']", form);

        const results = Array.from({ length: count }, (_, i) => ({
          rank: i + 1,
          members: []
        }));

        const seenPlayers = new Set();

        for (const select of assignments) {
          const playerName = select.dataset.player;
          const selectedRank = select.value;

          if (!selectedRank) continue;

          if (seenPlayers.has(playerName)) {
            throw new Error(`${playerName} is selected more than once.`);
          }

          seenPlayers.add(playerName);

          const rank = Number(selectedRank);

          if (rank < 1 || rank > count) {
            throw new Error(`Invalid rank for ${playerName}.`);
          }

          results[rank - 1].members.push(playerName);
        }

        const emptyRank = results.find(result => result.members.length === 0);

        if (emptyRank) {
          throw new Error(`Assign at least one player to Rank ${emptyRank.rank}.`);
        }

        await request("/matches", {
          method: "POST",
          body: {
            date: form.elements.date.value,
            team_count: count,
            results
          }
        });
        showNotice("Match result saved.");
        await refreshState();
      }
    } catch (error) {
      showNotice(error.message, "error");
    }
  }

  async function onClick(event) {
    const tab = event.target.closest("[data-tab]");

    if (tab) {
      activeTab = tab.dataset.tab;
      renderApp();
      return;
    }

    const button = event.target.closest("[data-action]");
    const exportButton = event.target.closest("#export-ranking-button");

    if (exportButton) {
      try {
        await saveRankingExport();
      } catch (error) {
        if (error.name !== "AbortError") {
          showNotice(error.message, "error");
        }
      }
      return;
    }

    if (!button) return;

    const action = button.dataset.action;
    const name = button.dataset.name;

    try {
      if (action === "copy-ranking-preview") {
        await copyRankingPreviewMarkdown();

      } else if (action === "generate-random-teams") {
        const teamCount = Number($("#random-team-count")?.value);
        const selectedPlayers = $$("input[name='random-player']:checked")
          .map(input => (state.players || []).find(
            player => player.name === input.value
          ))
          .filter(Boolean);

        if (![2, 3, 4].includes(teamCount)) {
          throw new Error("The number of teams must be between 2 and 4.");
        }
        if (selectedPlayers.length < teamCount) {
          throw new Error(`Select at least ${teamCount} players to create ${teamCount} teams.`);
        }

        const result = createRandomTeamOption(
          selectedPlayers,
          teamCount,
          previousRandomTeamSignature
        );
        if (!result) {
          randomTeamOption = null;
          renderRandomTeamOption(null);
          showNotice("Not enough players to create the teams.", "error");
          return;
        }

        randomTeamOption = result.option;
        previousRandomTeamSignature = result.signature;
        renderRandomTeamOption(randomTeamOption);
        const generateButton = $("[data-action='generate-random-teams']");
        if (generateButton) generateButton.textContent = "Reroll teams";
        if (randomTeamOption.violation > 0) {
          showNotice(
            "Teams were created using the closest option. Click Reroll teams to try again."
          );
        } else {
          showNotice("Teams randomized successfully.");
        }

      } else if (action === "show-auth-view") {
        const targetView = $(`#${CSS.escape(button.dataset.view || "")}`);
        if (!targetView?.classList.contains("auth-view")) {
          throw new Error("Invalid sign-in view.");
        }

        $$(".auth-view").forEach(view => view.classList.add("hidden"));
        targetView.classList.remove("hidden");

      } else if (action === "refresh") {
        await refreshState();
        showNotice("Ranking refreshed.");

      } else if (action === "logout") {
        await request("/logout", { method: "POST", body: {} });
        state = await request("/state");
        activeTab = "ranking";
        renderApp();
        showNotice("Logged out.");

      } else if (action === "password") {
        const main = $("#main-content");

        if (main) {
          main.insertAdjacentHTML("afterbegin", passwordModal());
          setupPasswordToggles();

          $("#password-panel")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }

      } else if (action === "close-password") {
        $("#password-panel")?.remove();

      } else if (action === "delete-selected-players") {
        if (!roleIs("Admin")) {
          throw new Error("Only Admin can delete players.");
        }

        const names = $$("input[name='selected-player']:checked")
          .map(input => input.value);

        if (!names.length) {
          throw new Error("Select at least one player to delete.");
        }

        const playerList = names.map(playerName => `"${playerName}"`).join(", ");
        if (!confirm(
          `Remove ${names.length} selected player(s) from the active roster: ${playerList}? Match history and existing logs will remain unchanged.`
        )) {
          return;
        }

        await request("/admin/players/delete-bulk", {
          method: "POST",
          body: { names, confirm: true }
        });

        showNotice(`${names.length} player(s) removed. Match history and logs were kept.`);
        activeTab = "players";
        await refreshState();

      } else if (action === "delete-player") {
        if (!roleIs("Admin")) {
          throw new Error("Only Admin can delete players.");
        }

        if (!confirm(
          `Remove "${name}" from the active roster? Existing match history and logs will be kept unchanged.`
        )) {
          return;
        }

        await request("/admin/players/delete", {
          method: "POST",
          body: { name, confirm: true }
        });

        showNotice(`Player "${name}" removed. Match history and logs were kept.`);
        activeTab = "players";
        await refreshState();

      } else if (action === "edit-player") {
        if (!roleIs("Admin")) {
          throw new Error("Only Admin can edit players.");
        }

        const player = (state.players || []).find(p => p.name === name);
        if (!player) return;

        $("#edit-player-backdrop")?.remove();

        document.body.insertAdjacentHTML(
          "beforeend",
          editPlayerModal(player)
        );

      } else if (action === "adjust-streak") {
        const field = button.dataset.field;
        const step = Number(button.dataset.step);

        const allowedFields = [
          "win_streak",
          "play_streak",
          "off_streak"
        ];

        if (!allowedFields.includes(field)) return;
        if (step !== -1 && step !== 1) return;

        const input = button.parentElement.querySelector(
          `input[name="${field}"]`
        );

        if (!input) return;

        const currentValue = input.value.trim() === ""
          ? 0
          : Number(input.value);

        if (!Number.isInteger(currentValue) || currentValue < 0) {
          input.value = "0";
          return;
        }

        input.value = String(Math.max(0, currentValue + step));
        input.dispatchEvent(new Event("input", { bubbles: true }));

      } else if (action === "cancel-player-edit") {
        $("#edit-player-backdrop")?.remove();

      } else if (action === "clear-history") {
        if (!confirm(
          "Hide all displayed match history? Source records and rankings will remain unchanged."
        )) {
          return;
        }

        await request("/admin/history/delete", {
          method: "POST",
          body: { confirm: true }
        });

        showNotice("Displayed history cleared.");
        await refreshState();

      } else if (action === "delete-match") {
        const matchId = Number(button.dataset.matchId);

        if (!Number.isInteger(matchId) || matchId < 1) {
          throw new Error("Invalid match ID.");
        }

        if (!confirm(
          `Permanently delete Match #${matchId}? Ranking and streaks will be rebuilt from the remaining matches, including saved manual player edits. Recent ranking-change logs will remain unchanged.`
        )) {
          return;
        }

        await request("/admin/history/delete-match", {
          method: "POST",
          body: { match_id: matchId, confirm: true }
        });

        showNotice(`Match #${matchId} permanently deleted; ranking rebuilt.`);
        await refreshState();

      } else if (action === "delete-all-history") {
        if (!confirm(
          "Permanently delete ALL source match records? Recent ranking-change logs will remain unchanged. This cannot be undone. Ranking and streaks will be rebuilt from initial player data and saved manual player edits."
        )) {
          return;
        }

        await request("/admin/history/delete-all", {
          method: "POST",
          body: { confirm: true }
        });

        showNotice("All match history permanently deleted; ranking rebuilt with saved manual player edits.");
        await refreshState();

      } else if (action === "restore-history") {
        await request("/admin/history/restore", {
          method: "POST",
          body: {}
        });

        showNotice("Hidden match history restored.");
        await refreshState();

      } else if (action === "clear-logs") {
        if (!confirm(
          "Clear recent ranking-change logs? Rankings and match history will remain unchanged."
        )) {
          return;
        }

        await request("/admin/logs/clear", {
          method: "POST",
          body: { confirm: true }
        });

        showNotice("Match logs cleared.");
        await refreshState();

      } else if (action === "save-user") {
        const role = $(`[data-user-role="${CSS.escape(name)}"]`)?.value;

        await request(`/admin/users/${encodeURIComponent(name)}`, {
          method: "PATCH",
          body: { role }
        });

        showNotice(`Role updated for ${name}.`);
        await refreshState();

      } else if (action === "approve-user") {
        await request(`/admin/users/${encodeURIComponent(name)}`, {
          method: "PATCH",
          body: { approved: true }
        });

        showNotice(`Account ${name} approved.`);
        await refreshState();

      } else if (action === "delete-user") {
        if (!confirm(`Permanently delete user ${name}?`)) return;

        await request("/admin/users/delete", {
          method: "POST",
          body: { username: name }
        });

        showNotice(`User ${name} deleted.`);
        await refreshState();

      } else if (action === "toggle-user") {
        const active = button.dataset.active === "false";

        await request(`/admin/users/${encodeURIComponent(name)}`, {
          method: "PATCH",
          body: { active }
        });

        showNotice(`User ${name} ${active ? "activated" : "deactivated"}.`);
        await refreshState();

      } else if (action === "reset-password") {
        const new_password = prompt(
          `Enter a temporary password for ${name} (minimum 10 characters):`
        );

        if (new_password === null) return;

        if (new_password.length < 10) {
          throw new Error("Password must contain at least 10 characters.");
        }

        await request(`/admin/users/${encodeURIComponent(name)}/reset-password`, {
          method: "PATCH",
          body: { new_password }
        });

        showNotice(`Password reset for ${name}. The user must sign in again.`);

      } else if (action === "unlock-user") {
        await request(`/admin/users/${encodeURIComponent(name)}`, {
          method: "PATCH",
          body: { unlock: true }
        });

        showNotice(`Account ${name} unlocked.`);
        await refreshState();
      }
    } catch (error) {
      showNotice(error.message, "error");
    }
  }

  function onChange(event) {
    if (event.target.id === "random-select-all") {
      const inputs = $$("input[name='random-player']");
      inputs.forEach(input => {
        input.checked = event.target.checked;
      });
      randomTeamSelection = event.target.checked
        ? null
        : new Set();
      updateRandomTeamSelection();
      clearRandomTeamOptions();

    } else if (event.target.matches("input[name='random-player']")) {
      randomTeamSelection = new Set(
        $$("input[name='random-player']:checked").map(input => input.value)
      );
      updateRandomTeamSelection();
      clearRandomTeamOptions();

    } else if (
      event.target.id === "random-team-count"
    ) {
      clearRandomTeamOptions();

    } else if (event.target.id === "team-count") {
      buildTeamFields();

    } else if (event.target.matches("[data-select-all-players]")) {
      $$("input[name='selected-player']").forEach(input => {
        input.checked = event.target.checked;
      });
      updateSelectedPlayersAction();

    } else if (event.target.matches("input[name='selected-player']")) {
      updateSelectedPlayersAction();

    } else if (event.target.matches("[name='player_rank']")) {
      updateMatchSummary();

    } else if (event.target.id === "export-date") {
      const filenameInput = $("#export-filename");

      if (filenameInput && !filenameInput.dataset.userEdited) {
        filenameInput.value = defaultExportFilename(event.target.value);
      }

      updateExportPreview();
    }
  }

  function updateRandomTeamSelection() {
    const inputs = $$("input[name='random-player']");
    const checkedCount = inputs.filter(input => input.checked).length;
    const countLabel = $("#random-player-count");
    const selectAll = $("#random-select-all");

    if (countLabel) {
      countLabel.textContent = `Players (${checkedCount}/${inputs.length})`;
    }
    if (selectAll) {
      selectAll.checked = inputs.length > 0 && checkedCount === inputs.length;
      selectAll.indeterminate = checkedCount > 0 && checkedCount < inputs.length;
    }
  }

  function clearRandomTeamOptions() {
    randomTeamOption = null;
    const container = $("#random-team-results");
    if (container) {
      container.innerHTML =
        `<p class="muted">Your selection changed. Reroll teams to see a new result.</p>`;
    }
    const generateButton = $("[data-action='generate-random-teams']");
    if (generateButton) generateButton.textContent = "Randomize teams";
  }

  function updateSelectedPlayersAction() {
    const checkboxes = $$("input[name='selected-player']");
    const checkedCount = checkboxes.filter(input => input.checked).length;
    const selectAll = $("[data-select-all-players]");
    const deleteButton = $("[data-action='delete-selected-players']");

    if (selectAll) {
      selectAll.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
      selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
    }

    if (deleteButton) {
      deleteButton.disabled = checkedCount === 0;
      deleteButton.textContent = checkedCount
        ? `Delete selected (${checkedCount})`
        : "Delete selected";
    }
  }

  function onInput(event) {
    if (event.target.id === "player-search") {
      applyPlayerSearch();

    } else if (event.target.id === "export-filename") {
      event.target.dataset.userEdited = "true";

    } else if (event.target.id === "export-date") {
      updateExportPreview();
    }
  }

  async function start() {
    injectStyles();

    document.addEventListener("submit", onSubmit);
    document.addEventListener("click", onClick);
    document.addEventListener("change", onChange);
    document.addEventListener("input", onInput);

    try {
      await refreshState();
    } catch (error) {
      shell(`
        ${header()}
        <section class="panel">
          <h2>Unable to load Power Ranking</h2>
          <p>${escapeHtml(error.message)}</p>
          <p class="muted">Make sure app.py is running and app.js is served from the same folder.</p>
          <button class="primary" data-action="refresh">Try again</button>
        </section>
      `);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
