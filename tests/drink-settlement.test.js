"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const featureSource = readFileSync(
  path.join(__dirname, "..", "static", "js", "features", "drink-orders.js"),
  "utf8"
);

function calculate({
  rows,
  teams,
  privatePeople = [],
  fee = 0,
  discount = 0,
  shopId = "shop"
}) {
  const shops = new Map();
  const orders = rows.map((row, index) => {
    const rowShopId = row.shopId || shopId;
    if (!shops.has(rowShopId)) {
      shops.set(rowShopId, {
        id: rowShopId,
        name: rowShopId === "shop" ? "Atto" : rowShopId,
        menu: []
      });
    }
    const itemId = `item-${index}`;
    shops.get(rowShopId).menu.push({
      id: itemId,
      name: row.product || `Item ${index}`,
      category: "drink",
      prices: { S: row.price, M: null, L: null }
    });
    return {
      id: index,
      person: row.person,
      shop_id: rowShopId,
      item_id: itemId,
      size: "S",
      quantity: row.quantity === undefined ? 1 : row.quantity,
      topping_ids: []
    };
  });
  const orderedPeople = new Set(
    orders
      .filter(order => order.shop_id === shopId)
      .map(order => order.person.toLocaleLowerCase("vi"))
  );
  const draftTeams = Array.from({ length: 4 }, (_, index) => {
    const team = teams[index] || { percentage: 0, members: [] };
    const orderedMembers = team.members.filter(name => (
      orderedPeople.has(name.toLocaleLowerCase("vi"))
    ));
    const otherMembers = team.members.filter(name => (
      !orderedPeople.has(name.toLocaleLowerCase("vi"))
    ));
    return {
      percentage: String(team.percentage),
      orderedMembers,
      extraMembers: otherMembers.join("\n")
    };
  });
  const draft = {
    teamCount: teams.length,
    fee: String(fee),
    discount: String(discount),
    standalonePeople: "",
    standaloneOrderedPeople: privatePeople,
    teams: draftTeams
  };
  const context = vm.createContext({
    state: {
      drink_shop: {
        shops: [...shops.values()],
        orders
      }
    },
    draft
  });
  vm.runInContext(featureSource, context);
  return vm.runInContext(`calculateDrinkSettlement(${JSON.stringify(shopId)}, draft)`, context);
}

function assertReconciles(result) {
  const privateTotal = result.privatePeople.reduce((sum, person) => sum + person.total, 0);
  const roundedTotal = result.privatePeople.reduce(
    (sum, person) => sum + person.roundedTotal,
    0
  ) + result.teams.reduce(
    (sum, team) => sum + team.people.reduce(
      (teamSum, person) => teamSum + person.roundedTotal,
      0
    ),
    0
  );
  assert.equal(
    privateTotal + result.teams.reduce(
      (sum, team) => sum + team.people.reduce((teamSum, person) => teamSum + person.total, 0),
      0
    ),
    result.finalBill
  );
  assert.equal(roundedTotal, result.roundedTotal);
  assert.equal(result.roundedTotal - result.finalBill, result.roundingAdjustment);
  for (const person of [
    ...result.privatePeople,
    ...result.teams.flatMap(team => team.people)
  ]) {
    assert.equal(person.roundedTotal % 1000, 0);
    assert.equal(person.roundedTotal, Math.floor(person.total / 1000 + 0.5) * 1000);
  }
  for (const team of result.teams) {
    assert.equal(
      team.people.reduce((sum, person) => sum + person.total, 0),
      team.budget
    );
  }
}

test("one team with all members ordering", () => {
  const result = calculate({
    rows: [{ person: "A", price: 10 }, { person: "B", price: 20 }],
    teams: [{ percentage: 100, members: ["A", "B"] }]
  });
  assert.equal(result.teams[0].people.length, 2);
  assertReconciles(result);
});

test("one team includes members without orders", () => {
  const result = calculate({
    rows: [{ person: "A", price: 30 }, { person: "B", price: 20 }],
    teams: [{ percentage: 100, members: ["A", "B", "C"] }]
  });
  assert.equal(result.teams[0].people.find(person => person.name === "C").quantity, 0);
  assertReconciles(result);
});

test("multiple teams split budgets by configured percentages", () => {
  const result = calculate({
    rows: [{ person: "A", price: 60 }, { person: "B", price: 40 }],
    teams: [
      { percentage: 60, members: ["A"] },
      { percentage: 40, members: ["B"] }
    ]
  });
  assert.deepEqual(result.teams.map(team => team.budget), [60000, 40000]);
  assertReconciles(result);
});

test("a zero-percent team receives a zero budget", () => {
  const result = calculate({
    rows: [{ person: "A", price: 100 }],
    teams: [
      { percentage: 100, members: ["A"] },
      { percentage: 0, members: ["B"] }
    ]
  });
  assert.equal(result.teams[1].budget, 0);
  assert.equal(result.teams[1].people[0].total, 0);
  assertReconciles(result);
});

test("a 100-percent team receives the full team pool", () => {
  const result = calculate({
    rows: [{ person: "A", price: 100 }],
    teams: [{ percentage: 100, members: ["A"] }]
  });
  assert.equal(result.teams[0].budget, result.teamPool);
  assertReconciles(result);
});

