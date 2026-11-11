const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export async function apiRequest(path, accessToken, options = {}) {
  if (!accessToken) throw new Error('Sign in to use this Mavora service.');

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (response.status === 204) return null;
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Mavora could not complete that request.');
  return result;
}