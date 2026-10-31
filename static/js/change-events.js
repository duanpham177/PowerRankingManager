"use strict";

  async function onChange(event) {
    if (event.target.id === "theme-select") {
      setTheme(event.target.value);

    } else if (event.target.id === "settlement-team-count") {
      const form = event.target.form;
      if (form) updateDrinkSettlementTeamFields(form);

    } else if (event.target.matches("[name='item_id']")) {
      const activeShop = state.drink_shop.shops.find(
        shop => shop.id === activeDrinkShopId
      );
      const item = activeShop?.menu.find(
        menuItem => menuItem.id === event.target.value
      );
      const row = event.target.closest("[data-order-draft]");
      const sizeSelect = row
        ? $("[name='size']", row)
        : $("#drink-size");
      if (item && sizeSelect) {
        const selected = item.prices[sizeSelect.value] !== null
          ? sizeSelect.value
          : "";
        sizeSelect.innerHTML = drinkSizeOptions(item, selected);
      }

    } else if (event.target.id === "random-select-all") {
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
    if (event.target.id === "drink-bill-preview-prefix") {
      updateDrinkBillPreview();

    } else if (event.target.form?.id === "drink-settlement-form") {
      const form = event.target.form;
      rememberDrinkSettlementDraft(form);
      drinkSettlementResults.delete(form.dataset.shopId);
      const result = $("#drink-settlement-result");
      if (result) {
        result.innerHTML = `<p class="muted small">Inputs changed. Calculate the bill again to refresh the results.</p>`;
      }

    } else if (event.target.id === "player-search") {
      applyPlayerSearch();

    } else if (event.target.id === "export-filename") {
      event.target.dataset.userEdited = "true";

    } else if (event.target.id === "export-date") {
      updateExportPreview();
    }
  }
