export const WMS_API_URL = process.env.NEXT_PUBLIC_WMS_API_URL || "http://localhost:18102";

export async function wmsFetch(path: string, options?: RequestInit) {
  const url = `${WMS_API_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `API error: ${response.status}`);
  }
  return response.json();
}
