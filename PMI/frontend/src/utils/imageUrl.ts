const INTERNAL_MEDIA_HOSTS = new Set(["minio", "db", "api", "pim-minio"]);

export function normalizeImageUrl(imageUrl?: string | null): string | undefined {
  if (!imageUrl) {
    return undefined;
  }

  if (typeof window === "undefined") {
    return imageUrl;
  }

  try {
    const parsed = new URL(imageUrl);

    // Rewrite Docker-internal MinIO URLs so browser can access images.
    if (INTERNAL_MEDIA_HOSTS.has(parsed.hostname) && parsed.port === "9000") {
      return `${window.location.protocol}//${window.location.hostname}:19005${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return parsed.toString();
  } catch {
    return imageUrl;
  }
}
