export type Location = { id: string; name: string; address: string; city: string; description: string | null };
export type Room = { id: string; location_id: string; name: string; description: string | null; type: 'meeting_room' | 'workspace'; capacity: number; is_active: boolean; image_url: string | null };
export type User = { id: string; email: string; full_name: string; role: string | null; is_blocked: boolean };
export type Booking = { id: string; room_id: string; user_id: string; start_time: string; end_time: string; status: string };

const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '/api');

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

export type Page<T> = { items: T[]; page: number; page_size: number; pages: number; total: number };
export type Amenity = { id: string; name: string; description: string | null };
export type AdminStats = { users: number; locations: number; rooms: number; confirmed_bookings: number; cancelled_bookings: number };
export const imageUrl = (path: string | null) => path ? (path.startsWith('/') ? apiBase + path : path) : null;

export async function uploadRoomImage(roomId: string, file: File): Promise<Room> {
  const body = new FormData();
  body.append('file', file);
  const token = getToken();
  const res = await fetch(apiBase + '/rooms/' + roomId + '/image', {
    method: 'POST', body, headers: token ? { Authorization: 'Bearer ' + token } : {}
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(typeof payload.detail === 'string' ? payload.detail : 'Ошибка загрузки (' + res.status + ')');
  }
  return res.json() as Promise<Room>;
}
