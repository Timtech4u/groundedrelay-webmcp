import assert from "node:assert/strict";
import test from "node:test";

import { resolveProviderOrigin } from "../sites/storefront/provider-origin.js";

const DEPLOYED_PROVIDER = "https://provider.groundedrelay.example/embed";

test("clean localhost entry infers the local provider port", () => {
  assert.equal(
    resolveProviderOrigin("http://localhost:5173/", DEPLOYED_PROVIDER),
    "http://localhost:5174",
  );
});

test("clean loopback IP entry keeps the same hostname", () => {
  assert.equal(
    resolveProviderOrigin("http://127.0.0.1:5173/", DEPLOYED_PROVIDER),
    "http://127.0.0.1:5174",
  );
});

test("query-string provider substitutions are ignored on loopback", () => {
  assert.equal(
    resolveProviderOrigin(
      "http://localhost:5173/?embed=https%3A%2F%2Fpreview.example%2Fembed%3Fx%3D1",
      DEPLOYED_PROVIDER,
    ),
    "http://localhost:5174",
  );
});

test("deployed pages ignore query-string provider substitutions", () => {
  assert.equal(
    resolveProviderOrigin(
      "https://groundedrelay.example/?embed=https%3A%2F%2Fevil.example",
      DEPLOYED_PROVIDER,
    ),
    "https://provider.groundedrelay.example",
  );
});

test("deployed configuration must be absolute http(s) and cross-origin", () => {
  assert.throws(
    () => resolveProviderOrigin("https://groundedrelay.example/", "/provider"),
    /absolute, cross-origin http\(s\) URL/,
  );
  assert.throws(
    () => resolveProviderOrigin(
      "https://groundedrelay.example/",
      "https://groundedrelay.example/provider",
    ),
    /absolute, cross-origin http\(s\) URL/,
  );
});
