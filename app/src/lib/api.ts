import { demoApi } from '@/demo/demoApi';
import { ApiError } from '@/lib/apiError';
import type {
  AdminStats,
  AdminUser,
  GeoPoint,
  PlaceItem,
  Restaurant,
  RestaurantFieldsInput,
  Submission,
  SubmissionListResult,
  SubmissionStatus,
  SubmissionStatusView,
  SubmitPayload,
} from '@/types';

export { ApiError };

interface Envelope<T> {
  ok: true;
  data: T;
}

interface ErrorEnvelope {
  ok: false;
  error: { code: string; message: string; fields?: Record<string, string> };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...((init.headers as Record<string, string>) || {}),
    },
  });

  const payload = (await response.json().catch(() => null)) as Envelope<T> | ErrorEnvelope | null;

  if (!response.ok || !payload || payload.ok !== true) {
    const error = payload && payload.ok === false ? payload.error : null;
    throw new ApiError(
      response.status,
      error ? error.code : 'NETWORK',
      error ? error.message : '网络请求失败，请稍后再试',
      error ? error.fields : undefined,
    );
  }

  return payload.data;
}

function jsonBody(body: unknown): RequestInit {
  return { method: 'POST', body: JSON.stringify(body ?? {}) };
}

function patchBody(body: unknown): RequestInit {
  return { method: 'PATCH', body: JSON.stringify(body ?? {}) };
}

const httpApi = {
  listRestaurants: () => request<Restaurant[]>('/api/restaurants'),

  submit: (payload: SubmitPayload) => request<{ code: string; id: string }>('/api/submissions', jsonBody(payload)),

  geoConfig: () =>
    request<{ searchEnabled: boolean; office: (GeoPoint & { name: string; calibrated?: boolean }) | null }>(
      '/api/geo/config',
    ),

  geoSearch: (keyword: string) =>
    request<{ enabled: boolean; items: PlaceItem[] }>('/api/geo/search?q=' + encodeURIComponent(keyword)),

  geoEstimate: (lat: number, lng: number) =>
    request<{ minutes: number; meters: number; direction: string }>(
      '/api/geo/estimate?lat=' + lat + '&lng=' + lng,
    ),

  geoReverse: (lng: number, lat: number) =>
    request<{ enabled: boolean; result: { address: string } | null }>(
      '/api/geo/reverse?lng=' + lng + '&lat=' + lat,
    ),

  submissionStatus: (code: string) =>
    request<SubmissionStatusView>('/api/submissions/' + encodeURIComponent(code)),

  admin: {
    login: (username: string, password: string) =>
      request<AdminUser>('/api/admin/login', jsonBody({ username, password })),

    logout: () => request<{ ok: boolean }>('/api/admin/logout', jsonBody({})),

    me: () => request<AdminUser>('/api/admin/me'),

    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ ok: boolean }>('/api/admin/me/password', jsonBody({ currentPassword, newPassword })),

    stats: () => request<AdminStats>('/api/admin/stats'),

    getSettings: () =>
      request<{ office: GeoPoint & { name: string; calibrated?: boolean } }>('/api/admin/settings'),

    updateSettings: (office: GeoPoint & { name?: string }) =>
      request<{ office: GeoPoint & { name: string } }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(office),
      }),

    submissions: (params: { status?: SubmissionStatus | 'all'; q?: string; page?: number } = {}) => {
      const search = new URLSearchParams();
      if (params.status && params.status !== 'all') search.set('status', params.status);
      if (params.q) search.set('q', params.q);
      if (params.page) search.set('page', String(params.page));
      const query = search.toString();
      return request<SubmissionListResult>('/api/admin/submissions' + (query ? '?' + query : ''));
    },

    submission: (id: string) => request<Submission>('/api/admin/submissions/' + encodeURIComponent(id)),

    updateSubmission: (id: string, fields: RestaurantFieldsInput) =>
      request<Submission>('/api/admin/submissions/' + encodeURIComponent(id), patchBody(fields)),

    approve: (id: string, fields?: RestaurantFieldsInput) =>
      request<{ submission: Submission; restaurant: Restaurant }>(
        '/api/admin/submissions/' + encodeURIComponent(id) + '/approve',
        jsonBody(fields ?? {}),
      ),

    reject: (id: string, reason: string) =>
      request<Submission>('/api/admin/submissions/' + encodeURIComponent(id) + '/reject', jsonBody({ reason })),

    restaurants: () => request<Restaurant[]>('/api/admin/restaurants'),

    updateRestaurant: (
      id: number,
      patch: Partial<RestaurantFieldsInput> & {
        status?: 'published' | 'offline';
        alert?: string | null;
        far?: boolean;
        x?: number;
        y?: number;
        lat?: number | null;
        lng?: number | null;
      },
    ) =>
      request<Restaurant>('/api/admin/restaurants/' + id, patchBody(patch)),

    accounts: () => request<AdminUser[]>('/api/admin/accounts'),

    createAccount: (payload: { username: string; password: string; role: 'super' | 'reviewer' }) =>
      request<AdminUser>('/api/admin/accounts', jsonBody(payload)),

    updateAccount: (
      id: string,
      patch: { password?: string; role?: 'super' | 'reviewer'; disabled?: boolean },
    ) => request<AdminUser>('/api/admin/accounts/' + encodeURIComponent(id), patchBody(patch)),
  },
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return '未知错误，请稍后再试';
}

/** 演示模式：`vite build --mode demo`（见 app/.env.demo）时把 /api 换成前端实现。 */
export const DEMO_MODE = import.meta.env.VITE_DEMO === '1';

export const api: typeof httpApi = DEMO_MODE ? (demoApi as unknown as typeof httpApi) : httpApi;