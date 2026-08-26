// Local and public runs deliberately use the same owned fixture. Query strings
// cannot select a different data source, so the judge journey matches source.
export function resolveStorefrontMode(pageHref) {
  const page = new URL(pageHref);
  return {
    loopback: ["localhost", "127.0.0.1"].includes(page.hostname),
    requireFictional: true,
  };
}

export function attestsFictionalMode(message, { state = false } = {}) {
  if (message?.dataMode !== "fictional" || message?.fictional !== true) return false;
  if (!state) return message.protocol === 2;
  return message.fixture?.rightsSafe === true
    && message.fixture?.fictional === true
    && message.fixture?.owner === "GroundedRelay";
}

// Copy and data must agree. The server-rendered shell starts in the owned
// fictional mode, and only an exact, nonce-bound provider state may confirm it.
export function classifyStorefrontExperience(state) {
  if (attestsFictionalMode(state, { state: true })) return "fixture";
  return null;
}

// The provider sends initial state before ready in current browsers. This gate
// accepts either order but does not activate until both independent messages
// attest the same rights-safe mode. One mismatch permanently rejects the frame
// for this page load, preventing a later message from recovering into trust.
export function createFictionalProviderGate(required) {
  let ready = !required;
  let state = !required;
  let active = !required;
  let rejected = false;

  return {
    receive(kind, message) {
      const wasActive = active;
      if (rejected) return { accepted: false, rejected: true, active: false, becameReady: false };
      if (!required) return {
        accepted: true, rejected: false, active: true, becameReady: false, wasActive,
      };
      const valid = kind === "ready"
        ? attestsFictionalMode(message)
        : kind === "state" ? attestsFictionalMode(message, { state: true }) : false;
      if (!valid) {
        rejected = true;
        active = false;
        return { accepted: false, rejected: true, active: false, becameReady: false, wasActive };
      }
      if (kind === "ready") ready = true;
      if (kind === "state") state = true;
      active = ready && state;
      return {
        accepted: true,
        rejected: false,
        active,
        becameReady: !wasActive && active,
        wasActive,
      };
    },
    get active() { return active; },
    get rejected() { return rejected; },
  };
}
