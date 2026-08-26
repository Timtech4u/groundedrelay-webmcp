export async function settleWithin(promise, label, ms = 6_000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(
          new DOMException(`${label} took too long`, "TimeoutError")), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Coalesce bursts, but never overlap reconciliations. Calls arriving while a
// pass is awaiting browser registration request exactly one more pass and share
// the same flight, so they cannot race to register the same clean tool name.
export function createSingleFlightReconciler(reconcileOnce) {
  let requested = false;
  let active = null;

  const request = () => {
    requested = true;
    if (active) return active;

    const flight = (async () => {
      while (requested) {
        requested = false;
        await reconcileOnce();
      }
    })();
    const wrapped = flight.finally(() => {
      if (active === wrapped) active = null;
      // A caller can arrive after the drain's last synchronous condition check
      // but before this finalizer. Chain that request so existing callers still
      // wait for all queued state.
      if (requested) return request();
    });
    active = wrapped;
    return wrapped;
  };

  return request;
}
