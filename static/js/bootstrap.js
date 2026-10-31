"use strict";

  async function start() {
    loadTheme();
    injectStyles();

    document.addEventListener("submit", onSubmit);
    document.addEventListener("reset", onReset);
    document.addEventListener("click", onClick);
    document.addEventListener("change", onChange);
    document.addEventListener("input", onInput);
    document.addEventListener("keydown", onKeyDown);

    try {
      await refreshState();
    } catch (error) {
      shell(`
        ${header()}
        <section class="panel">
          <h2>Unable to load Power Ranking</h2>
          <p>${escapeHtml(error.message)}</p>
          <p class="muted">Make sure the Power Ranking server is running and its static assets are available.</p>
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
