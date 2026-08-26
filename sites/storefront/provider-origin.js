export function resolveProviderOrigin(pageHref, configuredOrigin) {
  const page = new URL(pageHref);
  const isLocal = ["localhost", "127.0.0.1"].includes(page.hostname);
  const toExternalHttpOrigin = (candidate) => {
    try {
      const provider = new URL(candidate);
      if (!["http:", "https:"].includes(provider.protocol)) return null;
      if (provider.origin === page.origin) return null;
      return provider.origin;
    } catch {
      return null;
    }
  };

  if (isLocal) {
    const localProvider = new URL(page.origin);
    localProvider.port = "5174";
    return localProvider.origin;
  }

  const provider = toExternalHttpOrigin(configuredOrigin);
  if (provider) return provider;
  throw new TypeError("Provider origin must be an absolute, cross-origin http(s) URL");
}
