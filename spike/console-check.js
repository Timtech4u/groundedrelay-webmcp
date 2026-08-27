// Optional compatibility probe for a browser console on the local app:
// http://localhost:5173/
// (`?embed=` is only an optional local provider override)
//
// The normal development target is Codex's in-app browser. Use this only when
// a console is available and exact WebMCP wire evidence is needed. It adds one
// item to the device-local basket, opens the approval dialog, and vetoes it. It
// never approves a handoff or opens a merchant page.
(async () => {
  const PROVIDER = "http://localhost:5174";
  const providerExpected = [
    "compare_products",
    "focus_products",
    "get_shopping_state",
    "highlight_evidence",
    "inspect_products",
    "list_shops",
    "prepare_checkout_handoff",
    "search_products",
    "set_basket_quantity",
  ];
  const initialExpected = ["get_shopping_state", "list_shops", "search_products"];
  const out = [];
  const say = (name, ok, detail) =>
    out.push(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const mc = document.modelContext || navigator.modelContext;

  if (!mc) {
    console.log("SKIP WebMCP: this browser is using BasketShipper's direct local-search fallback");
    return;
  }

  const local = (await mc.getTools())
    .filter((tool) => !tool.origin || tool.origin === location.origin);
  const localNames = local.map((tool) => tool.name).sort();
  say("state-aware clean surface",
    initialExpected.every((name) => localNames.includes(name))
      && !localNames.includes("prepare_checkout_handoff"),
    localNames.join(", "));

  const discovered = await mc.getTools({ fromOrigins: [PROVIDER] });
  const foreign = discovered.filter((tool) => tool.origin === PROVIDER);
  say("cross-origin discovery", foreign.length === providerExpected.length,
    foreign.map((tool) => tool.name).sort().join(", "));
  say("wire prefix", foreign.every((tool) => tool.name.startsWith("wire__")),
    "provider and clean names do not collide");
  say("wire schema", foreign.every((tool) => typeof tool.inputSchema === "string"),
    foreign.map((tool) => typeof tool.inputSchema).join(", "));

  const run = async (name, args = {}) => {
    const current = (await mc.getTools())
      .filter((candidate) => !candidate.origin || candidate.origin === location.origin);
    const tool = current.find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`Missing ${name}`);
    return mc.executeTool(tool, JSON.stringify(args));
  };

  const shops = JSON.parse(await run("list_shops"));
  say("fictional roster", shops.ok && shops.configured === 3,
    `${shops.configured} configured; ${shops.reachable} currently reached`);

  const search = JSON.parse(await run("search_products", {
    query: "fictional", ships_to: "RW",
  }));
  const available = search.products.filter((product) => product.available);
  say("rights-safe local search", search.ok && search.searched === 3 && available.length >= 2,
    `${available.length} available match(es); ${search.unavailable.length} unavailable shop(s)`);

  if (available.length >= 2) {
    const skus = available.slice(0, 2).map((product) => product.sku);
    await run("compare_products", { skus });
    await wait(140);
    await run("highlight_evidence", {
      fields: ["merchant", "exact_variant", "availability", "currency", "current_price"],
    });
    await wait(50);
    const panel = document.getElementById("comparison");
    const focused = panel.querySelectorAll("tr.evidence").length;
    const box = panel.getBoundingClientRect();
    say("rendered evidence", getComputedStyle(panel).display !== "none" && box.height > 0 && focused === 5,
      `${focused} highlighted rows; ${Math.round(box.width)}×${Math.round(box.height)}px`);

    const state = JSON.parse(await run("get_shopping_state"));
    await run("set_basket_quantity", {
      sku: skus[0], quantity: 1, expected_state_revision: state.revision,
    });
    await wait(140);
    const changed = JSON.parse(await run("get_shopping_state"));
    const checkout = run("prepare_checkout_handoff", {
      expected_state_revision: changed.revision,
    }).then(
      () => ({ rejected: false }),
      (error) => ({ rejected: true, error }),
    );
    await wait(80);
    const approval = document.getElementById("approval");
    const approvalBox = approval.getBoundingClientRect();
    say("human stop", getComputedStyle(approval).display !== "none" && approvalBox.height > 0,
      `${Math.round(approvalBox.width)}×${Math.round(approvalBox.height)}px`);
    document.getElementById("veto").click();
    const vetoed = await checkout;
    say("veto rejects", vetoed.rejected, vetoed.error?.name ?? "unexpected success");
    const survived = JSON.parse(await run("get_shopping_state"));
    await run("set_basket_quantity", {
      sku: skus[0], quantity: 0, expected_state_revision: survived.revision,
    });
    const cleaned = JSON.parse(await run("get_shopping_state"));
    say("device-local basket cleanup", cleaned.cart.length === 0,
      `${cleaned.cart.length} basket line(s) remain`);
  }

  console.log(out.join("\n"));
  return out.join("\n");
})();
