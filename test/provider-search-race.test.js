import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const provider = await readFile(
  new URL("../sites/embed/embed.js", import.meta.url), "utf8");

test("provider portability claim includes the required host adapter", () => {
  assert.match(provider, /runs on its OWN origin in an iframe/);
  assert.match(provider, /small host adapter for the handshake, tool hoisting, and approval UI/);
  assert.doesNotMatch(provider, /only drops in the script tag/);
});

test("each direct search owns its controller and stale completion cannot clear the latest", () => {
  const start = provider.indexOf('if (e.data?.type === "host:search")');
  const end = provider.indexOf('if (e.data?.type === "host:cancel-search")', start);
  const block = provider.slice(start, end);
  assert.match(block, /const uiSearchController = new AbortController\(\)/);
  assert.match(block, /activeUiSearchController = uiSearchController/);
  assert.match(block, /backend\.search\(input, signal\), uiSearchController\.signal/);
  assert.match(block, /if \(activeUiSearchController === uiSearchController\) \{\s*activeUiSearchController = null/);

  let active = null;
  const begin = () => {
    const controller = new AbortController();
    active?.abort(new DOMException("Replaced", "AbortError"));
    active = controller;
    return {
      controller,
      finish() { if (active === controller) active = null; },
    };
  };

  const searchA = begin();
  const searchB = begin();
  assert.equal(searchA.controller.signal.aborted, true);
  assert.equal(active, searchB.controller);
  searchA.finish();
  assert.equal(active, searchB.controller,
    "A finishing after B starts must not clear B's cancellation handle");
  active.abort(new DOMException("Cancelled", "AbortError"));
  assert.equal(searchB.controller.signal.aborted, true,
    "the global cancel must still reach B after A finishes");
  searchB.finish();
  assert.equal(active, null);
});

test("AbortError is a normal direct-search cancellation, not a red UI failure", () => {
  const start = provider.indexOf('if (e.data?.type === "host:search")');
  const end = provider.indexOf('if (e.data?.type === "host:cancel-search")', start);
  const block = provider.slice(start, end);
  const abortStart = block.indexOf('if (error?.name === "AbortError")');
  const failureStart = block.indexOf("} else {", abortStart);
  const cancellationBranch = block.slice(abortStart, failureStart);
  assert.match(cancellationBranch, /page search cancelled/);
  assert.doesNotMatch(cancellationBranch, /"bad"|embed:ui-error/);
  assert.match(block.slice(failureStart), /embed:ui-error/,
    "non-cancellation failures must still surface to the host");
});
