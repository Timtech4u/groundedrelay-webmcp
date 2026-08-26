const attestsFictional = (message, state) => {
  if (message?.dataMode !== "fictional" || message?.fictional !== true) return false;
  if (!state) return message.protocol === 2;
  return message.fixture?.rightsSafe === true
    && message.fixture?.fictional === true
    && message.fixture?.owner === "GroundedRelay";
};

// The independent host is exclusively a fictional portability proof. It may
// receive ready/state in either order, but trusts neither until both attest the
// same GroundedRelay-owned mode. A mismatch is permanent for the page load.
export function createMerchantProviderGate() {
  let ready = false;
  let state = false;
  let active = false;
  let rejected = false;
  return {
    receive(kind, message) {
      const wasActive = active;
      if (rejected) return { accepted: false, rejected: true, active: false, becameReady: false };
      const valid = kind === "ready"
        ? attestsFictional(message, false)
        : kind === "state" ? attestsFictional(message, true) : false;
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
