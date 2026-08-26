export const safeRequestId = (value) => typeof value === "string"
  ? value.trim().slice(0, 128) || undefined : undefined;

export const checkoutAbort = (message, reason) => Object.assign(
  new DOMException(message, "AbortError"), { approvalReason: reason });

export function createCheckoutLifecycle({
  approvalId,
  revision,
  requestId,
  callerSignal,
}) {
  const expectedRequestId = safeRequestId(requestId);
  const controller = new AbortController();
  let phase = "awaiting-approval";
  let approvalSettled = false;
  let resolveApproval;
  let rejectApproval;
  const approval = new Promise((resolve, reject) => {
    resolveApproval = resolve;
    rejectApproval = reject;
  });

  const abort = (error) => {
    if (!controller.signal.aborted) controller.abort(error);
    if (!approvalSettled) {
      approvalSettled = true;
      rejectApproval(error);
    }
  };
  const callerAbort = () => abort(callerSignal?.reason
    ?? checkoutAbort("Checkout was cancelled.", "cancelled"));
  if (callerSignal?.aborted) callerAbort();
  else callerSignal?.addEventListener("abort", callerAbort, { once: true });

  const matchesRequest = (message) =>
    safeRequestId(message?.requestId) === expectedRequestId;

  return {
    approvalId,
    revision,
    requestId: expectedRequestId,
    signal: controller.signal,
    approval,
    get phase() { return phase; },
    approve(message) {
      if (!matchesRequest(message)) return { matched: false, valid: false };
      if (message?.approvalId !== approvalId
        || Number(message?.revision) !== Number(revision)) {
        abort(checkoutAbort("The basket approval no longer matches.", "stale"));
        return { matched: true, valid: false };
      }
      if (!approvalSettled) {
        approvalSettled = true;
        phase = "handoff";
        resolveApproval("approved");
      }
      return { matched: true, valid: true };
    },
    veto(message) {
      if (!matchesRequest(message)) return { matched: false };
      phase = "cancelled";
      abort(checkoutAbort("The human vetoed this checkout.", "cancelled"));
      return { matched: true };
    },
    finish() {
      callerSignal?.removeEventListener("abort", callerAbort);
      if (phase !== "cancelled") phase = "completed";
    },
  };
}
