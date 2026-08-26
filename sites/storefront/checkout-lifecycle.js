export function createCheckoutLifecycle(idFactory = () => crypto.randomUUID()) {
  let activeRequestId = null;
  const cancelled = new Set();

  const rememberCancelled = (requestId) => {
    cancelled.add(requestId);
    // A page only needs a small replay window. Bound it so repeated retries do
    // not grow memory for the lifetime of a long-running installed app.
    while (cancelled.size > 32) cancelled.delete(cancelled.values().next().value);
  };

  return {
    start() {
      if (activeRequestId) return null;
      activeRequestId = String(idFactory());
      return activeRequestId;
    },
    accepts(requestId) {
      if (requestId == null || requestId === "") return activeRequestId == null;
      const value = String(requestId);
      return value === activeRequestId && !cancelled.has(value);
    },
    cancel() {
      if (!activeRequestId) return null;
      const value = activeRequestId;
      activeRequestId = null;
      rememberCancelled(value);
      return value;
    },
    finish(requestId) {
      if (requestId == null || requestId === "") return activeRequestId == null;
      const value = String(requestId);
      if (value !== activeRequestId || cancelled.has(value)) return false;
      activeRequestId = null;
      return true;
    },
    get activeRequestId() { return activeRequestId; },
  };
}
