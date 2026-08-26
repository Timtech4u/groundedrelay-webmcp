export function interpretApprovalResolution(message = {}) {
  if (message.outcome === "approved" && message.valid === true) {
    return {
      waitForLinks: true,
      status: "Approved. Waiting for the owned demo links…",
    };
  }
  if (message.reason === "stale") {
    return {
      waitForLinks: false,
      status: "The basket changed during review. Nothing opened; review it again.",
    };
  }
  if (message.reason === "cancelled") {
    return {
      waitForLinks: false,
      status: "Handoff cancelled. The fictional basket is unchanged.",
    };
  }
  return {
    waitForLinks: false,
    status: "The provider could not validate that approval. Nothing opened; try again.",
  };
}