test("individual orders pay their proportional product allocation", () => {
  const result = calculate({
    rows: [{ person: "A", price: 60 }, { person: "Private", price: 40 }],
    teams: [{ percentage: 100, members: ["A"] }],
    privatePeople: ["Private"]
  });
  assert.equal(result.privatePeople[0].total, 40000);
  assert.equal(result.privatePeople[0].roundedTotal, 40000);
  assertReconciles(result);
});

test("multiple individual orders are included in their total", () => {
  const result = calculate({
    rows: [
      { person: "A", price: 40 },
      { person: "P1", price: 20 },
      { person: "P2", price: 40 }
    ],
    teams: [{ percentage: 100, members: ["A"] }],
    privatePeople: ["P1", "P2"]
  });
  assert.equal(result.privateTotal, 60000);
  assertReconciles(result);
});

test("one person can have multiple order lines", () => {
  const result = calculate({
    rows: [
      { person: "A", price: 10, quantity: 2 },
      { person: "A", price: 15 }
    ],
    teams: [{ percentage: 100, members: ["A"] }]
  });
  assert.equal(result.teams[0].people[0].originalTotal, 35000);
  assert.equal(result.teams[0].people[0].quantity, 3);
  assertReconciles(result);
});

test("settlement remains scoped to the selected shop", () => {
  const result = calculate({
    rows: [
      { person: "A", price: 10, shopId: "shop" },
      { person: "A", price: 30, shopId: "other-shop" }
    ],
    teams: [{ percentage: 100, members: ["A"] }]
  });
  assert.equal(result.shopName, "Atto");
  assert.equal(result.productTotal, 10000);
  assertReconciles(result);
});

test("additional fees are included in proportional allocation", () => {
  const result = calculate({
    rows: [{ person: "A", price: 100 }],
    teams: [{ percentage: 100, members: ["A"] }],
    fee: 10
  });
  assert.equal(result.finalBill, 110000);
  assertReconciles(result);
});

test("discounts reduce the proportional final bill", () => {
  const result = calculate({
    rows: [{ person: "A", price: 100 }],
    teams: [{ percentage: 100, members: ["A"] }],
    discount: 10
  });
  assert.equal(result.finalBill, 90000);
  assertReconciles(result);
});

test("zero fees and discounts preserve the original total", () => {
  const result = calculate({
    rows: [{ person: "A", price: 100 }],
    teams: [{ percentage: 100, members: ["A"] }]
  });
  assert.equal(result.finalBill, result.productTotal);
  assertReconciles(result);
});

test("a discount equal to the bill with fees produces a zero bill", () => {
  const result = calculate({
    rows: [{ person: "A", price: 100 }],
    teams: [{ percentage: 100, members: ["A"] }],
    fee: 10,
    discount: 110
  });
  assert.equal(result.finalBill, 0);
  assertReconciles(result);
});

test("the documented sample calculates 235,000 VND and reconciles", () => {
  const result = calculate({
    rows: [
      { person: "su1", price: 30 },
      { person: "su1", price: 40 },
      { person: "su2", price: 40 },
      { person: "su3", price: 20 },
      { person: "su3", price: 20 },
      { person: "su4", price: 20 },
      { person: "bu", price: 45 }
    ],
    teams: [
      { percentage: 100, members: ["su1", "su2", "ben"] },
      { percentage: 0, members: ["su3", "su4"] }
    ],
    privatePeople: ["bu"],
    fee: 50,
    discount: 30
  });
  assert.equal(result.productTotal, 215000);
  assert.equal(result.privatePeople[0].total, 49186);
  assert.equal(result.privatePeople[0].roundedTotal, 49000);
  assert.equal(result.teams[0].productTotal, 95068);
  assert.equal(result.finalBill, 235000);
  assert.equal(result.roundedTotal, 235000);
  assertReconciles(result);
});

test("individual bills round to the nearest thousand and can differ from the invoice total", () => {
  const result = calculate({
    rows: [
      { person: "A", price: 10 },
      { person: "B", price: 10 },
      { person: "C", price: 10 }
    ],
    teams: [{ percentage: 100, members: ["A", "B", "C"] }],
    fee: 1
  });
  assert.deepEqual(
    Array.from(result.teams[0].people, person => person.roundedTotal),
    [10000, 10000, 10000]
  );
  assert.equal(result.finalBill, 31000);
  assert.equal(result.roundedTotal, 30000);
  assert.equal(result.roundingAdjustment, -1000);
  assertReconciles(result);
});

test("an exact half-thousand payable rounds up", () => {
  const result = calculate({
    rows: [{ person: "A", price: 1 }, { person: "B", price: 1 }],
    teams: [{ percentage: 100, members: ["A", "B"] }],
    fee: 1
  });
  assert.deepEqual(
    Array.from(result.teams[0].people, person => person.roundedTotal),
    [2000, 2000]
  );
  assert.equal(result.finalBill, 3000);
  assert.equal(result.roundedTotal, 4000);
  assertReconciles(result);
});

