export function variantDisplayText(selectedVariant) {
  if (!selectedVariant || typeof selectedVariant !== "object") return null;
  const title = selectedVariant.title == null
    ? "Selected option" : String(selectedVariant.title).trim();
  const titleParts = new Set(title.split(/\s*(?:\/|·)\s*/)
    .map((part) => part.trim().toLocaleLowerCase()).filter(Boolean));
  const seen = new Set();
  const options = Array.isArray(selectedVariant.options) ? selectedVariant.options
    .map((option) => String(option).trim()).filter((option) => {
      if (!option) return false;
      const normalized = option.toLocaleLowerCase();
      const value = normalized.includes(":")
        ? normalized.slice(normalized.indexOf(":") + 1).trim() : normalized;
      if (normalized === title.toLocaleLowerCase() || titleParts.has(value)
        || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    }) : [];
  return `${title}${options.length ? ` · ${options.join(" / ")}` : ""}`;
}

export function approvalVariantText(selectedVariant) {
  const display = variantDisplayText(selectedVariant);
  return display ? `Exact variant: ${display}` : null;
}
