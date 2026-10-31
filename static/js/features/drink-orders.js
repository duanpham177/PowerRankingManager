"use strict";

  function drinkMenuId() {
    return globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `menu-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function blankDrinkMenuItem(category = "drink") {
    return {
      id: drinkMenuId(),
      name: "",
      category,
      prices: { S: null, M: null, L: null }
    };
  }

  function drinkShopContent() {
    const drinkShop = state.drink_shop || { shops: [], orders: [], next_order_id: 1 };
    const shops = drinkShop.shops;
    const canManage = roleIs("Admin", "Operator");
    if (!shops.some(shop => shop.id === activeDrinkShopId)) {
      activeDrinkShopId = shops[0]?.id || null;
      drinkMenuDraft = null;
    }
    const shop = shops.find(item => item.id === activeDrinkShopId);
    if (shop && !Array.isArray(drinkMenuDraft)) {
      drinkMenuDraft = shop.menu.map(item => ({
        ...item,
        prices: { ...item.prices }
      }));
    }

    const savedDrinks = (shop?.menu || []).filter(
      item => item.category === "drink"
    );
    const savedToppings = (shop?.menu || []).filter(
      item => item.category === "topping"
    );
    const activeShopOrders = drinkShop.orders.filter(
      order => order.shop_id === activeDrinkShopId
    );
    const orderedPeople = uniqueSettlementPeople(
      activeShopOrders.map(order => String(order.person).trim()).filter(Boolean)
    );
    const shopsById = new Map(shops.map(item => [item.id, item]));
    const totalsByPerson = new Map();
    const orderRows = drinkShop.orders.map(order => {
      const orderShop = shopsById.get(order.shop_id);
      const orderMenu = new Map((orderShop?.menu || []).map(item => [item.id, item]));
      const drink = orderMenu.get(order.item_id);
      if (!drink) return "";
      const toppingItems = order.topping_ids
        .map(id => orderMenu.get(id))
        .filter(Boolean);
      const basePrice = Number(drink.prices[order.size]) || 0;
      const toppingPrice = toppingItems.reduce(
        (sum, item) => sum + (Number(item.prices.S ?? item.prices.M ?? item.prices.L) || 0),
        0
      );
      const total = (basePrice + toppingPrice) * order.quantity;
      totalsByPerson.set(
        order.person,
        (totalsByPerson.get(order.person) || 0) + total
      );

      return `
        <tr>
          <td>${escapeHtml(order.person)}</td>
          <td>${escapeHtml(orderShop.name)}</td>
          <td>${escapeHtml(drink.name)} (${order.size})</td>
          <td>${order.quantity}</td>
          <td>${toppingItems.length
            ? toppingItems.map(item => escapeHtml(item.name)).join(", ")
            : "—"}</td>
          <td>${formatDrinkMoney(total)}</td>
          <td>${canManage ? `<button type="button" class="danger"
            data-action="delete-drink-order" data-order-id="${order.id}">Remove</button>` : ""}</td>
        </tr>
      `;
    }).join("");

    return `
      ${canManage ? "" : `
        <section class="panel">
          <p class="muted">Only Admin or Operator can edit the drink menu and orders.</p>
        </section>
      `}

      <section class="panel">
        <div class="toolbar">
          <div>
            <h2>Shops</h2>
            <p class="muted small">Choose a shop to manage its menu and orders.</p>
          </div>
          ${canManage ? `
            <form id="add-drink-shop-form" class="drink-shop-add-form">
              <div class="field">
                <label for="new-drink-shop-name">New shop name</label>
                <input id="new-drink-shop-name" name="shop_name" maxlength="120" required>
              </div>
              <button type="submit" class="primary">Add shop</button>
            </form>
          ` : ""}
        </div>
        ${shops.length ? `
          <ul class="drink-shop-list">
            ${shops.map(item => `
              <li class="drink-shop-list-item ${item.id === activeDrinkShopId ? "active" : ""}">
                <button type="button" class="drink-shop-select ${item.id === activeDrinkShopId ? "active" : ""}"
                  data-action="select-drink-shop" data-shop-id="${escapeHtml(item.id)}"
                  aria-current="${item.id === activeDrinkShopId ? "true" : "false"}">
                  ${escapeHtml(item.name)}
                </button>
                ${canManage ? `
                  <button type="button" class="drink-shop-menu-toggle"
                    data-action="toggle-drink-shop-menu" data-shop-id="${escapeHtml(item.id)}"
                    aria-label="Options for ${escapeHtml(item.name)}"
                    aria-expanded="${openDrinkShopMenuId === item.id ? "true" : "false"}">⋯</button>
                  ${openDrinkShopMenuId === item.id ? `
                    <div class="drink-shop-menu">
                      <button type="button" data-action="rename-drink-shop"
                        data-shop-id="${escapeHtml(item.id)}">Rename</button>
                      <button type="button" class="danger" data-action="delete-drink-shop"
                        data-shop-id="${escapeHtml(item.id)}">Delete</button>
                    </div>
                  ` : ""}
                ` : ""}
                ${renameDrinkShopId === item.id ? `
                  <form class="drink-shop-rename-form" data-shop-id="${escapeHtml(item.id)}">
                    <input id="drink-shop-name-${escapeHtml(item.id)}" name="shop_name" maxlength="120"
                      value="${escapeHtml(item.name)}" aria-label="Shop name" required>
                    <button type="submit" class="primary">Save</button>
                    <button type="button" data-action="cancel-rename-drink-shop">Cancel</button>
                  </form>
                ` : ""}
                ${confirmDeleteShopId === item.id ? `
                  <div class="drink-shop-delete-confirm">
                    <div class="drink-shop-actions">
                      <button type="button" class="danger" data-action="confirm-delete-drink-shop"
                        data-shop-id="${escapeHtml(item.id)}"
                        title="Delete &quot;${escapeHtml(item.name)}&quot; and its menu and ${drinkShop.orders.filter(
                          order => order.shop_id === item.id
                        ).length} order(s)?">Confirm delete</button>
                      <button type="button" data-action="cancel-delete-drink-shop">Cancel</button>
                    </div>
                  </div>
                ` : ""}
              </li>
            `).join("")}
          </ul>
        ` : `<p class="muted">${canManage
          ? "Add a shop to start creating its menu."
          : "No shops have been added yet."}</p>`}
      </section>

      <section class="panel">
        <div class="toolbar">
          <div>
            <h2>Menu and prices${shop ? ` · ${escapeHtml(shop.name)}` : ""}</h2>
            <p class="muted small">Prices are entered in thousands of đồng (example: 25 = 25.000 ₫).</p>
          </div>
          ${shop && canManage ? `
            <button type="button" data-action="add-drink-menu-item">Add menu item</button>
          ` : ""}
        </div>
        ${shops.length ? `
          <form id="drink-menu-form">
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>Item</th><th>Type</th><th>S (k)</th><th>M (k)</th><th>L (k)</th><th></th></tr>
              </thead>
              <tbody>
                ${drinkMenuDraft.map(item => `
                  <tr data-menu-item-id="${escapeHtml(item.id)}">
                    <td><input name="menu-name" maxlength="120" required ${canManage ? "" : "disabled"}
                      value="${escapeHtml(item.name)}" aria-label="Menu item name"></td>
                    <td>
                      <select name="menu-category" aria-label="Menu item type" ${canManage ? "" : "disabled"}>
                        <option value="drink" ${item.category === "drink" ? "selected" : ""}>Drink</option>
                        <option value="topping" ${item.category === "topping" ? "selected" : ""}>Topping</option>
                      </select>
                    </td>
                    ${["S", "M", "L"].map(size => `
                      <td><input name="price-${size}" type="number" min="0" max="1000000" ${canManage ? "" : "disabled"}
                        step="1" value="${item.prices[size] ?? ""}" aria-label="${size} price in thousands"></td>
                    `).join("")}
                    <td>${canManage ? `<button type="button" class="danger" data-action="remove-drink-menu-item"
                      data-menu-item-id="${escapeHtml(item.id)}">Remove</button>` : ""}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
          <div class="form-actions">
            ${canManage ? `<button type="submit" class="primary">Save menu</button>` : ""}
          </div>
        </form>
        ` : `<p class="muted">Add a shop to start creating its menu.</p>`}
      </section>

      <section class="panel">
        <h2>Add an order</h2>
        ${shop && savedDrinks.length && canManage ? `
          <form id="drink-order-form">
            <div class="form-grid">
              <div class="field">
                <label for="drink-person">Person</label>
                <input id="drink-person" name="person" maxlength="120" required>
              </div>
              <div class="field">
                <label for="drink-item">Item</label>
                <select id="drink-item" name="item_id" required>
                  ${savedDrinks.map((item, index) => `
                    <option value="${escapeHtml(item.id)}" ${index === 0 ? "selected" : ""}>
                      ${escapeHtml(item.name)}
                    </option>
                  `).join("")}
                </select>
              </div>
              <div class="field">
                <label for="drink-size">Size</label>
                <select id="drink-size" name="size" required>
                  ${drinkSizeOptions(savedDrinks[0])}
                </select>
              </div>
              <div class="field">
                <label for="drink-quantity">Quantity</label>
                <input id="drink-quantity" name="quantity" type="number"
                  min="1" max="100" step="1" value="1" required>
              </div>
            </div>
            ${savedToppings.length ? `
              <div class="field" style="margin-top:12px">
                <label for="drink-toppings">Toppings / add-ons (hold Ctrl to select multiple)</label>
                <select id="drink-toppings" name="topping_ids" multiple size="${Math.min(toppings.length, 6)}">
                  ${savedToppings.map(item => `
                    <option value="${escapeHtml(item.id)}">
                      ${escapeHtml(item.name)} (+${formatDrinkMoney(Number(item.prices.S ?? item.prices.M ?? item.prices.L) || 0)})
                    </option>
                  `).join("")}
                </select>
              </div>
            ` : ""}
            <div class="form-actions">
              <button type="submit" class="primary">Add order item</button>
            </div>
          </form>
        ` : `<p class="muted">${canManage
          ? "Select a shop and save at least one drink in its menu before recording orders."
          : "Order entry is available to Admin and Operator roles."}</p>`}
      </section>

      <section class="panel">
        <div class="toolbar">
          <h2>Orders and totals</h2>
          <strong>${formatDrinkMoney([...totalsByPerson.values()].reduce((sum, total) => sum + total, 0))}</strong>
        </div>
        ${totalsByPerson.size ? `
          <div class="table-wrap" style="margin-top:14px">
            <table>
              <thead><tr><th>Person</th><th>Shop</th><th>Drink</th><th>Qty</th><th>Toppings</th><th>Total</th><th></th></tr></thead>
              <tbody>${orderRows}</tbody>
            </table>
          </div>
        ` : `<p class="muted">No orders have been added yet.</p>`}
      </section>

      <section class="panel">
        <h2>Bill settlement${shop ? ` · ${escapeHtml(shop.name)}` : ""}</h2>
        ${shop && activeShopOrders.length ? `
          ${drinkSettlementForm(
            shop.id,
            orderedPeople
          )}
          ${drinkSettlementResult(drinkSettlementResults.get(shop.id))}
        ` : `<p class="muted">${shop
          ? "Add at least one order for this shop before calculating the bill."
          : "Select a shop to calculate its bill."}</p>`}
      </section>
    `;
  }

  function drinkSizeOptions(item, selectedSize = "") {
    return ["S", "M", "L"]
      .filter(size => item.prices[size] !== null && item.prices[size] !== undefined)
      .map((size, index) => `
        <option value="${size}" ${size === selectedSize || (!selectedSize && index === 0) ? "selected" : ""}>
          ${size} — ${formatDrinkMoney(item.prices[size])}
        </option>
      `).join("");
  }

  function formatDrinkMoney(thousands) {
    return `${(Number(thousands) * 1000).toLocaleString("vi-VN")} ₫`;
  }

  function formatVnd(amount) {
    return `${Math.round(Number(amount)).toLocaleString("vi-VN")} ₫`;
  }

  function drinkSettlementDraft(shopId) {
    if (!drinkSettlementDrafts.has(shopId)) {
      drinkSettlementDrafts.set(shopId, {
        teamCount: 2,
        fee: "0",
        discount: "0",
        standalonePeople: "",
        standaloneOrderedPeople: [],
        teams: [
          { percentage: "50", orderedMembers: [], extraMembers: "" },
          { percentage: "50", orderedMembers: [], extraMembers: "" },
          { percentage: "0", orderedMembers: [], extraMembers: "" },
          { percentage: "0", orderedMembers: [], extraMembers: "" }
        ]
      });
    }
    return drinkSettlementDrafts.get(shopId);
  }

  function drinkSettlementForm(shopId, orderedPeople) {
    const draft = drinkSettlementDraft(shopId);
    const assignedPeople = new Map();
    draft.teams.slice(0, Number(draft.teamCount)).forEach((team, index) => {
      team.orderedMembers.forEach(name => {
        assignedPeople.set(settlementPersonKey(name), `team-${index}`);
      });
    });
    draft.standaloneOrderedPeople.forEach(name => {
      assignedPeople.set(settlementPersonKey(name), "standalone");
    });
    const availablePeople = orderedPeople.filter(
      name => !assignedPeople.has(settlementPersonKey(name))
    );
    const assignedPeopleList = (names, assignment) => names.length
      ? names.map(name => `
        <div class="drink-settlement-assigned-person"
          data-settlement-assignment="${escapeHtml(assignment)}"
          data-person="${escapeHtml(name)}">
          <span>${escapeHtml(name)}</span>
          <button type="button" data-action="remove-settlement-person"
            data-settlement-assignment="${escapeHtml(assignment)}"
            data-person="${escapeHtml(name)}" aria-label="Remove ${escapeHtml(name)}">×</button>
        </div>
      `).join("")
      : `<span class="muted small">No people assigned yet.</span>`;
    const assignmentPicker = assignment => {
      const isOpen = openSettlementPicker === assignment;
      return `
        <div class="drink-settlement-picker${isOpen ? " is-open" : ""}">
          <button type="button" class="drink-settlement-picker-toggle"
            data-action="toggle-settlement-picker"
            data-settlement-assignment="${escapeHtml(assignment)}"
            aria-haspopup="true" aria-expanded="${isOpen}">
            Select
          </button>
          <div class="drink-settlement-picker-options">
            ${availablePeople.length ? availablePeople.map(name => `
              <button type="button" data-action="add-settlement-person"
                data-settlement-assignment="${escapeHtml(assignment)}"
                data-person="${escapeHtml(name)}">${escapeHtml(name)}</button>
            `).join("") : `<span class="muted small">No people available.</span>`}
          </div>
        </div>
      `;
    };

    return `
      <form id="drink-settlement-form" data-shop-id="${escapeHtml(shopId)}">
        <p class="muted small">
          Product prices, additional fees, and discounts are entered in thousands of đồng
          (for example, 25 = 25.000 ₫).
          The final bill is allocated proportionally to original product totals. Each team gets its percentage
          of the team pool; its allocated product costs are deducted before the remaining amount is split among members.
          Add team members who did not order in the separate fields.
        </p>
        <div class="form-grid">
          <div class="field">
            <label for="settlement-team-count">Number of teams</label>
            <select id="settlement-team-count" name="team_count">
              ${[1, 2, 3, 4].map(count => `
                <option value="${count}" ${draft.teamCount === count ? "selected" : ""}>${count} teams</option>
              `).join("")}
            </select>
          </div>
          <div class="field">
            <label for="settlement-fee">Additional fees (thousands of ₫)</label>
            <input id="settlement-fee" name="fee" type="number" min="0" step="1"
              value="${escapeHtml(draft.fee)}" required>
          </div>
          <div class="field">
            <label for="settlement-discount">Discount (thousands of ₫)</label>
            <input id="settlement-discount" name="discount" type="number" min="0" step="1"
              value="${escapeHtml(draft.discount)}" required>
          </div>
        </div>
        <div class="drink-settlement-teams">
          ${draft.teams.map((team, index) => `
            <fieldset class="drink-settlement-team" data-team-index="${index}"
              ${index >= draft.teamCount ? "hidden disabled" : ""}>
              <legend>Team ${index + 1}</legend>
              <div class="form-grid">
                <div class="field">
                  <label for="settlement-team-percentage-${index}">Share of D (%)</label>
                  <input id="settlement-team-percentage-${index}" name="team_percentage_${index}"
                    type="number" min="0" max="100" step="0.01"
                    value="${escapeHtml(team.percentage)}" required>
                </div>
                <div class="field">
                  <label>People with orders</label>
                  ${assignmentPicker(`team-${index}`)}
                  <div class="drink-settlement-assigned-list">
                    ${assignedPeopleList(team.orderedMembers, `team-${index}`)}
                  </div>
                  <label for="settlement-team-extra-${index}">Additional members who did not order</label>
                  <textarea id="settlement-team-extra-${index}" name="team_extra_members_${index}"
                    rows="2">${escapeHtml(team.extraMembers)}</textarea>
                </div>
              </div>
            </fieldset>
          `).join("")}
        </div>
        <div class="field">
          <label>People ordering separately</label>
          ${assignmentPicker("standalone")}
          <div class="drink-settlement-assigned-list">
            ${assignedPeopleList(draft.standaloneOrderedPeople, "standalone")}
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="primary">Calculate bill</button>
        </div>
      </form>
    `;
  }

  function drinkSettlementResult(result) {
    if (!result) {
      return `<div id="drink-settlement-result"></div>`;
    }
    return `
      <div class="drink-settlement-result" id="drink-settlement-result">
        <div>
          <div class="toolbar">
            <h3>Consolidated final bill · ${escapeHtml(result.shopName)}</h3>
            <button type="button" data-action="preview-drink-bill"
              data-shop-id="${escapeHtml(result.shopId)}">Preview bill</button>
          </div>
          <p class="drink-settlement-final-total">
            Total after fees and discount: <strong>${formatVnd(result.finalBill)}</strong>
          </p>
          <div class="table-wrap">
          <table class="drink-settlement-breakdown">
            <thead>
              <tr><th>Group</th><th>Person</th><th>Shop</th><th>Products</th><th>Qty</th>
                <th>Original products</th><th>Allocated products</th><th>Equal share</th>
                <th>Calculated bill</th><th>Payable (rounded to 1,000 ₫)</th></tr>
            </thead>
            <tbody>
              ${result.privatePeople.map(person => `
                <tr>
                  <td>Individual order</td>
                  <td>${escapeHtml(person.name)}</td>
                  <td>${person.quantity ? escapeHtml(result.shopName) : "—"}</td>
                  <td>${person.products.map(product => escapeHtml(product)).join("<br>")}</td>
                  <td>${person.quantity}</td>
                  <td>${formatVnd(person.originalTotal)}</td>
                  <td>${formatVnd(person.productCost)}</td>
                  <td>${formatVnd(0)}</td>
                  <td>${formatVnd(person.total)}</td>
                  <td>${formatVnd(person.roundedTotal)}</td>
                </tr>
              `).join("")}
              ${result.teams.map(team => team.people.map(person => `
                <tr>
                  <td>Team ${team.index + 1}</td>
                  <td>${escapeHtml(person.name)}</td>
                  <td>${person.quantity ? escapeHtml(result.shopName) : "—"}</td>
                  <td>${person.products.map(product => escapeHtml(product)).join("<br>")}</td>
                  <td>${person.quantity}</td>
                  <td>${formatVnd(person.originalTotal)}</td>
                  <td>${formatVnd(person.productCost)}</td>
                  <td>${formatVnd(person.sharedCost)}</td>
                  <td>${formatVnd(person.total)}</td>
                  <td>${formatVnd(person.roundedTotal)}</td>
                </tr>
              `).join("")).join("")}
            </tbody>
            <tfoot>
              <tr><th colspan="8">Totals before rounding</th><th>${formatVnd(result.settledTotal)}</th><th></th></tr>
              <tr><th colspan="9">Total payable after individual rounding</th><th>${formatVnd(result.roundedTotal)}</th></tr>
            </tfoot>
          </table>
          </div>
          <p class="muted small">
            Each person's product allocation is proportional to the final bill. Team remaining costs are shared
            equally by all members, including members without orders. Individual payable amounts are then rounded
            to the nearest 1,000 ₫ (half up), so their sum may differ from the calculated bill.
          </p>
        </div>
        <div class="section-grid">
          ${result.teams.map(team => `
            <div class="team-box">
              <h3>Team ${team.index + 1} · ${team.percentage.toFixed(2)}%</h3>
              <p><strong>Calculated budget before rounding · ${formatVnd(team.budget)}</strong></p>
              <div class="drink-settlement-people">
                ${team.people.map(person => `
                  <div><span>${escapeHtml(person.name)}</span><strong>${formatVnd(person.roundedTotal)}</strong></div>
                `).join("")}
              </div>
              <p class="muted small">
                Allocated products: ${formatVnd(team.productTotal)} · Remaining shared equally:
                ${formatVnd(team.sharedCost)}
              </p>
            </div>
          `).join("")}
        </div>
        <details>
          <summary>Calculation and rounding details</summary>
          <p>Original bill: ${formatVnd(result.productTotal)} · Additional fee: ${formatVnd(result.fee)}
            · Discount: ${formatVnd(result.discount)} · Final bill: ${formatVnd(result.finalBill)}</p>
          <p>Allocation ratio: ${result.finalBill} / ${result.productTotal} =
            ${result.allocationRatio.toFixed(8)} · Individual orders total: ${formatVnd(result.privateTotal)}
            · Team pool: ${formatVnd(result.teamPool)}</p>
          <p>Individual-order rounding adjustment: ${formatVnd(result.privateRoundingAdjustment)}</p>
          <p>Individual payable rounding difference: ${formatVnd(result.roundingAdjustment)}
            · Total payable after rounding: ${formatVnd(result.roundedTotal)}</p>
          ${result.teams.map(team => `
            <p>Team ${team.index + 1}: ${team.percentage.toFixed(2)}% · Budget ${formatVnd(team.budget)}
              · Product costs ${formatVnd(team.productTotal)} · Remaining ${formatVnd(team.sharedCost)}
              · Budget rounding adjustment ${formatVnd(team.budgetRoundingAdjustment)}
              · Product rounding adjustment ${formatVnd(team.productRoundingAdjustment)}
              · Member-share remainder ${formatVnd(team.memberShareRemainder)}</p>
          `).join("")}
        </details>
      </div>
    `;
  }

  function readDrinkSettlementDraft(form) {
    const teamCount = Number(form.elements.team_count.value);
    return {
      teamCount,
      fee: form.elements.fee.value,
      discount: form.elements.discount.value,
      standalonePeople: "",
      standaloneOrderedPeople: $$(
        ".drink-settlement-assigned-person[data-settlement-assignment='standalone'][data-person]",
        form
      ).map(person => person.dataset.person),
      teams: Array.from({ length: 4 }, (_, index) => ({
        percentage: form.elements[`team_percentage_${index}`].value,
        orderedMembers: $$(
          `.drink-settlement-assigned-person[data-settlement-assignment='team-${index}'][data-person]`,
          form
        ).map(person => person.dataset.person),
        extraMembers: form.elements[`team_extra_members_${index}`].value
      }))
    };
  }

  function addDrinkSettlementPerson(button) {
    const form = button.closest("#drink-settlement-form");
    const person = button.dataset.person;
    if (!form || !person) return;
    const draft = readDrinkSettlementDraft(form);
    const assignment = button.dataset.settlementAssignment;
    if (assignment === "standalone") {
      draft.standaloneOrderedPeople.push(person);
    } else {
      const teamIndex = Number(assignment.slice("team-".length));
      draft.teams[teamIndex].orderedMembers.push(person);
    }
    drinkSettlementDrafts.set(form.dataset.shopId, draft);
    drinkSettlementResults.delete(form.dataset.shopId);
    renderApp();
  }

  function removeDrinkSettlementPerson(button) {
    const form = button.closest("#drink-settlement-form");
    if (!form) return;
    const draft = readDrinkSettlementDraft(form);
    const personKey = settlementPersonKey(button.dataset.person);
    const assignment = button.dataset.settlementAssignment;
    if (assignment === "standalone") {
      draft.standaloneOrderedPeople = draft.standaloneOrderedPeople.filter(
        name => settlementPersonKey(name) !== personKey
      );
    } else {
      const teamIndex = Number(assignment.slice("team-".length));
      draft.teams[teamIndex].orderedMembers = draft.teams[teamIndex].orderedMembers.filter(
        name => settlementPersonKey(name) !== personKey
      );
    }
    drinkSettlementDrafts.set(form.dataset.shopId, draft);
    drinkSettlementResults.delete(form.dataset.shopId);
    renderApp();
  }

  function rememberDrinkSettlementDraft(form) {
    if (!(form instanceof HTMLFormElement) || form.id !== "drink-settlement-form") return;
    drinkSettlementDrafts.set(form.dataset.shopId, readDrinkSettlementDraft(form));
  }

  function updateDrinkSettlementTeamFields(form) {
    const teamCount = Number(form.elements.team_count.value);
    $$(".drink-settlement-team", form).forEach(fieldset => {
      const active = Number(fieldset.dataset.teamIndex) < teamCount;
      fieldset.hidden = !active;
      fieldset.disabled = !active;
    });
    rememberDrinkSettlementDraft(form);
  }

  function calculateDrinkSettlement(shopId, draft) {
    const drinkShop = state.drink_shop;
    const shop = drinkShop.shops.find(item => item.id === shopId);
    if (!shop) throw new Error("Shop was not found.");
    if (![1, 2, 3, 4].includes(Number(draft.teamCount))) {
      throw new Error("The number of teams must be between 1 and 4.");
    }
    const orderLines = drinkShop.orders
      .filter(order => order.shop_id === shopId)
      .map(order => {
        const quantity = Number(order.quantity);
        if (!Number.isSafeInteger(quantity) || quantity < 1) {
          throw new Error(`The order quantity for ${order.person} must be a positive whole number.`);
        }
        const menu = new Map(shop.menu.map(item => [item.id, item]));
        const drink = menu.get(order.item_id);
        if (!drink) throw new Error(`Menu item for ${order.person} was not found.`);
        const toppings = order.topping_ids.map(id => {
          const item = menu.get(id);
          if (!item) throw new Error(`A topping for ${order.person} was not found.`);
          return item;
        });
        const drinkPrice = drink.prices[order.size];
        const toppingPrices = toppings.map(item => item.prices.S ?? item.prices.M ?? item.prices.L);
        if (![drinkPrice, ...toppingPrices].every(price => (
          Number.isSafeInteger(price) && price >= 0
        ))) {
          throw new Error(`The product price for ${order.person} must be a non-negative whole number.`);
        }
        const unitPrice = drinkPrice + toppingPrices.reduce((sum, price) => sum + price, 0);
        if (!Number.isSafeInteger(unitPrice)) {
          throw new Error(`The product price for ${order.person} is too large to calculate safely.`);
        }
        const amountBigInt = BigInt(unitPrice) * BigInt(quantity) * 1000n;
        if (amountBigInt > BigInt(Number.MAX_SAFE_INTEGER)) {
          throw new Error(`The order total for ${order.person} is too large to calculate safely.`);
        }
        const amount = Number(amountBigInt);
        const person = String(order.person).trim();
        if (!person) throw new Error("Every order must have a person's name.");
        return {
          person,
          product: `${drink.name} (${order.size})${toppings.length
            ? ` + ${toppings.map(item => item.name).join(", ")}`
            : ""}`,
          quantity,
          amount
        };
      });
    const productTotal = orderLines.reduce((sum, line) => sum + line.amount, 0);
    if (!Number.isSafeInteger(productTotal)) {
      throw new Error("Product total is too large to calculate safely.");
    }
    if (productTotal <= 0) {
      throw new Error("The original product total must be greater than zero for proportional allocation.");
    }
    const feeInput = Number(draft.fee);
    const discountInput = Number(draft.discount);
    if (!Number.isSafeInteger(feeInput) || feeInput < 0
      || !Number.isSafeInteger(feeInput * 1000)) {
      throw new Error("Additional fees must be a non-negative whole number of thousands of đồng.");
    }
    if (!Number.isSafeInteger(discountInput) || discountInput < 0
      || !Number.isSafeInteger(discountInput * 1000)) {
      throw new Error("Discount must be a non-negative whole number of thousands of đồng.");
    }
    const fee = feeInput * 1000;
    const discount = discountInput * 1000;
    const totalWithFees = productTotal + fee;
    if (!Number.isSafeInteger(totalWithFees)) {
      throw new Error("Total with fees is too large to calculate safely.");
    }
    if (discount > totalWithFees) {
      throw new Error("Discount cannot be greater than B (total with fees).");
    }
    const teamCount = Number(draft.teamCount);
    const teams = draft.teams.slice(0, teamCount).map((team, index) => {
      const percentage = Number(team.percentage);
      const percentagePoints = Math.round(percentage * 100);
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100
        || !Number.isSafeInteger(percentagePoints) || percentagePoints !== percentage * 100) {
        throw new Error(`Team ${index + 1} percentage must be from 0 to 100 with at most 2 decimal places.`);
      }
      const members = [...team.orderedMembers, ...splitSettlementNames(team.extraMembers)];
      if (!members.length && percentage > 0) {
        throw new Error(`Enter at least one member for Team ${index + 1} with a non-zero percentage.`);
      }
      return { index, percentage, percentagePoints, members };
    });
    if (teams.reduce((sum, team) => sum + team.percentagePoints, 0) !== 10000) {
      throw new Error("Team percentages must total exactly 100%.");
    }

    const standaloneNames = [
      ...draft.standaloneOrderedPeople,
      ...splitSettlementNames(draft.standalonePeople)
    ];
    const assignedPeople = new Map();
    const registerPerson = (name, assignment) => {
      const key = name.toLocaleLowerCase("vi");
      if (assignedPeople.has(key)) {
        throw new Error(`${name} is listed more than once in the settlement setup.`);
      }
      assignedPeople.set(key, { name, assignment });
    };
    teams.forEach(team => team.members.forEach(name => registerPerson(name, team.index)));
    standaloneNames.forEach(name => registerPerson(name, "standalone"));

    const orderedPeople = new Map();
    orderLines.forEach(line => {
      const key = line.person.toLocaleLowerCase("vi");
      const entry = orderedPeople.get(key) || {
        name: line.person,
        amount: 0,
        quantity: 0,
        products: []
      };
      entry.amount += line.amount;
      entry.quantity += line.quantity;
      entry.products.push(line.product);
      orderedPeople.set(key, entry);
    });
    for (const person of orderedPeople.values()) {
      if (!assignedPeople.has(person.name.toLocaleLowerCase("vi"))) {
        throw new Error(`Assign ${person.name} to a team or to separate orders.`);
      }
    }
    for (const name of standaloneNames) {
      const person = orderedPeople.get(name.toLocaleLowerCase("vi"));
      if (!person) throw new Error(`${name} has no order to pay separately.`);
    }

    const finalBill = totalWithFees - discount;
    const allocationRatio = finalBill / productTotal;
    const privateOriginalTotals = standaloneNames.map(name => (
      orderedPeople.get(name.toLocaleLowerCase("vi"))?.amount || 0
    ));
    const privateOriginalTotal = privateOriginalTotals.reduce((sum, amount) => sum + amount, 0);
    const privateTotal = roundDrinkRatio(privateOriginalTotal, finalBill, productTotal);
    const privateBills = allocateDrinkRatioAmounts(
      privateOriginalTotals,
      finalBill,
      productTotal,
      privateTotal
    );
    const privatePeople = standaloneNames.map((name, index) => {
      const person = orderedPeople.get(name.toLocaleLowerCase("vi"));
      return {
        name,
        quantity: person.quantity,
        products: person.products,
        originalTotal: person.amount,
        productCost: privateBills[index],
        total: privateBills[index],
        roundedTotal: roundDrinkBillToThousands(privateBills[index])
      };
    });
    const teamPool = finalBill - privateTotal;
    const teamBudgets = allocateDrinkAmount(
      teamPool,
      teams.map(team => team.percentagePoints)
    );
    const teamBudgetAdjustments = teams.map((team, index) => (
      teamBudgets[index] - floorDrinkRatio(teamPool, team.percentagePoints, 10000)
    ));
    const settledTeams = teams.map((team, index) => {
      const teamLines = orderLines.filter(line => (
        assignedPeople.get(line.person.toLocaleLowerCase("vi"))?.assignment === team.index
      ));
      const originalTeamProductTotal = teamLines.reduce((sum, line) => sum + line.amount, 0);
      const teamProductTotal = roundDrinkRatio(
        originalTeamProductTotal,
        teamBudgets[index],
        productTotal
      );
      const allocatedProducts = allocateDrinkRatioAmounts(
        teamLines.map(line => line.amount),
        teamBudgets[index],
        productTotal,
        teamProductTotal
      );
      const memberProductTotals = new Map();
      teamLines.forEach((line, lineIndex) => {
        const key = line.person.toLocaleLowerCase("vi");
        memberProductTotals.set(key, (memberProductTotals.get(key) || 0) + allocatedProducts[lineIndex]);
      });
      const sharedCost = teamBudgets[index] - teamProductTotal;
      const memberShares = allocateDrinkAmount(sharedCost, team.members.map(() => 1));
      const orderPeople = new Map(teamLines.reduce((entries, line) => {
        const key = line.person.toLocaleLowerCase("vi");
        const person = entries.get(key) || {
          name: line.person,
          originalTotal: 0,
          quantity: 0,
          products: []
        };
        person.originalTotal += line.amount;
        person.quantity += line.quantity;
        person.products.push(line.product);
        entries.set(key, person);
        return entries;
      }, new Map()));
      const people = team.members.map((name, memberIndex) => {
        const key = name.toLocaleLowerCase("vi");
        const orderedPerson = orderPeople.get(key);
        const productCost = memberProductTotals.get(key) || 0;
        const memberShare = memberShares[memberIndex];
        return {
          name,
          originalTotal: orderedPerson?.originalTotal || 0,
          quantity: orderedPerson?.quantity || 0,
          products: orderedPerson?.products || [],
          productCost,
          sharedCost: memberShare,
          total: productCost + memberShare,
          roundedTotal: roundDrinkBillToThousands(productCost + memberShare)
        };
      });
      const memberTotal = people.reduce((sum, person) => sum + person.total, 0);
      if (memberTotal !== teamBudgets[index]) {
        throw new Error(`Team ${index + 1} allocations do not reconcile to its budget.`);
      }
      return {
        index,
        percentage: team.percentage,
        budget: teamBudgets[index],
        productTotal: teamProductTotal,
        sharedCost,
        budgetRoundingAdjustment: teamBudgetAdjustments[index],
        productRoundingAdjustment: teamProductTotal
          - floorDrinkRatio(originalTeamProductTotal, teamBudgets[index], productTotal),
        memberShareRemainder: sharedCost % (team.members.length || 1),
        people
      };
    });
    const settledTotal = privatePeople.reduce((sum, person) => sum + person.total, 0)
      + settledTeams.reduce(
        (sum, team) => sum + team.people.reduce((memberSum, person) => memberSum + person.total, 0),
        0
      );
    if (settledTotal !== finalBill) {
      throw new Error("The consolidated person totals do not reconcile to the final bill.");
    }
    const roundedTotal = privatePeople.reduce((sum, person) => sum + person.roundedTotal, 0)
      + settledTeams.reduce(
        (sum, team) => sum + team.people.reduce(
          (memberSum, person) => memberSum + person.roundedTotal,
          0
        ),
        0
      );
    if (!Number.isSafeInteger(roundedTotal)) {
      throw new Error("Total payable after rounding is too large to calculate safely.");
    }

    return {
      shopId,
      shopName: shop.name,
      productTotal,
      fee,
      totalWithFees,
      discount,
      finalBill,
      allocationRatio,
      privateTotal,
      privateRoundingAdjustment: privateTotal
        - floorDrinkRatio(privateOriginalTotal, finalBill, productTotal),
      teamPool,
      settledTotal,
      roundedTotal,
      roundingAdjustment: roundedTotal - finalBill,
      privatePeople,
      teams: settledTeams
    };
  }

  function buildDrinkBillPreviewMarkdown(result, prefix = "") {
    const sections = [];
    let personNumber = 0;
    const personLine = person => {
      personNumber += 1;
      const identifier = prefix
        ? `${escapeDrinkBillMarkdown(prefix)}${personNumber} - `
        : "";
      return `+ ${identifier}${escapeDrinkBillMarkdown(person.name)} - ${formatVnd(person.roundedTotal)}`;
    };
    if (result.privatePeople.length) {
      sections.push([
        "## Individual orders",
        ...result.privatePeople.map(personLine)
      ].join("\n"));
    }
    result.teams.forEach(team => {
      sections.push([
        `## Team ${team.index + 1}`,
        ...team.people.map(personLine)
      ].join("\n"));
    });
    return sections.join("\n\n");
  }

  function escapeDrinkBillMarkdown(value) {
    return String(value)
      .replace(/\\/g, "\\\\")
      .replace(/([`*_{}\[\]()#+.!|>])/g, "\\$1")
      .replace(/[\r\n]+/g, " ");
  }

  function openDrinkBillPreview(shopId) {
    const result = drinkSettlementResults.get(shopId);
    if (!result) throw new Error("Calculate the bill before opening its preview.");
    const existingPreview = $("#drink-bill-preview-dialog");
    if (existingPreview) existingPreview.remove();
    document.body.insertAdjacentHTML("beforeend", `
      <dialog class="drink-bill-preview-dialog" id="drink-bill-preview-dialog"
        aria-labelledby="drink-bill-preview-title">
        <div class="drink-bill-preview-content">
          <div class="toolbar">
            <h2 id="drink-bill-preview-title">Bill preview · ${escapeHtml(result.shopName)}</h2>
            <button type="button" data-action="close-drink-bill-preview"
              aria-label="Close bill preview">×</button>
          </div>
          <div class="field">
            <label for="drink-bill-preview-prefix">Person prefix (optional)</label>
            <input id="drink-bill-preview-prefix" type="text" maxlength="40"
              placeholder="Yyy" autocomplete="off">
          </div>
          <div class="export-preview" id="drink-bill-markdown-preview">
            ${renderRankingMarkdown(buildDrinkBillPreviewMarkdown(result, ""))}
          </div>
          <div class="drink-bill-preview-actions">
            <button type="button" data-action="copy-drink-bill-preview"
              data-shop-id="${escapeHtml(shopId)}">Copy Markdown</button>
          </div>
          <p class="drink-bill-preview-copy-status" id="drink-bill-preview-copy-status"
            role="status" aria-live="polite"></p>
        </div>
      </dialog>
    `);
    $("#drink-bill-preview-dialog").showModal();
  }

  function updateDrinkBillPreview() {
    const result = drinkSettlementResults.get(
      $("[data-action='copy-drink-bill-preview']")?.dataset.shopId
    );
    const preview = $("#drink-bill-markdown-preview");
    if (!result || !preview) return;
    const prefix = $("#drink-bill-preview-prefix").value;
    preview.innerHTML = renderRankingMarkdown(
      buildDrinkBillPreviewMarkdown(result, prefix)
    );
  }

  async function copyDrinkBillPreview(button) {
    const status = $("#drink-bill-preview-copy-status");
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard access is unavailable in this browser.");
      }
      const result = drinkSettlementResults.get(button.dataset.shopId);
      if (!result) throw new Error("The calculated bill is no longer available.");
      const prefix = $("#drink-bill-preview-prefix")?.value || "";
      await navigator.clipboard.writeText(buildDrinkBillPreviewMarkdown(result, prefix));
      status.textContent = "Markdown copied.";
    } catch (error) {
      status.textContent = `Copy failed: ${error.message} Select the preview text and copy it manually.`;
    }
  }

  function closeDrinkBillPreview() {
    $("#drink-bill-preview-dialog")?.close();
    $("#drink-bill-preview-dialog")?.remove();
  }

  function roundDrinkBillToThousands(amount) {
    const rounded = (BigInt(amount) + 500n) / 1000n * 1000n;
    if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("A person's rounded bill is too large to calculate safely.");
    }
    return Number(rounded);
  }

  function roundDrinkRatio(amount, numerator, denominator) {
    const divisor = BigInt(denominator);
    if (divisor <= 0n) throw new Error("Proportional allocation requires a positive original bill.");
    const product = BigInt(amount) * BigInt(numerator);
    return Number((product * 2n + divisor) / (divisor * 2n));
  }

  function floorDrinkRatio(amount, numerator, denominator) {
    const divisor = BigInt(denominator);
    if (divisor <= 0n) throw new Error("Proportional allocation requires a positive original bill.");
    return Number(BigInt(amount) * BigInt(numerator) / divisor);
  }

  function allocateDrinkRatioAmounts(amounts, numerator, denominator, target) {
    const divisor = BigInt(denominator);
    if (divisor <= 0n) throw new Error("Proportional allocation requires a positive original bill.");
    const numeratorValue = BigInt(numerator);
    const portions = amounts.map(amount => BigInt(amount) * numeratorValue);
    const allocations = portions.map(portion => portion / divisor);
    let remaining = BigInt(target) - allocations.reduce((sum, amount) => sum + amount, 0n);
    const remainderOrder = portions
      .map((portion, index) => ({ index, remainder: portion % divisor }))
      .sort((left, right) => left.remainder > right.remainder ? -1
        : left.remainder < right.remainder ? 1
          : left.index - right.index);
    if (remaining < 0n || remaining > BigInt(amounts.length)) {
      throw new Error("Proportional allocation rounding could not be reconciled.");
    }
    for (let index = 0; index < Number(remaining); index += 1) {
      allocations[remainderOrder[index].index] += 1n;
    }
    return allocations.map(Number);
  }

  function splitSettlementNames(value) {
    const names = String(value || "")
      .split(/[\n,]+/)
      .map(name => name.trim())
      .filter(Boolean);
    const seen = new Set();
    for (const name of names) {
      const key = name.toLocaleLowerCase("vi");
      if (seen.has(key)) throw new Error(`${name} appears more than once in the same list.`);
      seen.add(key);
    }
    return names;
  }

  function settlementPersonKey(name) {
    return String(name).trim().toLocaleLowerCase("vi");
  }

  function uniqueSettlementPeople(names) {
    const people = new Map();
    names.forEach(name => {
      const trimmed = String(name).trim();
      const key = settlementPersonKey(trimmed);
      if (key && !people.has(key)) people.set(key, trimmed);
    });
    return [...people.values()];
  }

  function allocateDrinkAmount(total, weights) {
    const totalAmount = BigInt(total);
    const integerWeights = weights.map(weight => BigInt(weight));
    const weightTotal = integerWeights.reduce((sum, weight) => sum + weight, 0n);
    if (totalAmount === 0n || weightTotal === 0n) return weights.map(() => 0);
    const portions = integerWeights.map(weight => totalAmount * weight);
    const allocations = portions.map(portion => portion / weightTotal);
    let remaining = totalAmount - allocations.reduce((sum, amount) => sum + amount, 0n);
    const remainderOrder = weights
      .map((weight, index) => ({
        index,
        remainder: portions[index] % weightTotal
      }))
      .sort((left, right) => left.remainder > right.remainder ? -1
        : left.remainder < right.remainder ? 1
          : left.index - right.index);
    for (let index = 0; index < Number(remaining); index += 1) {
      allocations[remainderOrder[index].index] += 1n;
    }
    return allocations.map(Number);
  }

  function readDrinkMenuForm() {
    return $$("tr[data-menu-item-id]", $("#drink-menu-form")).map(row => {
      const prices = {};
      for (const size of ["S", "M", "L"]) {
        const value = $(`[name="price-${size}"]`, row).value.trim();
        prices[size] = value === "" ? null : Number(value);
      }
      return {
        id: row.dataset.menuItemId,
        name: $("[name='menu-name']", row).value.trim(),
        category: $("[name='menu-category']", row).value,
        prices
      };
    });
  }

  async function saveDrinkShop(
    shops = state.drink_shop.shops,
    orders = state.drink_shop.orders,
    nextOrderId = state.drink_shop.next_order_id
  ) {
    const saved = await request("/drink-shop", {
      method: "POST",
      body: {
        shops,
        orders,
        next_order_id: nextOrderId
      }
    });
    state.drink_shop = saved.drink_shop;
    const activeShop = state.drink_shop.shops.find(
      shop => shop.id === activeDrinkShopId
    );
    drinkMenuDraft = activeShop ? activeShop.menu.map(item => ({
      ...item,
      prices: { ...item.prices }
    })) : null;
  }

  function drinkShopsWithMenu(menu) {
    return state.drink_shop.shops.map(shop => shop.id === activeDrinkShopId
      ? { ...shop, menu }
      : shop);
  }

  function drinkShopsForSave() {
    return $("#drink-menu-form")
      ? drinkShopsWithMenu(readDrinkMenuForm())
      : state.drink_shop.shops;
  }
