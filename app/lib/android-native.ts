/**
 * FeeFlow Android Native Integration & WebChromeClient Scheme Interceptor
 * Handles Google OAuth redirects, WhatsApp links, tel:, mailto:, market:, intent:,
 * and prevents net::ERR_UNKNOWN_URL_SCHEME or net::ERR_CONNECTION_REFUSED in Android WebViews.
 */

export function getAppOrigin(): string {
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    if (
      origin &&
      !origin.includes("localhost") &&
      !origin.includes("127.0.0.1") &&
      !origin.startsWith("file://") &&
      !origin.startsWith("capacitor://")
    ) {
      return origin;
    }
  }
  return "https://iiiii-pi.vercel.app";
}

/**
 * Transforms any whatsapp:// or wa.me link into a clean https://api.whatsapp.com URL.
 */
export function formatWhatsAppUrl(phoneOrUrl: string, message?: string): string {
  if (phoneOrUrl.startsWith("whatsapp://") || phoneOrUrl.startsWith("https://wa.me/")) {
    if (phoneOrUrl.startsWith("whatsapp://send/?") || phoneOrUrl.startsWith("whatsapp://send?")) {
      const query = phoneOrUrl.split("?")[1] || "";
      return `https://api.whatsapp.com/send?${query}`;
    }
    if (phoneOrUrl.startsWith("https://wa.me/")) {
      const path = phoneOrUrl.replace("https://wa.me/", "");
      const [phone, query] = path.split("?");
      return `https://api.whatsapp.com/send?phone=${phone}${query ? `&${query}` : ""}`;
    }
  }

  const cleanPhone = phoneOrUrl.replace(/\D/g, "");
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const encodedText = message ? encodeURIComponent(message) : "";

  return `https://api.whatsapp.com/send?phone=${formattedPhone}${encodedText ? `&text=${encodedText}` : ""}`;
}

/**
 * Safely opens external links (whatsapp://, tel:, mailto:, market:, intent:) via native Android OS intent.
 */
export function openExternalAppUrl(rawUrl: string): void {
  if (typeof window === "undefined" || !rawUrl) return;

  let targetUrl = rawUrl.trim();

  // Normalize WhatsApp schemes
  if (
    targetUrl.startsWith("whatsapp://") ||
    targetUrl.startsWith("https://wa.me/") ||
    targetUrl.includes("api.whatsapp.com")
  ) {
    targetUrl = formatWhatsAppUrl(targetUrl);
  }

  // 1. Capacitor Browser plugin bridge if running inside Capacitor Android app
  // @ts-expect-error Capacitor global object check
  if (typeof window.Capacitor !== "undefined" && window.Capacitor?.isPluginAvailable?.("Browser")) {
    try {
      // @ts-expect-error Capacitor Plugins
      window.Capacitor.Plugins.Browser.open({ url: targetUrl });
      return;
    } catch (err) {
      console.warn("Capacitor Browser plugin call fallback:", err);
    }
  }

  // 2. Cordova / Android WebView window.open _system target
  try {
    const systemWin = window.open(targetUrl, "_system", "location=yes");
    if (systemWin) return;
  } catch (err) {
    console.warn("window.open _system fallback:", err);
  }

  // 3. Target _blank DOM anchor click (Instructs Android OS to open external Intent)
  try {
    const anchor = document.createElement("a");
    anchor.href = targetUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      if (anchor.parentNode) {
        anchor.parentNode.removeChild(anchor);
      }
    }, 150);
  } catch {
    window.location.href = targetUrl;
  }
}

/**
 * Global link interceptor that prevents WebView from trying to navigate internally to
 * whatsapp://, tel:, mailto:, market:, or intent: schemes.
 */
export function initAndroidLinkInterceptor(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const handleGlobalClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const anchor = target.closest("a") as HTMLAnchorElement | null;
    if (!anchor || !anchor.href) return;

    const href = anchor.href;

    const isExternalScheme =
      href.startsWith("whatsapp://") ||
      href.startsWith("tel:") ||
      href.startsWith("mailto:") ||
      href.startsWith("market:") ||
      href.startsWith("intent:") ||
      href.includes("wa.me/") ||
      href.includes("api.whatsapp.com");

    if (isExternalScheme) {
      event.preventDefault();
      event.stopPropagation();
      openExternalAppUrl(href);
    }
  };

  document.addEventListener("click", handleGlobalClick, true);

  // Clean URL hash if localhost access_token fragment is present
  if (
    window.location.hash.includes("access_token=") ||
    window.location.search.includes("code=") ||
    window.location.href.includes("localhost:3000")
  ) {
    try {
      window.history.replaceState(null, "", window.location.pathname);
    } catch {
      // ignore
    }
  }

  return () => {
    document.removeEventListener("click", handleGlobalClick, true);
  };
}
