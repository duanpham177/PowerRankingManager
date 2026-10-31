"use strict";

  const API = "/api";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const THEMES = ["ocean", "midnight", "light"];
  const THEME_STORAGE_KEY = "power-ranking-theme";

  let state = null;
  let activeTab = "ranking";
  let activeTheme = "ocean";
  let noticeTimer = null;
  let approvalPollTimer = null;
  let randomTeamSelection = null;
  let randomTeamOption = null;
  let previousRandomTeamSignature = "";
  let drinkMenuDraft = null;
  let activeDrinkShopId = null;
  let confirmDeleteShopId = null;
  let openDrinkShopMenuId = null;
  let renameDrinkShopId = null;
  const drinkSettlementDrafts = new Map();
  const drinkSettlementResults = new Map();
  let openSettlementPicker = null;

  const css = `
    :root {
      color-scheme: dark;
      --bg: #0d2b3e;
      --bg-glow: #1d5373;
      --panel: #143a52;
      --panel-a: #174058f5;
      --panel-b: #0f3047f5;
      --line: #2f6485;
      --text: #fbebd2;
      --muted: #8fb0a9;
      --page-muted: #8fb0a9;
      --accent: #fbd266;
      --on-accent: #0a2433;
      --accent-2: #55d4db;
      --sea: #266587;
      --sea-light: #4f90be;
      --danger: #d76735;
      --danger-bg: #3d2418;
      --field: #0a2433;
      --card: #0f3047;
      --menu: #1d5373;
      --th: #0f3550;
      --hover: #ffffff12;
      --hover-weak: #ffffff0c;
      --scrim: #050914cc;
      --shadow: #0008;
      --notice: #174a66;
      --notice-error: #4a2a1c;
      --notice-success: #12474d;
      --first-place: #4a4a2a;
      --surface-shadow-light: #24536c;
      --surface-shadow-dark: #081f2d;
      --inset-shadow-dark: #081f2d;
      --inset-shadow-light: #24536c;
    }

    :root[data-theme="midnight"] {
      --bg: #191526;
      --bg-glow: #3d3158;
      --panel: #292338;
      --panel-a: #332c47f5;
      --panel-b: #211d32f5;
      --line: #54486e;
      --text: #f4efff;
      --muted: #b3a9c7;
      --page-muted: #b3a9c7;
      --accent: #d3a6ff;
      --on-accent: #241a32;
      --accent-2: #8de0d1;
      --sea: #51416f;
      --sea-light: #8e73b6;
      --danger-bg: #402332;
      --field: #1b1729;
      --card: #211d32;
      --menu: #3d3158;
      --th: #302941;
      --scrim: #0d0a16cc;
      --notice: #332c47;
      --notice-error: #4a2937;
      --notice-success: #21443e;
      --first-place: #51442f;
      --surface-shadow-light: #423955;
      --surface-shadow-dark: #100d1c;
      --inset-shadow-dark: #100d1c;
      --inset-shadow-light: #423955;
    }

    :root[data-theme="light"] {
      color-scheme: light;
      --bg: #e7e8f0;
      --bg-glow: #e7e8f0;
      --panel: #e7e8f0;
      --panel-a: #eaebf3;
      --panel-b: #e4e5ed;
      --line: #d3d5e0;
      --text: #34364a;
      --muted: #62667a;
      --page-muted: #62667a;
      --accent: #5549c9;
      --on-accent: #ffffff;
      --accent-2: #8d86d7;
      --sea: #e7e8f0;
      --sea-light: #d3d5e0;
      --danger: #bd5064;
      --danger-bg: #eee5e9;
      --field: #e7e8f0;
      --card: #e7e8f0;
      --menu: #e7e8f0;
      --th: #e2e3eb;
      --hover: #5549c914;
      --hover-weak: #5549c90a;
      --scrim: #172b4d66;
      --shadow: #b8bac8;
      --surface-shadow-light: #ffffff;
      --surface-shadow-dark: #c4c6d2;
      --inset-shadow-dark: #c4c6d2;
      --inset-shadow-light: #ffffff;
      --notice: #e7e8f0;
      --notice-error: #eee5e9;
      --notice-success: #e4e9e8;
      --first-place: #e4e1f4;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      background: radial-gradient(ellipse at top, var(--bg-glow), var(--bg) 65%);
      background-attachment: fixed;
      color: var(--text);
      font: 15px/1.5 system-ui, sans-serif;
    }

    button, input, select { font: inherit; }

    button {
      cursor: pointer;
      border: 1px solid var(--sea-light);
      background: var(--sea);
      color: var(--text);
      padding: 9px 13px;
      border-radius: 9px;
      font-weight: 650;
    }

    button:hover { filter: brightness(1.12); }
    button:disabled { opacity: .45; cursor: not-allowed; }
    button.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
    button.danger { background: var(--danger-bg); border-color: var(--danger); }
    button.ghost { background: transparent; }

    input, select {
      width: 100%;
      padding: 10px 11px;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: var(--field);
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
      color: var(--muted);
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
      color: var(--text);
      background: #ffffff14;
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
      background: var(--scrim);
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
      background: var(--panel);
      box-shadow: 0 24px 70px #0008;
    }

    .edit-modal .form-grid {
      margin-top: 14px;
    }

    .drink-bill-preview-dialog {
      width: min(720px, calc(100vw - 32px));
      max-width: none;
      max-height: min(85vh, 760px);
      padding: 0;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: var(--panel);
      color: var(--text);
      box-shadow: 0 24px 70px #0008;
    }

    .drink-bill-preview-dialog::backdrop {
      background: var(--scrim);
      backdrop-filter: blur(5px);
    }

    .drink-bill-preview-content {
      display: grid;
      gap: 14px;
      max-height: min(85vh, 760px);
      overflow-y: auto;
      padding: 22px;
    }

    .drink-bill-preview-content h2 { margin: 0; }
    .drink-bill-preview-content .export-preview { max-height: none; margin: 0; }
    .drink-bill-preview-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .drink-bill-preview-copy-status { min-height: 1.5em; margin: 0; color: var(--muted); }

    .streak-control {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      padding: 13px 0;
      border-bottom: 1px solid var(--line);
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

    .shell {
      display: flex;
      flex-direction: column;
      max-width: 1200px;
      min-height: 100vh;
      margin: auto;
      padding: 28px 20px 20px;
    }

    .shell.has-sidebar {
      display: grid;
      grid-template-columns: 250px minmax(0, 1fr);
      grid-template-rows: 1fr auto;
      gap: 24px;
      align-items: start;
      max-width: 1480px;
      padding-bottom: 20px;
    }

    .shell.has-sidebar > .sidebar { grid-column: 1; grid-row: 1 / span 2; }
    .shell.has-sidebar > #main-content { grid-column: 2; grid-row: 1; min-width: 0; }
    .shell.has-sidebar > .app-footer {
      grid-column: 2;
      grid-row: 2;
      align-self: end;
      margin-top: 18px;
    }

    .sidebar {
      position: sticky;
      top: 28px;
      display: flex;
      flex-direction: column;
      gap: 22px;
      height: calc(100vh - 56px);
      overflow-y: auto;
      padding: 20px 14px;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: linear-gradient(180deg, var(--panel-a), var(--panel-b));
      box-shadow: 0 12px 35px #0002;
    }

    .sidebar .brand { padding: 0 6px; }
    .sidebar h1 { font-size: 19px; margin: 0; }
    .sidebar .subtitle { font-size: 12px; }

    .sidebar .tabs {
      display: flex;
      flex-direction: column;
      flex-wrap: nowrap;
      gap: 4px;
      margin: 0;
    }

    .sidebar .tabs button {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      border-color: transparent;
      background: transparent;
      text-align: left;
    }

    .sidebar .tabs button:hover { background: var(--hover); filter: none; }
    .sidebar .tabs button.active { background: var(--accent); }

    .sidebar-account {
      display: grid;
      gap: 8px;
      margin-top: auto;
      padding: 14px 6px 0;
      border-top: 1px solid var(--line);
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 18px;
      margin-bottom: 24px;
    }

    .topbar-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      flex-wrap: wrap;
    }

    .theme-control {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      color: var(--muted);
      font-size: 12px;
    }

    .theme-control select {
      width: auto;
      min-width: 140px;
      padding: 8px 10px;
    }

    .sidebar .theme-control {
      justify-content: space-between;
      padding: 0 6px;
    }

    .brand { display: flex; align-items: center; gap: 12px; }

    .logo {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--accent-2), var(--accent));
      display: grid;
      place-items: center;
      color: var(--on-accent);
      font-weight: 900;
      font-size: 22px;
    }

    .subtitle { color: var(--muted); font-size: 13px; }

    .panel {
      background: linear-gradient(145deg, var(--panel-a), var(--panel-b));
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
    .tabs button { background: var(--card); border-color: var(--line); color: var(--muted); }
    .tabs button.active { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
    .tab-notification {
      display: inline-grid;
      min-width: 19px;
      height: 19px;
      place-items: center;
      margin-left: 6px;
      padding: 0 5px;
      border-radius: 999px;
      background: var(--danger);
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

    .drink-shop-controls {
      display: grid;
      gap: 12px;
      margin-bottom: 14px;
    }

    .drink-shop-list {
      display: grid;
      gap: 8px;
      padding: 0;
      margin: 0;
      list-style: none;
    }

    .drink-shop-list-item {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--card);
    }

    .drink-shop-list-item.active {
      border-color: var(--accent);
    }

    .drink-shop-select {
      flex: 1;
      width: auto;
      min-width: 0;
      text-align: left;
      background: transparent;
    }

    .drink-shop-select.active {
      color: var(--accent);
      font-weight: 700;
    }

    .drink-shop-menu-toggle {
      width: 40px;
      min-height: 38px;
      padding: 0;
      font-size: 22px;
      line-height: 1;
    }

    .drink-shop-menu {
      position: absolute;
      z-index: 2;
      top: calc(100% - 2px);
      right: 8px;
      display: grid;
      min-width: 140px;
      gap: 4px;
      padding: 6px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--panel);
      box-shadow: 0 10px 24px #0008;
    }

    .drink-shop-menu button {
      width: 100%;
      text-align: left;
    }

    .drink-shop-rename-form {
      display: flex;
      flex: 1 0 100%;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .drink-shop-rename-form input {
      flex: 1 1 180px;
      width: auto;
    }

    .drink-shop-rename-form button { width: auto; }

    .drink-settlement-teams {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
      margin: 14px 0;
    }

    .drink-settlement-team {
      min-width: 0;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 10px;
    }

    .drink-settlement-team legend {
      padding: 0 6px;
      color: var(--text);
      font-weight: 700;
    }

    .drink-settlement-assigned-list {
      display: grid;
      gap: 6px;
      max-height: 180px;
      overflow-y: auto;
      margin: 8px 0 12px;
      padding-right: 4px;
    }

    .drink-settlement-assigned-person {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 6px 9px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--field);
    }

    .drink-settlement-assigned-person button {
      width: auto;
      padding: 2px 8px;
    }

    .drink-settlement-picker {
      position: relative;
    }

    .drink-settlement-picker-toggle {
      width: 100%;
      background: var(--sea);
      border-color: var(--sea-light);
      text-align: left;
    }

    .drink-settlement-picker-options {
      position: absolute;
      z-index: 4;
      top: calc(100% + 4px);
      right: 0;
      left: 0;
      display: none;
      max-height: 180px;
      overflow-y: auto;
      padding: 5px;
      border: 1px solid var(--sea-light);
      border-radius: 8px;
      background: var(--menu);
      box-shadow: 0 10px 24px #0008;
      color-scheme: dark;
    }

    .drink-settlement-picker.is-open .drink-settlement-picker-options {
      display: grid;
    }

    .drink-settlement-picker-options button {
      width: 100%;
      border: 0;
      border-radius: 5px;
      background: transparent;
      text-align: left;
    }

    .drink-settlement-picker-options button:hover {
      background: var(--sea-light);
      color: #fff;
    }

    .drink-settlement-picker-options .muted {
      padding: 8px;
    }

    .drink-settlement-team textarea,
    #drink-settlement-form textarea {
      width: 100%;
      padding: 10px 11px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--field);
      color: var(--text);
      font: inherit;
      resize: vertical;
    }

    .drink-settlement-result {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 14px;
      margin-top: 18px;
    }

    .drink-settlement-result > div,
    .drink-settlement-result .table-wrap {
      min-width: 0;
      max-width: 100%;
    }

    .drink-settlement-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 8px;
    }

    .drink-settlement-summary > div,
    .drink-settlement-people > div {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      padding: 9px 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
    }

    .drink-settlement-summary > div {
      flex-direction: column;
      color: var(--muted);
      font-size: 12px;
    }

    .drink-settlement-summary strong { color: var(--text); font-size: 15px; }
    .drink-settlement-people { display: grid; gap: 6px; }
    .drink-settlement-people strong { white-space: nowrap; }
    .drink-settlement-breakdown { min-width: 720px; }

    .drink-shop-add-form,
    .drink-shop-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-start;
      gap: 10px;
    }

    .drink-shop-add-form { align-items: flex-end; }
    .drink-shop-add-form .field { min-width: 220px; }
    .drink-shop-actions { width: 100%; align-items: flex-end; }
    .drink-shop-actions .field { flex: 1 1 220px; }
    .drink-shop-actions button,
    .drink-shop-add-form button { width: auto; }

    .drink-shop-delete-confirm {
      display: grid;
      gap: 12px;
      margin: 12px 0;
      padding: 14px;
      border: 1px solid var(--danger);
      border-radius: 10px;
      background: var(--danger-bg);
    }

    .checkbox-label {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      cursor: pointer;
    }

    .checkbox-label input {
      width: auto;
      margin-top: 5px;
    }

    .table-wrap {
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 11px;
    }

    table { width: 100%; border-collapse: collapse; min-width: 580px; }

    th, td {
      text-align: left;
      padding: 11px 13px;
      border-bottom: 1px solid var(--line);
      white-space: nowrap;
    }

    th {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: var(--muted);
      background: var(--th);
    }

    tr:last-child td { border-bottom: 0; }
    tbody tr:hover {     background: var(--hover-weak); }

    .tier {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 60px;
      padding: 4px 9px;
      border-radius: 20px;
      background: var(--sea);
      font-weight: 750;
    }

    .stars { color: var(--accent); letter-spacing: 1px; }
    .row-actions { display: flex; gap: 6px; }
    .row-actions button { padding: 6px 9px; font-size: 12px; }
    .user-actions {
      display: flex;
      gap: 6px;
      min-width: 0;
      flex-wrap: wrap;
      margin-top: 14px;
    }
    .user-actions button {
      min-width: 0;
      min-height: 36px;
      padding: 6px 8px;
      white-space: normal;
    }

    .users-grid {
      grid-template-columns: minmax(0, .8fr) minmax(0, 1.6fr);
      align-items: start;
    }

    .user-account-list {
      display: grid;
      gap: 12px;
    }

    .user-account-card {
      min-width: 0;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: linear-gradient(145deg, var(--panel-a), var(--panel-b));
    }

    .user-account-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .user-account-heading-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .user-account-heading h3 {
      min-width: 0;
      margin: 0;
      overflow-wrap: anywhere;
    }

    .user-account-status {
      display: inline-flex;
      flex: 0 0 auto;
      align-items: center;
      gap: 7px;
      padding: 4px 9px;
      border-radius: 999px;
      background: var(--sea);
      color: var(--text);
      font-size: 12px;
      font-weight: 700;
    }

    .user-account-status::before {
      width: 8px;
      height: 8px;
      border: 1px solid currentColor;
      border-radius: 50%;
      background: #64748b;
      content: "";
    }

    .user-account-status.active::before {
      border-color: #16a34a;
      background: #22c55e;
      box-shadow: 0 0 0 2px rgb(34 197 94 / 16%), 0 0 9px rgb(34 197 94 / 55%);
    }

    .user-account-status.pending::before {
      border-color: #d97706;
      background: #f59e0b;
      box-shadow: 0 0 0 2px rgb(245 158 11 / 16%), 0 0 8px rgb(245 158 11 / 40%);
    }

    .user-account-details {
      display: grid;
      grid-template-columns: minmax(120px, .45fr) minmax(0, 1fr);
      align-items: end;
      gap: 12px;
      margin-top: 12px;
    }

    .user-account-flags {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding-bottom: 2px;
    }

    .user-account-flag {
      padding: 4px 8px;
      border-radius: 7px;
      background: var(--card);
      color: var(--muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }

    .user-action-menu {
      position: relative;
    }

    .user-action-menu-trigger {
      display: grid;
      width: 36px;
      height: 36px;
      place-items: center;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: var(--card);
      color: var(--text);
      cursor: pointer;
      font-size: 22px;
      font-weight: 700;
      line-height: 1;
      list-style: none;
    }

    .user-action-menu-trigger::-webkit-details-marker {
      display: none;
    }

    .user-action-menu-trigger:hover,
    .user-action-menu[open] .user-action-menu-trigger {
      border-color: var(--sea-light);
      background: var(--hover);
    }

    .user-action-menu .user-actions {
      position: absolute;
      z-index: 20;
      top: calc(100% + 6px);
      right: 0;
      display: grid;
      min-width: 180px;
      gap: 4px;
      margin: 0;
      padding: 6px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--panel);
      box-shadow: 0 12px 30px var(--shadow);
    }

    .user-action-menu .user-actions button {
      width: 100%;
      text-align: left;
    }

    .user-action-menu .user-actions button.danger {
      color: var(--danger);
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
      border: 1px solid var(--sea-light);
      background: var(--notice);
      box-shadow: 0 15px 40px #0007;
    }

    .notice.error { border-color: var(--danger); background: var(--notice-error); }
    .notice.success { border-color: var(--accent-2); background: var(--notice-success); }

    .section-grid, .team-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }

    .section-grid > *, .team-grid > * { min-width: 0; }

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
      background: var(--card);
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
      background: var(--card);
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
      background: var(--sea);
      color: var(--text);
      font-size: 12px;
    }

    .footer-note { color: var(--page-muted); font-size: 12px; margin-top: 18px; }

    .app-footer {
      margin-top: auto;
      padding: 8px 0;
      text-align: center;
    }

    .topbar h1 { color: var(--text); }
    .topbar .subtitle { color: var(--muted); }

    .player-rank-row {
      display: grid;
      grid-template-columns: minmax(130px, 1fr) minmax(150px, 1fr);
      gap: 12px;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid var(--line);
    }

    .player-rank-row:last-child { border-bottom: 0; }
    .player-rank-name {
      color: var(--text);
      font-size: 16px;
      font-weight: 750;
      letter-spacing: .01em;
    }

    .summary-rank { margin-top: 10px; }
    .summary-rank h3 { margin-bottom: 6px; }
    .summary-rank.first-place {
      border-color: var(--accent);
      background: linear-gradient(135deg, var(--first-place), var(--card) 70%);
    }

    .summary-rank.first-place h3 { color: var(--accent); }
    .rank-trophy { margin-right: 6px; }

    .summary-player {
      display: inline-block;
      margin: 3px 4px 3px 0;
      padding: 4px 9px;
      border-radius: 20px;
      background: var(--sea);
      color: var(--text);
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
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .export-filename-control input {
      min-width: 0;
      flex: 1;
    }

    .export-filename-control button {
      flex: 0 0 44px;
      display: grid;
      place-items: center;
      width: 44px;
      min-width: 44px;
      height: 44px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--text);
    }

    .export-filename-control button:hover {
      background: var(--hover);
      filter: none;
    }

    .export-filename-control button:focus-visible {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }

    .export-preview {
      overflow-wrap: anywhere;
      max-height: 360px;
      overflow: auto;
      background: var(--field);
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
      .shell { padding: 18px 12px 20px; }
      .shell.has-sidebar {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: auto;
        gap: 16px;
        padding-bottom: 20px;
      }
      .shell.has-sidebar > .sidebar,
      .shell.has-sidebar > #main-content,
      .shell.has-sidebar > .app-footer { grid-column: 1; grid-row: auto; }
      .sidebar { position: static; height: auto; gap: 14px; }
      .sidebar .tabs { flex-direction: row; flex-wrap: wrap; }
      .sidebar .tabs button { width: auto; border-color: var(--line); }
      .sidebar-account { margin-top: 0; grid-template-columns: 1fr 1fr; }
      .sidebar-account .muted { grid-column: 1 / -1; }
      .topbar { align-items: flex-start; }
      .users-grid { grid-template-columns: minmax(0, 1fr); }
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
      .user-account-details { grid-template-columns: minmax(0, 1fr); gap: 8px; }
      .user-actions button { flex: 1 1 120px; }
      .player-rank-row { grid-template-columns: 1fr; gap: 5px; }
      .edit-modal { padding: 18px; }
      .drink-bill-preview-content { padding: 18px; }
      .streak-control { gap: 8px; }
      .streak-buttons { gap: 5px; }
      .streak-value { width: 54px; }
      .streak-buttons button { flex-basis: 34px; width: 34px; height: 36px; }
    }

    :root[data-theme="light"] body {
      background: var(--bg);
    }

    :root[data-theme] .panel,
    :root[data-theme] .sidebar,
    :root[data-theme] .user-account-card,
    :root[data-theme] .edit-modal,
    :root[data-theme] .drink-bill-preview-dialog,
    :root[data-theme] .rank-card,
    :root[data-theme] .team-box,
    :root[data-theme] .summary-rank,
    :root[data-theme] .random-player,
    :root[data-theme] .random-team,
    :root[data-theme] .drink-shop-list-item,
    :root[data-theme] .drink-settlement-team {
      border-color: transparent;
      background: var(--panel);
      box-shadow:
        7px 7px 16px var(--surface-shadow-dark),
        -7px -7px 16px var(--surface-shadow-light);
    }

    :root[data-theme] button {
      border-color: transparent;
      border-radius: 999px;
      background: var(--panel);
      color: var(--text);
      box-shadow:
        4px 4px 8px var(--surface-shadow-dark),
        -4px -4px 8px var(--surface-shadow-light);
      transition: box-shadow .18s ease, transform .18s ease, background .18s ease;
    }

    :root[data-theme] button:hover {
      filter: none;
      transform: translateY(-1px);
    }

    :root[data-theme] button:active {
      transform: translateY(0);
      box-shadow:
        inset 3px 3px 6px var(--inset-shadow-dark),
        inset -3px -3px 6px var(--inset-shadow-light);
    }

    :root[data-theme] button.primary,
    :root[data-theme] .tabs button.active,
    :root[data-theme] .sidebar .tabs button.active {
      border-color: transparent;
      background: var(--accent);
      color: var(--on-accent);
      box-shadow:
        4px 4px 9px var(--surface-shadow-dark),
        -4px -4px 9px var(--surface-shadow-light);
    }

    :root[data-theme] button.danger {
      border-color: transparent;
      background: var(--danger-bg);
      color: var(--danger);
    }

    :root[data-theme] input:not([type="checkbox"]):not([type="radio"]),
    :root[data-theme] select,
    :root[data-theme] textarea,
    :root[data-theme] .drink-settlement-team textarea,
    :root[data-theme] #drink-settlement-form textarea {
      border-color: transparent;
      background: var(--panel);
      color: var(--text);
      box-shadow:
        inset 4px 4px 8px var(--inset-shadow-dark),
        inset -4px -4px 8px var(--inset-shadow-light);
    }

    :root[data-theme] input:focus,
    :root[data-theme] select:focus,
    :root[data-theme] textarea:focus {
      border-color: var(--accent);
      box-shadow:
        inset 3px 3px 6px var(--inset-shadow-dark),
        inset -3px -3px 6px var(--inset-shadow-light),
        0 0 0 2px var(--hover);
    }

    :root[data-theme] .tabs button,
    :root[data-theme] .sidebar .tabs button {
      border-color: transparent;
      background: var(--panel);
      color: var(--muted);
      box-shadow:
        3px 3px 7px var(--surface-shadow-dark),
        -3px -3px 7px var(--surface-shadow-light);
    }

    :root[data-theme] .sidebar .tabs button:hover {
      background: var(--panel);
      box-shadow:
        inset 2px 2px 4px var(--inset-shadow-dark),
        inset -2px -2px 4px var(--inset-shadow-light);
    }

    :root[data-theme] .sidebar .tabs button.active {
      color: var(--on-accent);
      box-shadow:
        3px 3px 8px var(--surface-shadow-dark),
        -3px -3px 8px var(--surface-shadow-light);
    }

    :root[data-theme] .table-wrap {
      border-color: transparent;
      background: var(--panel);
      box-shadow:
        inset 3px 3px 7px var(--inset-shadow-dark),
        inset -3px -3px 7px var(--inset-shadow-light);
    }

    :root[data-theme] th {
      background: var(--th);
      color: var(--muted);
    }

    :root[data-theme] th,
    :root[data-theme] td,
    :root[data-theme] .player-rank-row,
    :root[data-theme] .sidebar-account {
      border-color: var(--line);
    }

    :root[data-theme] .user-account-flag,
    :root[data-theme] .user-account-status,
    :root[data-theme] .badge,
    :root[data-theme] .tier,
    :root[data-theme] .summary-player {
      background: var(--card);
      color: var(--text);
      box-shadow:
        2px 2px 5px var(--surface-shadow-dark),
        -2px -2px 5px var(--surface-shadow-light);
    }

    :root[data-theme] .user-account-status.active::before {
      box-shadow: 0 0 0 2px #22c55e24, 0 0 8px #22c55e70;
    }

    :root[data-theme] .user-action-menu .user-actions {
      border-color: transparent;
      background: var(--panel);
      box-shadow:
        7px 7px 16px var(--surface-shadow-dark),
        -7px -7px 16px var(--surface-shadow-light);
    }

    :root[data-theme] .drink-settlement-picker-options {
      border-color: transparent;
      background: var(--panel);
      box-shadow:
        7px 7px 16px var(--surface-shadow-dark),
        -7px -7px 16px var(--surface-shadow-light);
    }

    :root[data-theme] .drink-settlement-picker-options button:hover {
      background: var(--hover);
      color: var(--text);
    }

    :root[data-theme] .notice {
      border-color: transparent;
      background: var(--panel);
      box-shadow:
        7px 7px 16px var(--surface-shadow-dark),
        -7px -7px 16px var(--surface-shadow-light);
    }

    :root[data-theme] .notice.error { background: var(--notice-error); }
    :root[data-theme] .notice.success { background: var(--notice-success); }

    :root[data-theme] .summary-rank.first-place {
      background: linear-gradient(145deg, var(--first-place), var(--panel));
    }

    :root[data-theme] .password-toggle {
      border-radius: 7px;
      background: transparent;
      box-shadow: none;
    }

    :root[data-theme] .password-toggle:hover {
      background: var(--hover);
      transform: translateY(-50%);
    }

    :root[data-theme] button:disabled {
      box-shadow: none;
      transform: none;
    }

    :root[data-theme] .export-filename-control button {
      background: var(--panel);
      box-shadow:
        3px 3px 6px var(--surface-shadow-dark),
        -3px -3px 6px var(--surface-shadow-light);
    }

    :root[data-theme] .export-filename-control button:hover {
      background: var(--panel);
      box-shadow:
        inset 2px 2px 4px var(--inset-shadow-dark),
        inset -2px -2px 4px var(--inset-shadow-light);
    }
  `;

  function loadTheme() {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (THEMES.includes(savedTheme)) activeTheme = savedTheme;
    } catch (error) {
      console.warn("Unable to load the saved theme preference.", error);
    }

    document.documentElement.dataset.theme = activeTheme;
  }

  function setTheme(theme) {
    if (!THEMES.includes(theme)) {
      throw new Error("Choose one of the available themes.");
    }

    activeTheme = theme;
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      console.warn("Unable to save the theme preference.", error);
      showNotice("Theme changed, but your preference could not be saved.", "error");
    }
  }

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
