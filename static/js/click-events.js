"use strict";

  async function onClick(event) {
    if (
      openDrinkShopMenuId &&
      !event.target.closest(".drink-shop-menu, .drink-shop-menu-toggle")
    ) {
      openDrinkShopMenuId = null;
      const menuEl = $(".drink-shop-menu");
      $$(".drink-shop-menu-toggle").forEach(toggle =>
        toggle.setAttribute("aria-expanded", "false"));
      if (menuEl) {
        menuEl.classList.add("closing");
        setTimeout(() => menuEl.remove(), 150);
      }
    }

    const logSummary = event.target.closest("details.log-details > summary");
    if (logSummary) {
      event.preventDefault();
      toggleLogDetails(logSummary.parentElement);
      return;
    }

    const userActionMenu = event.target.closest(".user-action-menu");
    if (!userActionMenu) {
      document.querySelectorAll(".user-action-menu[open]").forEach(menu => {
        menu.removeAttribute("open");
      });
    } else if (event.target.closest(".user-actions [data-action]")) {
      userActionMenu.removeAttribute("open");
    }

    if (openSettlementPicker && !event.target.closest(".drink-settlement-picker")) {
      openSettlementPicker = null;
      document.querySelectorAll(".drink-settlement-picker.is-open").forEach(picker => {
        picker.classList.remove("is-open");
        picker.querySelector(".drink-settlement-picker-toggle")
          ?.setAttribute("aria-expanded", "false");
      });
    }

    const tab = event.target.closest("[data-tab]");

    if (tab) {
      activeTab = tab.dataset.tab;
      renderApp();
      const main = $("#main-content");
      if (main) {
        main.classList.add("tab-enter");
        main.addEventListener("animationend", () => {
          main.classList.remove("tab-enter");
        }, { once: true });
      }
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

      } else if (action === "preview-drink-bill") {
        openDrinkBillPreview(button.dataset.shopId);

      } else if (action === "copy-drink-bill-preview") {
        await copyDrinkBillPreview(button);

      } else if (action === "close-drink-bill-preview") {
        closeDrinkBillPreview();

      } else if (action === "toggle-settlement-picker") {
        const assignment = button.dataset.settlementAssignment;
        openSettlementPicker = openSettlementPicker === assignment ? null : assignment;
        renderApp();

      } else if (action === "select-drink-shop") {
        const selectedShopId = button.dataset.shopId;
        if (selectedShopId === activeDrinkShopId) return;
        const menu = readDrinkMenuForm();
        await saveDrinkShop(drinkShopsWithMenu(menu));
        activeDrinkShopId = selectedShopId;
        confirmDeleteShopId = null;
        renameDrinkShopId = null;
        openDrinkShopMenuId = null;
        drinkMenuDraft = null;
        renderApp();

      } else if (action === "toggle-drink-shop-menu") {
        openDrinkShopMenuId = openDrinkShopMenuId === button.dataset.shopId
          ? null
          : button.dataset.shopId;
        confirmDeleteShopId = null;
        renameDrinkShopId = null;
        renderApp();

      } else if (action === "rename-drink-shop") {
        const shopId = button.dataset.shopId;
        const currentShop = state.drink_shop.shops.find(shop => shop.id === shopId);
        if (!currentShop) throw new Error("Shop was not found.");
        renameDrinkShopId = shopId;
        confirmDeleteShopId = null;
        openDrinkShopMenuId = null;
        renderApp();

      } else if (action === "cancel-rename-drink-shop") {
        renameDrinkShopId = null;
        renderApp();

      } else if (action === "delete-drink-shop") {
        const shopId = button.dataset.shopId;
        const currentShop = state.drink_shop.shops.find(shop => shop.id === shopId);
        if (!currentShop) throw new Error("Shop was not found.");
        confirmDeleteShopId = currentShop.id;
        openDrinkShopMenuId = null;
        renameDrinkShopId = null;
        renderApp();

      } else if (action === "remove-settlement-person") {
        await animateRemoval(button);
        removeDrinkSettlementPerson(button);

      } else if (action === "add-settlement-person") {
        addDrinkSettlementPerson(button);

      } else if (action === "cancel-delete-drink-shop") {
        confirmDeleteShopId = null;
        renderApp();

      } else if (action === "confirm-delete-drink-shop") {
        const shopId = button.dataset.shopId;
        if (confirmDeleteShopId !== shopId) {
          throw new Error("Shop deletion confirmation expired.");
        }
        await animateRemoval(button);
        const shops = drinkShopsForSave().filter(
          shop => shop.id !== shopId
        );
        const orders = state.drink_shop.orders.filter(
          order => order.shop_id !== shopId
        );
        await saveDrinkShop(shops, orders);
        drinkSettlementDrafts.delete(shopId);
        drinkSettlementResults.delete(shopId);
        if (activeDrinkShopId === shopId) {
          activeDrinkShopId = shops[0]?.id || null;
        }
        confirmDeleteShopId = null;
        renameDrinkShopId = null;
        openDrinkShopMenuId = null;
        drinkMenuDraft = null;
        showNotice("Shop and its orders removed.");
        renderApp();

      } else if (action === "add-drink-menu-item") {
        drinkMenuDraft = readDrinkMenuForm();
        drinkMenuDraft.push(blankDrinkMenuItem());
        renderApp();
        const newRow = $$("#drink-menu-form tr[data-menu-item-id]").pop();
        if (newRow) {
          newRow.classList.add("row-added");
          newRow.scrollIntoView({ behavior: "smooth", block: "center" });
          $("[name='menu-name']", newRow)?.focus({ preventScroll: true });
        }

      } else if (action === "export-drink-menu") {
        exportDrinkMenu();
        showNotice("Saved menu exported. Orders and personal data are not included.");

      } else if (action === "import-drink-menu") {
        $("#drink-menu-import-file")?.click();

      } else if (action === "remove-drink-menu-item") {
        const menu = readDrinkMenuForm();
        const itemId = button.dataset.menuItemId;
        const affectedOrders = state.drink_shop.orders.filter(
          order => order.shop_id === activeDrinkShopId
            && (order.item_id === itemId || order.topping_ids.includes(itemId))
        );
        if (affectedOrders.length && !await appConfirm(
          `This menu item is used by ${affectedOrders.length} order(s). Remove it and those order items?`
        )) return;
        await animateRemoval(button);
        drinkMenuDraft = menu.filter(item => item.id !== itemId);
        const orders = state.drink_shop.orders.filter(
          order => order.shop_id !== activeDrinkShopId
            || (order.item_id !== itemId && !order.topping_ids.includes(itemId))
        );
        if (affectedOrders.length) {
          await saveDrinkShop(drinkShopsWithMenu(drinkMenuDraft), orders);
          drinkSettlementResults.delete(activeDrinkShopId);
          showNotice("Menu item and related order items removed.");
        }
        renderApp();

      } else if (action === "delete-drink-order") {
        if (!roleIs("Admin", "Operator")) {
          throw new Error("Only Admin or Operator can remove drink orders.");
        }
        const orderId = Number(button.dataset.orderId);
        const orders = state.drink_shop.orders.filter(order => order.id !== orderId);
        if (orders.length === state.drink_shop.orders.length) {
          throw new Error("Drink order was not found.");
        }
        await animateRemoval(button);
        await saveDrinkShop(drinkShopsForSave(), orders);
        drinkSettlementResults.delete(activeDrinkShopId);
        showNotice("Drink order removed.");
        renderApp();

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
        renderRandomTeamOption(randomTeamOption, true);
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

      } else if (action === "export-players") {
        exportPlayers();
        showNotice("Players exported.");

      } else if (action === "import-players") {
        $("#players-import-file")?.click();

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
        if (!await appConfirm(
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

        if (!await appConfirm(
          `Remove "${name}" from the active roster? Existing match history and logs will be kept unchanged.`
        )) {
          return;
        }

        await animateRemoval(button);
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
        if (!await appConfirm(
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

        if (!await appConfirm(
          `Permanently delete Match #${matchId}? Ranking and streaks will be rebuilt from the remaining matches, including saved manual player edits. Recent ranking-change logs will remain unchanged.`
        )) {
          return;
        }

        await animateRemoval(button);
        await request("/admin/history/delete-match", {
          method: "POST",
          body: { match_id: matchId, confirm: true }
        });

        showNotice(`Match #${matchId} permanently deleted; ranking rebuilt.`);
        await refreshState();

      } else if (action === "delete-all-history") {
        if (!await appConfirm(
          "Permanently delete ALL source match records? Recent ranking-change logs will remain unchanged. This cannot be undone. Ranking and streaks will be rebuilt from initial player data and saved manual player edits."
        )) {
          return;
        }

        await animateRemovalAll(".history-match");
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
        if (!await appConfirm(
          "Clear recent ranking-change logs? Rankings and match history will remain unchanged."
        )) {
          return;
        }

        await animateRemovalAll(".log-entry");
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
        if (!await appConfirm(`Permanently delete user ${name}?`)) return;

        await animateRemoval(button);
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
        const new_password = await appPrompt(
          `Enter a temporary password for ${name} (minimum 10 characters):`,
          { type: "password" }
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
      undoRemovalAnimations();
      showNotice(error.message, "error");
    }
  }

  let activeRemovalAnimations = [];

  function undoRemovalAnimations() {
    activeRemovalAnimations.forEach(animation => animation.cancel());
    activeRemovalAnimations = [];
  }

  // Fades and collapses the row that owns the button; resolves when finished.
  // The row stays hidden until the next render, or until an error undoes it.
  async function animateRemoval(button) {
    const row = button.closest(
      "tr, .team-box, .user-account-card, .drink-settlement-assigned-person, li"
    );
    if (!row || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const height = row.offsetHeight;
    const isTableRow = row.tagName === "TR";
    const frames = isTableRow
      ? [
          { opacity: 1 },
          { opacity: 0 }
        ]
      : [
          { opacity: 1, height: `${height}px`, marginBottom: getComputedStyle(row).marginBottom },
          { opacity: 0, height: "0px", marginBottom: "0px", paddingTop: "0px", paddingBottom: "0px" }
        ];
    row.style.overflow = "hidden";
    const animation = row.animate(frames, {
      duration: 280,
      easing: "cubic-bezier(.4, 0, .2, 1)",
      fill: "forwards"
    });
    activeRemovalAnimations.push(animation);
    await animation.finished.catch(() => {});
  }

  async function animateRemovalAll(selector) {
    const rows = $$(selector, $("#main-content") || document);
    if (!rows.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animations = rows.map((row, index) => {
      const height = row.offsetHeight;
      row.style.overflow = "hidden";
      const animation = row.animate(
        [
          { opacity: 1, height: `${height}px`, marginBottom: getComputedStyle(row).marginBottom },
          { opacity: 0, height: "0px", marginBottom: "0px", paddingTop: "0px", paddingBottom: "0px" }
        ],
        {
          duration: 320,
          delay: Math.min(index, 8) * 60,
          easing: "cubic-bezier(.4, 0, .2, 1)",
          fill: "both"
        }
      );
      activeRemovalAnimations.push(animation);
      return animation.finished.catch(() => {});
    });
    await Promise.all(animations);
  }

  function toggleLogDetails(details) {
    const body = details.querySelector(".log-details-body");
    if (!body || details.dataset.animating) {
      details.open = !details.open;
      return;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const opening = !details.open;
    if (reduceMotion) {
      details.open = opening;
      return;
    }

    details.dataset.animating = "true";
    if (opening) details.open = true;
    const height = body.scrollHeight;
    const frames = [
      { height: "0px", opacity: 0, overflow: "hidden" },
      { height: `${height}px`, opacity: 1, overflow: "hidden" }
    ];
    const animation = body.animate(opening ? frames : frames.slice().reverse(), {
      duration: 280,
      easing: "ease-in-out"
    });
    animation.onfinish = () => {
      if (!opening) details.open = false;
      delete details.dataset.animating;
    };
  }

  function onKeyDown(event) {
    if (event.key !== "Escape") return;

    const openMenus = [...document.querySelectorAll(".user-action-menu[open]")];
    if (!openMenus.length) return;

    openMenus.forEach(menu => menu.removeAttribute("open"));
    openMenus[openMenus.length - 1].querySelector(".user-action-menu-trigger").focus();
    event.preventDefault();
  }
