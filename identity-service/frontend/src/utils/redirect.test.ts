import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getSafeRedirectUrl } from "./redirect";

describe("getSafeRedirectUrl stress tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Valid relative paths", () => {
    it("should allow standard relative paths", () => {
      expect(getSafeRedirectUrl("/dashboard")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/")).toBe("/");
      expect(getSafeRedirectUrl("/settings?tab=profile")).toBe("/settings?tab=profile");
      expect(getSafeRedirectUrl("/settings#security")).toBe("/settings#security");
      expect(getSafeRedirectUrl("/orders/123/edit")).toBe("/orders/123/edit");
    });

    it("should convert a relative path without a leading slash to a relative path with a leading slash", () => {
      expect(getSafeRedirectUrl("dashboard")).toBe("/dashboard");
    });

    it("should fallback to /dashboard for empty or whitespace-only inputs", () => {
      expect(getSafeRedirectUrl("")).toBe("/dashboard");
      expect(getSafeRedirectUrl("   ")).toBe("/dashboard");
      // @ts-ignore
      expect(getSafeRedirectUrl(null)).toBe("/dashboard");
      // @ts-ignore
      expect(getSafeRedirectUrl(undefined)).toBe("/dashboard");
    });
  });

  describe("Whitelisted Hosts validation", () => {
    it("should allow default whitelisted hosts", () => {
      expect(getSafeRedirectUrl("http://localhost:13100")).toBe("http://localhost:13100");
      expect(getSafeRedirectUrl("http://localhost:13101")).toBe("http://localhost:13101");
      expect(getSafeRedirectUrl("http://localhost:13102")).toBe("http://localhost:13102");
      expect(getSafeRedirectUrl("http://localhost:13100/path")).toBe("http://localhost:13100/path");
      expect(getSafeRedirectUrl("https://localhost:13100/path?query=1")).toBe("https://localhost:13100/path?query=1");
    });

    it("should respect NEXT_PUBLIC environment variables", () => {
      process.env.NEXT_PUBLIC_PMI_URL = "https://pmi.topvnsport.com";
      process.env.NEXT_PUBLIC_OMS_URL = "https://oms.topvnsport.com";
      process.env.NEXT_PUBLIC_WMS_URL = "https://wms.topvnsport.com";

      expect(getSafeRedirectUrl("https://pmi.topvnsport.com/dashboard")).toBe("https://pmi.topvnsport.com/dashboard");
      expect(getSafeRedirectUrl("https://oms.topvnsport.com/orders")).toBe("https://oms.topvnsport.com/orders");
      expect(getSafeRedirectUrl("https://wms.topvnsport.com/inventory")).toBe("https://wms.topvnsport.com/inventory");

      // Old defaults should no longer be allowed if Env Url is parsed successfully, but wait, the implementation of getTrustedHost does fallback to defaultVal if URL parsing of envUrl fails.
      // Let's verify if the code falls back to localhost defaults if env is set correctly.
      // In redirect.ts, getTrustedHost(envUrl, defaultVal) returns envUrl's host if it parses, otherwise defaultVal's host.
      // So if envUrl is a valid URL, it should return its host, NOT default.
      // Let's see if localhost:13100 is still allowed when NEXT_PUBLIC_PMI_URL is set:
      // if targetHost matches pmiHost (which is pmi.topvnsport.com), it returns it. If it is localhost:13100, targetHost !== pmiHost, so it should fallback to dashboard.
      expect(getSafeRedirectUrl("http://localhost:13100")).toBe("/dashboard");
    });

    it("should fallback to /dashboard for non-whitelisted hosts", () => {
      expect(getSafeRedirectUrl("http://evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("https://google.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("http://localhost:3000")).toBe("/dashboard");
    });
  });

  describe("Control character bypasses", () => {
    it("should reject raw and encoded control characters (tab, newline, CR, null bytes)", () => {
      // Raw control characters
      expect(getSafeRedirectUrl("/dashboard\t")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard\n")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard\r")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard\0")).toBe("/dashboard");

      // Single encoded control characters
      expect(getSafeRedirectUrl("/dashboard%09")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard%0A")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard%0D")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard%00")).toBe("/dashboard");

      // Double encoded control characters
      expect(getSafeRedirectUrl("/dashboard%2509")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard%250A")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard%250D")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard%2500")).toBe("/dashboard");

      // Triple encoded control characters
      expect(getSafeRedirectUrl("/dashboard%252509")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard%25250A")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard%25250D")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard%252500")).toBe("/dashboard");
    });

    it("should test quadruple and multi-encoded control characters", () => {
      // Quadruple encoded control characters
      expect(getSafeRedirectUrl("/dashboard%25252509")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard%2525250A")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard%2525250D")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard%25252500")).toBe("/dashboard");
    });
  });

  describe("Obfuscation and double encoding", () => {
    it("should handle encoded slashes and backslashes correctly", () => {
      // Single encoded slashes/backslashes
      expect(getSafeRedirectUrl("%2Fdashboard")).toBe("/dashboard");
      expect(getSafeRedirectUrl("%5Cdashboard")).toBe("/dashboard");
      expect(getSafeRedirectUrl("http:%%2F%2Fevil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("http:%2F%2Fevil.com")).toBe("/dashboard");

      // Double encoded slashes/backslashes
      expect(getSafeRedirectUrl("%252Fdashboard")).toBe("/dashboard");
      expect(getSafeRedirectUrl("%255Cdashboard")).toBe("/dashboard");

      // Mixing encoding
      expect(getSafeRedirectUrl("/dashboard%2Fextra")).toBe("/dashboard/extra");
    });
  });

  describe("JavaScript/Data scheme injection", () => {
    it("should reject javascript: and data: and vbscript: schemes", () => {
      expect(getSafeRedirectUrl("javascript:alert(1)")).toBe("/dashboard");
      expect(getSafeRedirectUrl("javascript:alert(1)//")).toBe("/dashboard");
      expect(getSafeRedirectUrl("  javascript:alert(1)")).toBe("/dashboard");
      expect(getSafeRedirectUrl("jav&#x09;ascript:alert(1)")).toBe("/dashboard");
      expect(getSafeRedirectUrl("data:text/html,<script>alert(1)</script>")).toBe("/dashboard");
      expect(getSafeRedirectUrl("vbscript:msgbox(1)")).toBe("/dashboard");
      expect(getSafeRedirectUrl("javascript://evil.com/%0aalert(1)")).toBe("/dashboard");
    });
  });

  describe("Protocol-relative bypasses", () => {
    it("should reject standard and non-standard protocol-relative URLs", () => {
      expect(getSafeRedirectUrl("//evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("///evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("\\\\evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("\\/evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/\\evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("//\\evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("///\\evil.com")).toBe("/dashboard");
    });

    it("should reject encoded protocol-relative URLs", () => {
      expect(getSafeRedirectUrl("%2F%2Fevil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("%5C%5Cevil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("%2F%5Cevil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("%5C%2Fevil.com")).toBe("/dashboard");
    });

    it("should reject host-substring and host-confusion tricks", () => {
      expect(getSafeRedirectUrl("//localhost:13100.evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("http://localhost:13100.evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("http://evil.com?pmiHost=localhost:13100")).toBe("/dashboard");
      expect(getSafeRedirectUrl("http://evil.com#localhost:13100")).toBe("/dashboard");
      expect(getSafeRedirectUrl("http://localhost:13100@evil.com")).toBe("/dashboard");
    });
  });

  describe("Challenger 2 Stress Tests", () => {
    it("should reject Unicode normalization bypasses", () => {
      // Fullwidth characters
      expect(getSafeRedirectUrl("／／evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("＼＼evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("http：／／evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("javascript：alert(1)")).toBe("/dashboard");
      expect(getSafeRedirectUrl("／dashboard")).toBe("/dashboard");
      expect(getSafeRedirectUrl("＼dashboard")).toBe("/dashboard");

      // Unicode slash lookalikes
      expect(getSafeRedirectUrl("\uFF0F\uFF0Fevil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("\uFF3C\uFF3Cevil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("\uFF1A\uFF1Aevil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("\u2044\u2044evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("\u2215\u2215evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("\u29F5\u29F5evil.com")).toBe("/dashboard");
    });

    it("should reject C1 control characters and alternate space bypasses", () => {
      // C1 control characters (U+0080 to U+009F)
      expect(getSafeRedirectUrl("/dashboard\u0080")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard\u009f")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard%80")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard%9F")).toBe("/dashboard");

      // Unicode spaces
      expect(getSafeRedirectUrl("/dashboard\u00A0")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard\u2000")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard\u3000")).toBe("/dashboard");
    });

    it("should handle deep URL encoding recursion limits safely", () => {
      // 11 levels of URL-encoded backslash
      // %25%25%25%25%25%25%25%25%25%25%255C
      const elevenLevelBackslash = "%25%25%25%25%25%25%25%25%25%25%255C";
      expect(getSafeRedirectUrl(`/${elevenLevelBackslash}evil.com`)).toBe("/dashboard");

      // 11 levels of URL-encoded control character
      const elevenLevelTab = "%25%25%25%25%25%25%25%25%25%25%2509";
      expect(getSafeRedirectUrl(`/dashboard${elevenLevelTab}`)).toBe("/dashboard");

      // 11 levels of URL-encoded javascript scheme
      // javascript: is "javascript%3a"
      const elevenLevelColon = "%25%25%25%25%25%25%25%25%25%25%253a";
      expect(getSafeRedirectUrl(`javascript${elevenLevelColon}alert(1)`)).toBe("/dashboard");
    });

    it("should reject zero-width character and other invisible character bypasses", () => {
      // Zero Width Space (U+200B)
      expect(getSafeRedirectUrl("java\u200Bscript:alert(1)")).toBe("/dashboard");
      // Zero Width No-Break Space / BOM (U+FEFF)
      expect(getSafeRedirectUrl("java\uFEFFscript:alert(1)")).toBe("/dashboard");
      // Zero Width Joiner (U+200D)
      expect(getSafeRedirectUrl("java\u200Dscript:alert(1)")).toBe("/dashboard");
      // Zero Width Non-Joiner (U+200C)
      expect(getSafeRedirectUrl("java\u200Cscript:alert(1)")).toBe("/dashboard");
      
      // Encoded zero-width characters
      expect(getSafeRedirectUrl("java%E2%80%8Bscript:alert(1)")).toBe("/dashboard");
      expect(getSafeRedirectUrl("java%EF%BB%BFscript:alert(1)")).toBe("/dashboard");
    });
  });

  describe("Challenger M3 Gen 4 R3 Stress Tests", () => {
    it("should handle small solidus and small reverse solidus lookalikes (U+FE6F, U+FE68)", () => {
      // U+FE6F (∕) does not normalize under NFKC, so it is treated as a safe relative path.
      expect(getSafeRedirectUrl("\uFE6F\uFE6Fevil.com")).toBe("/%EF%B9%AF%EF%B9%AFevil.com");
      // U+FE68 (﹨) normalizes to backslash under NFKC and is correctly blocked.
      expect(getSafeRedirectUrl("\uFE68\uFE68evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("http:\uFE6F\uFE6Fevil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("http:\uFE68\uFE68evil.com")).toBe("/dashboard");
    });

    it("should reject URL-encoded forms of mathematical/fraction slash lookalikes", () => {
      // Fraction slash (U+2044) UTF-8: %E2%81%84
      expect(getSafeRedirectUrl("%E2%81%84%E2%81%84evil.com")).toBe("/dashboard");
      // Division slash (U+2215) UTF-8: %E2%88%95
      expect(getSafeRedirectUrl("%E2%88%95%E2%88%95evil.com")).toBe("/dashboard");
      // Reverse solidus operator (U+29F5) UTF-8: %E2%A7%B5
      expect(getSafeRedirectUrl("%E2%A7%B5%E2%A7%B5evil.com")).toBe("/dashboard");
    });

    it("should reject mixed-case scheme names with encoded or HTML-entity characters", () => {
      expect(getSafeRedirectUrl("j%61vascript:alert(1)")).toBe("/dashboard");
      expect(getSafeRedirectUrl("j%2561vascript:alert(1)")).toBe("/dashboard");
      expect(getSafeRedirectUrl("javascript&colon;alert(1)")).toBe("/dashboard");
      // &COLON; is not mapped in entities, so it is not decoded, but the resulting URL is a safe relative path starting with /
      expect(getSafeRedirectUrl("javascript&COLON;alert(1)")).toBe("/javascript&COLON;alert(1)");
      expect(getSafeRedirectUrl("java&Tab;script:alert(1)")).toBe("/dashboard");
      expect(getSafeRedirectUrl("java&NewLine;script:alert(1)")).toBe("/dashboard");
    });

    it("should handle nested backslash path traversals properly", () => {
      // Relative path traversals are safely resolved to relative paths on the same domain
      expect(getSafeRedirectUrl("/foo/..\\..\\evil.com")).toBe("/evil.com");
      expect(getSafeRedirectUrl("/foo/..\uFE68..\uFE68evil.com")).toBe("/evil.com");
      expect(getSafeRedirectUrl("/foo/..%5C..%5Cevil.com")).toBe("/evil.com");
      expect(getSafeRedirectUrl("/foo/..%255C..%255Cevil.com")).toBe("/evil.com");
    });

    it("should block userinfo authority bypasses targeting trusted domains", () => {
      // Credentials pointing to trusted, host is evil
      expect(getSafeRedirectUrl("http://localhost:13100@evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("http://localhost:13100:password@evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("https://pmi.topvnsport.com@evil.com")).toBe("/dashboard");
      
      // Host is trusted, but has credential prefix (this is technically allowed since destination is trusted, but checking behavior)
      expect(getSafeRedirectUrl("http://evil.com@localhost:13100")).toBe("http://evil.com@localhost:13100");
    });

    it("should block non-standard host suffix tricks", () => {
      expect(getSafeRedirectUrl("http://localhost:13100.evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("http://localhost:13100-evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("http://localhost:13100/localhost:13100")).toBe("http://localhost:13100/localhost:13100");
    });
  });

  describe("Challenger 2 M3 Gen 4 R3 Ad-hoc Stress Tests", () => {
    it("should handle HTML-entity solidus/reverse-solidus bypasses (rendered safely as relative paths)", () => {
      // HTML entity slashes (&sol;, &#x2f;, &#47;) are not decoded in the path validation phase, resolving to safe relative paths starting with /
      expect(getSafeRedirectUrl("&sol;&sol;evil.com")).toBe("/&sol;&sol;evil.com");
      expect(getSafeRedirectUrl("&#x2f;&#x2f;evil.com")).toBe("/&#x2f;&#x2f;evil.com");
      expect(getSafeRedirectUrl("&#47;&#47;evil.com")).toBe("/&#47;&#47;evil.com");
      expect(getSafeRedirectUrl("&sol;&sol;localhost:13100")).toBe("/&sol;&sol;localhost:13100");
      
      // HTML entity backslashes (&bsol;, &#x5c;, &#92;)
      expect(getSafeRedirectUrl("&bsol;&bsol;evil.com")).toBe("/&bsol;&bsol;evil.com");
      expect(getSafeRedirectUrl("&#x5c;&#x5c;evil.com")).toBe("/&#x5c;&#x5c;evil.com");
      expect(getSafeRedirectUrl("&#92;&#92;evil.com")).toBe("/&#92;&#92;evil.com");
    });

    it("should reject raw or encoded C0/C1 control and separator characters", () => {
      // Line separators
      expect(getSafeRedirectUrl("/dashboard\u2028")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard\u2029")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard%E2%80%A8")).toBe("/dashboard"); // UTF-8 encoded U+2028
      expect(getSafeRedirectUrl("/dashboard%E2%80%A9")).toBe("/dashboard"); // UTF-8 encoded U+2029

      // Next Line (NEL) U+0085
      expect(getSafeRedirectUrl("/dashboard\u0085")).toBe("/dashboard");
      expect(getSafeRedirectUrl("/dashboard%C2%85")).toBe("/dashboard"); // UTF-8 encoded U+0085
    });

    it("should block host authority confusion via nested protocols", () => {
      expect(getSafeRedirectUrl("https://localhost:13100:https://evil.com")).toBe("/dashboard");
      expect(getSafeRedirectUrl("https://localhost:13100/https://evil.com")).toBe("https://localhost:13100/https://evil.com");
      expect(getSafeRedirectUrl("http://localhost:13100?url=https://evil.com")).toBe("http://localhost:13100?url=https://evil.com");
    });

    it("should reject Unicode lookalikes for colon and at sign", () => {
      // Unicode fullwidth colon normalizes to colon under NFKC, which resolves to safe whitelisted host
      expect(getSafeRedirectUrl("http：//localhost:13100")).toBe("http://localhost:13100");
      // Unicode fullwidth commercial at normalizes to @, which exposes evil.com host and is correctly blocked
      expect(getSafeRedirectUrl("http://localhost:13100＠evil.com")).toBe("/dashboard");
    });
  });
});



