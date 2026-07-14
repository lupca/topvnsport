export const getSafeRedirectUrl = (urlStr: string): string => {
  if (!urlStr || typeof urlStr !== "string" || !urlStr.trim()) {
    return "/dashboard";
  }

  urlStr = urlStr.normalize("NFKC");
  urlStr = urlStr.replace(/[\u2044\u2215]/g, "/").replace(/\u29F5/g, "\\");
  if (!urlStr || !urlStr.trim()) {
    return "/dashboard";
  }

  // 1. Recursive decode percent-encoding until stable
  let decoded = urlStr;
  let prev = "";
  let iterations = 0;
  while (decoded !== prev && iterations < 10) {
    prev = decoded;
    let nextDecoded = decoded.replace(/(?:%[0-9a-fA-F]{2})+/g, (match) => {
      try {
        return decodeURIComponent(match);
      } catch {
        return match.replace(/%([0-9a-fA-F]{2})/g, (_, hex) => {
          return String.fromCharCode(parseInt(hex, 16));
        });
      }
    });
    nextDecoded = nextDecoded.normalize("NFKC");
    nextDecoded = nextDecoded.replace(/[\u2044\u2215]/g, "/").replace(/\u29F5/g, "\\");
    if (nextDecoded === decoded) {
      break;
    }
    decoded = nextDecoded;
    iterations++;
  }

  // If we reached the iteration limit and the string was still changing,
  // it means the encoding was deeper than our limit, which is suspicious.
  if (decoded !== prev) {
    return "/dashboard";
  }

  // 2. Decode HTML entities to prevent DOM XSS scheme bypasses (e.g. jav&#x09;ascript:)
  let htmlDecoded = decoded.replace(/&#([xX]?[0-9a-fA-F]+);/g, (match, p1) => {
    try {
      const code = (p1.startsWith("x") || p1.startsWith("X"))
        ? parseInt(p1.slice(1), 16)
        : parseInt(p1, 10);
      return String.fromCharCode(code);
    } catch {
      return match;
    }
  });

  const namedEntities: Record<string, string> = {
    "&colon;": ":",
    "&Tab;": "\t",
    "&tab;": "\t",
    "&NewLine;": "\n",
    "&newline;": "\n",
    "&sol;": "/",
    "&bsol;": "\\",
    "&lt;": "<",
    "&gt;": ">"
  };

  for (const [entity, value] of Object.entries(namedEntities)) {
    htmlDecoded = htmlDecoded.replaceAll(entity, value);
  }

  // Also normalize htmlDecoded after entity translation
  htmlDecoded = htmlDecoded.normalize("NFKC");
  htmlDecoded = htmlDecoded.replace(/[\u2044\u2215]/g, "/").replace(/\u29F5/g, "\\");

  // Strip all whitespace/control/format chars from decoded representation to inspect the scheme
  const cleanedForSchemeCheck = htmlDecoded.replace(/[\s\x00-\x1F\x7F\u0080-\u009F\u00A0\u1680\u180E\u2000-\u200A\u200B-\u200D\u200E\u200F\u2028\u2029\u202A-\u202E\u202F\u205F\u2060-\u206F\u3000\uFEFF]/g, "").toLowerCase();

  // Reject suspicious schemes
  if (
    cleanedForSchemeCheck.startsWith("javascript:") ||
    cleanedForSchemeCheck.startsWith("data:") ||
    cleanedForSchemeCheck.startsWith("vbscript:")
  ) {
    return "/dashboard";
  }

  // Reject control, zero-width, and other Unicode space/format characters in decoded version
  if (/[\x00-\x1F\x7F\u0080-\u009F\u00A0\u1680\u180E\u2000-\u200A\u200B-\u200D\u200E\u200F\u2028\u2029\u202A-\u202E\u202F\u205F\u2060-\u206F\u3000\uFEFF]/.test(htmlDecoded)) {
    return "/dashboard";
  }

  // Reject consecutive percent characters which indicate double/multi-encoding obfuscation
  if (decoded.includes("%%") || htmlDecoded.includes("%%")) {
    return "/dashboard";
  }

  try {
    // Normalize backslashes on the decoded path
    let normalizedPath = decoded.replace(/\\/g, "/");

    // Ensure relative paths have a leading slash if they don't start with a scheme
    if (!normalizedPath.startsWith("/") && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(normalizedPath)) {
      normalizedPath = "/" + normalizedPath;
    }

    const base = "http://safe-base-dummy.internal";
    const parsed = new URL(normalizedPath, base);

    // If the parsed URL origin matches dummy base, it is a relative URL
    if (parsed.origin === base) {
      const safePath = parsed.pathname + parsed.search + parsed.hash;

      let tempDecoded = decoded.replace(/\\/g, "/").trim();

      if (
        tempDecoded.startsWith("//") ||
        tempDecoded.startsWith(":") ||
        tempDecoded.includes("::") ||
        /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(tempDecoded)
      ) {
        return "/dashboard";
      }

      if (safePath.startsWith("/") && !safePath.startsWith("//")) {
        return safePath;
      }
      return "/dashboard";
    }

    // Verify whitelisted hosts
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      const getTrustedHost = (envUrl: string, defaultVal: string): string => {
        try {
          return new URL(envUrl || defaultVal).host;
        } catch {
          try {
            return new URL(defaultVal).host;
          } catch {
            return "";
          }
        }
      };

      const pmiHost = getTrustedHost(process.env.NEXT_PUBLIC_PMI_URL || "", "http://localhost:13100");
      const omsHost = getTrustedHost(process.env.NEXT_PUBLIC_OMS_URL || "", "http://localhost:13101");
      const wmsHost = getTrustedHost(process.env.NEXT_PUBLIC_WMS_URL || "", "http://localhost:13102");

      const targetHost = parsed.host;
      if (
        (pmiHost && targetHost === pmiHost) ||
        (omsHost && targetHost === omsHost) ||
        (wmsHost && targetHost === wmsHost)
      ) {
        return urlStr;
      }
    }
  } catch (e) {
    // Fallback if URL parsing fails
  }

  return "/dashboard";
};