test("bill preview markdown lists rounded payable amounts by individual and team groups", () => {
  const context = vm.createContext({
    formatVnd: amount => `${amount.toLocaleString("vi-VN")} ₫`
  });
  vm.runInContext(featureSource, context);
  context.previewResult = {
    privatePeople: [
      { name: "bu", roundedTotal: 49000 },
      { name: "private-name", roundedTotal: 0 }
    ],
    teams: [
      { index: 0, people: [{ name: "su1", roundedTotal: 42000 }] },
      { index: 1, people: [{ name: "member.2", roundedTotal: 0 }] }
    ]
  };
  const markdown = vm.runInContext(
    "buildDrinkBillPreviewMarkdown(previewResult)",
    context
  );
  assert.equal(markdown, [
    "## Individual orders",
    "+ bu - 49.000 ₫",
    "+ private-name - 0 ₫",
    "",
    "## Team 1",
    "+ su1 - 42.000 ₫",
    "",
    "## Team 2",
    "+ member\\.2 - 0 ₫"
  ].join("\n"));
});

test("bill preview numbers each person with the entered prefix across groups", () => {
  const context = vm.createContext({
    formatVnd: amount => `${amount.toLocaleString("vi-VN")} ₫`
  });
  vm.runInContext(featureSource, context);
  context.previewResult = {
    privatePeople: [{ name: "bu", roundedTotal: 45000 }],
    teams: [
      { index: 0, people: [{ name: "su1", roundedTotal: 42000 }, { name: "ben", roundedTotal: 14000 }] },
      { index: 1, people: [{ name: "su3", roundedTotal: 46000 }] }
    ]
  };
  const markdown = vm.runInContext(
    "buildDrinkBillPreviewMarkdown(previewResult, 'Yyy')",
    context
  );
  assert.equal(markdown, [
    "## Individual orders",
    "+ Yyy1 - bu - 45.000 ₫",
    "",
    "## Team 1",
    "+ Yyy2 - su1 - 42.000 ₫",
    "+ Yyy3 - ben - 14.000 ₫",
    "",
    "## Team 2",
    "+ Yyy4 - su3 - 46.000 ₫"
  ].join("\n"));
});

test("invalid team percentages are rejected", () => {
  assert.throws(() => calculate({
    rows: [{ person: "A", price: 100 }],
    teams: [{ percentage: 99, members: ["A"] }]
  }), /exactly 100%/);
});

test("non-positive order quantities are rejected", () => {
  assert.throws(() => calculate({
    rows: [{ person: "A", price: 100, quantity: 0 }],
    teams: [{ percentage: 100, members: ["A"] }]
  }), /positive whole number/);
});

test("discounts greater than the bill with fees are rejected", () => {
  assert.throws(() => calculate({
    rows: [{ person: "A", price: 100 }],
    teams: [{ percentage: 100, members: ["A"] }],
    discount: 101
  }), /cannot be greater than B/);
});

test("duplicate team members are rejected", () => {
  assert.throws(() => calculate({
    rows: [{ person: "A", price: 100 }],
    teams: [
      { percentage: 50, members: ["A"] },
      { percentage: 50, members: ["A"] }
    ]
  }), /listed more than once/);
});

test("a person cannot be assigned to a team and individual orders", () => {
  assert.throws(() => calculate({
    rows: [{ person: "A", price: 100 }],
    teams: [{ percentage: 100, members: ["A"] }],
    privatePeople: ["A"]
  }), /listed more than once/);
});

test("orders without a group assignment are rejected", () => {
  assert.throws(() => calculate({
    rows: [{ person: "A", price: 60 }, { person: "B", price: 40 }],
    teams: [{ percentage: 100, members: ["A"] }]
  }), /Assign B to a team or to separate orders/);
});

test("a team without orders still gets its configured budget", () => {
  const result = calculate({
    rows: [{ person: "A", price: 100 }],
    teams: [
      { percentage: 50, members: ["A"] },
      { percentage: 50, members: ["B", "C"] }
    ]
  });
  assert.equal(result.teams[1].productTotal, 0);
  assert.equal(result.teams[1].people.reduce((sum, person) => sum + person.total, 0), 50000);
  assertReconciles(result);
});

test("largest remainders allocate fractional VND deterministically", () => {
  const result = calculate({
    rows: [{ person: "A", price: 100 }],
    teams: [
      { percentage: 33.33, members: ["A"] },
      { percentage: 66.67, members: ["B"] }
    ],
    fee: 1
  });
  assert.deepEqual(Array.from(result.teams, team => team.budget), [33663, 67337]);
  assertReconciles(result);
});

test("final totals and each team budget reconcile exactly", () => {
  const result = calculate({
    rows: [
      { person: "A", price: 30 },
      { person: "B", price: 20 },
      { person: "P1", price: 10 },
      { person: "P2", price: 40 }
    ],
    teams: [
      { percentage: 60, members: ["A", "C"] },
      { percentage: 40, members: ["B"] }
    ],
    privatePeople: ["P1", "P2"],
    fee: 13,
    discount: 7
  });
  assertReconciles(result);
});
