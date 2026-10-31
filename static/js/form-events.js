"use strict";

  function onReset(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== "match-form") return;

    setTimeout(() => {
      if (!form.isConnected) return;
      buildTeamFields();
      applyPlayerSearch();
      updateMatchSummary();
    }, 0);
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

      } else if (form.id === "add-drink-shop-form") {
        const name = String(formObject(form).shop_name || "").trim();
        if (!name) throw new Error("Enter a shop name.");
        const newShop = { id: drinkMenuId(), name, menu: [] };
        await saveDrinkShop([...drinkShopsForSave(), newShop]);
        activeDrinkShopId = newShop.id;
        confirmDeleteShopId = null;
        openDrinkShopMenuId = null;
        renameDrinkShopId = null;
        drinkMenuDraft = [];
        showNotice("Shop added.");
        renderApp();

      } else if (form.matches(".drink-shop-rename-form")) {
        const shopId = form.dataset.shopId;
        const currentShop = state.drink_shop.shops.find(
          shop => shop.id === shopId
        );
        if (!currentShop) throw new Error("Shop was not found.");
        const name = String(formObject(form).shop_name || "").trim();
        if (!name) throw new Error("Enter a shop name.");
        const shops = drinkShopsForSave().map(shop => shop.id === shopId
          ? { ...shop, name }
          : shop);
        await saveDrinkShop(shops);
        renameDrinkShopId = null;
        openDrinkShopMenuId = null;
        showNotice("Shop name saved.");
        renderApp();

      } else if (form.id === "drink-menu-form") {
        const menu = readDrinkMenuForm();
        await saveDrinkShop(drinkShopsWithMenu(menu));
        drinkSettlementResults.delete(activeDrinkShopId);
        showNotice("Drink menu saved.");
        renderApp();

      } else if (form.id === "drink-settlement-form") {
        const draft = readDrinkSettlementDraft(form);
        drinkSettlementDrafts.set(form.dataset.shopId, draft);
        const result = calculateDrinkSettlement(form.dataset.shopId, draft);
        drinkSettlementResults.set(form.dataset.shopId, result);
        renderApp();

      } else if (form.id === "drink-order-form") {
        if (!roleIs("Admin", "Operator")) {
          throw new Error("Only Admin or Operator can add drink orders.");
        }
        const values = formObject(form);
        const toppingIds = $$("[name='topping_ids'] option:checked", form)
          .map(option => option.value);
        const order = {
          id: state.drink_shop.next_order_id,
          person: String(values.person || "").trim(),
          shop_id: activeDrinkShopId,
          item_id: values.item_id,
          size: values.size,
          quantity: Number(values.quantity),
          topping_ids: toppingIds
        };
        const orders = [...state.drink_shop.orders, order];
        await saveDrinkShop(
          drinkShopsForSave(),
          orders,
          state.drink_shop.next_order_id + 1
        );
        drinkSettlementResults.delete(activeDrinkShopId);
        showNotice("Drink order added.");
        renderApp();

      }
    } catch (error) {
      showNotice(error.message, "error");
    }
  }
