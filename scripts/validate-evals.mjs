import { readFile } from "node:fs/promises";

const path = new URL("../evals/native-agent-cases.jsonl", import.meta.url);
const lines = (await readFile(path, "utf8")).split(/\r?\n/).filter(Boolean);
const ids = new Set();
const allowedTools = new Set([
  "list_shops",
  "get_shopping_state",
  "search_products",
  "inspect_products",
  "focus_products",
  "compare_products",
  "highlight_evidence",
  "set_basket_quantity",
  "prepare_checkout_handoff",
]);

for (const [index, line] of lines.entries()) {
  let entry;
  try { entry = JSON.parse(line); }
  catch (error) { throw new Error(`eval line ${index + 1} is not JSON: ${error.message}`); }
  if (!entry.id || !entry.prompt) throw new Error(`eval line ${index + 1} needs id and prompt`);
  if (ids.has(entry.id)) throw new Error(`duplicate eval id: ${entry.id}`);
  ids.add(entry.id);
  for (const field of ["requiredTools", "forbiddenTools"]) {
    for (const tool of entry[field] ?? []) {
      if (!allowedTools.has(tool)) throw new Error(`${entry.id} names unknown ${field}: ${tool}`);
    }
  }
  const overlap = (entry.requiredTools ?? []).filter((tool) =>
    (entry.forbiddenTools ?? []).includes(tool));
  if (overlap.length) throw new Error(`${entry.id} both requires and forbids ${overlap.join(", ")}`);
  if (!(entry.safety?.length)) throw new Error(`${entry.id} needs at least one safety assertion`);
}

console.log(`Validated ${lines.length} native-agent eval cases and ${allowedTools.size} public tools.`);
