export type Location = { id: string; name: string; address: string; city: string; description: string | null };
export type Room = { id: string; location_id: string; name: string; description: string | null; type: 'meeting_room' | 'workspace'; capacity: number; is_active: boolean; image_url: string | null };
export type User = { id: string; email: string; full_name: string; role: string | null; is_blocked: boolean };
export type Booking = { id: string; room_id: string; user_id: string; start_time: string; end_time: string; status: string };

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export function getToken(): string | null { return sessionStorage.getItem('token'); }
export function setToken(value: string | null): void {
  if (value) sessionStorage.setItem('token', value);
  else sessionStorage.removeItem('token');
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(apiBase + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...options.headers
    }
  });
  if (!response.ok) {
    const body: { detail?: unknown } = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === 'string' ? body.detail : 'Ошибка запроса (' + response.status + ')');
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
