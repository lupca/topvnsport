const IDENTITY_URL = process.env.NEXT_PUBLIC_IDENTITY_URL || 'http://localhost:13110';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

export function setAccessToken(token: string): void {
  localStorage.setItem('access_token', token);
}

export function removeAccessToken(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_username');
  localStorage.removeItem('user_role');
}

export function redirectToLogin(): void {
  const currentUrl = encodeURIComponent(window.location.href);
  window.location.href = `${IDENTITY_URL}/login?redirect=${currentUrl}`;
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${IDENTITY_URL.replace('identity.', 'api-identity.')}/auth/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${IDENTITY_URL.replace('identity.', 'api-identity.')}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (res.ok) {
      const data = await res.json();
      setAccessToken(data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
      }
      return data.access_token;
    }
  } catch {
    // Refresh failed
  }

  return null;
}

export function handleAuthCallback(): boolean {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const refreshToken = params.get('refresh_token');
  const userId = params.get('user_id');
  const username = params.get('username');
  const role = params.get('role');

  if (token) {
    setAccessToken(token);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    if (userId) localStorage.setItem('user_id', userId);
    if (username) localStorage.setItem('user_username', username);
    if (role) localStorage.setItem('user_role', role);

    // Clean URL
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    url.searchParams.delete('refresh_token');
    url.searchParams.delete('user_id');
    url.searchParams.delete('username');
    url.searchParams.delete('role');
    window.history.replaceState({}, '', url.toString());

    return true;
  }

  return false;
}

export function logout(): void {
  removeAccessToken();
  redirectToLogin();
}
