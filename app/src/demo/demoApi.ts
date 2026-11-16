import { ApiError } from '@/lib/apiError';
import { bearingDegrees, directionFromBearing, distanceMeters } from '@/lib/geo';
import { DEMO_OFFICE, demoRestaurants } from '@/demo/demoData';
import type {
  Direction,
  GeoPoint,
  PlaceItem,
  Restaurant,
  Submission,
  SubmissionListResult,
  SubmissionStatus,
  SubmissionStatusView,
  SubmitPayload,
  AdminStats,
  AdminUser,
} from '@/types';

/**
 * 演示模式：GitHub Pages 只托管静态文件，跑不了 Express，所以这里把
 * /api/* 换成前端实现——店铺数据来自种子文件，提交与查询存在 localStorage。
 * 目的只是「打开就能点」，完整功能（审核、账号、真实存储）仍需本地跑。
 */

const STORAGE_KEY = 'whats-for-lunch-demo-submissions-v1';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface DemoSubmissionRecord {
  code: string;
  createdAt: string;
  payload: SubmitPayload;
  direction: Direction;
  status: SubmissionStatus;
}

function readRecords(): DemoSubmissionRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DemoSubmissionRecord[]) : [];
  } catch {
    return [];
  }
}

function writeRecords(records: DemoSubmissionRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // 隐私模式下写不进去，就当这一次没保存
  }
}

function createCode(existing: Set<string>): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = '';
    for (let index = 0; index < 6; index += 1) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    if (!existing.has(code)) return code;
  }
  return 'DEMO00';
}

function directionFor(point: GeoPoint): Direction {
  return directionFromBearing(bearingDegrees(DEMO_OFFICE, point));
}

function estimate(point: GeoPoint): { minutes: number; meters: number; direction: Direction } {
  const meters = Math.round(distanceMeters(DEMO_OFFICE, point));
  const minutes = Math.max(1, Math.round(meters / 250));
  return { minutes, meters, direction: directionFor(point) };
}

const DEMO_ADMIN_MESSAGE =
  '演示版没有后台审核：店铺数据打包在前端，提交记录只存在这台浏览器。想体验审核、账号、车程校准，请按 README 在本地跑完整版（npm run dev）。';

function adminUnavailable(): never {
  throw new ApiError(503, 'DEMO_MODE', DEMO_ADMIN_MESSAGE);
}

export const demoApi = {
  listRestaurants: async (): Promise<Restaurant[]> => demoRestaurants,

  submit: async (payload: SubmitPayload): Promise<{ code: string; id: string }> => {
    const records = readRecords();
    const duplicate = records.some(
      (record) => record.status !== 'rejected' && record.payload.name.trim() === payload.name.trim(),
    );
    if (duplicate) {
      throw new ApiError(409, 'DUPLICATE', '这个店名已经报过了，等管理员审一下就行', {
        name: '这个店名已经报过了',
      });
    }

    const code = createCode(new Set(records.map((record) => record.code)));
    const record: DemoSubmissionRecord = {
      code,
      createdAt: new Date().toISOString(),
      payload,
      direction: directionFor({ lat: payload.lat, lng: payload.lng }),
      status: 'pending',
    };
    writeRecords([...records, record]);
    return { code, id: 'demo-' + code.toLowerCase() };
  },

  geoConfig: async (): Promise<{
    searchEnabled: boolean;
    office: (GeoPoint & { name: string; calibrated?: boolean }) | null;
  }> => ({ searchEnabled: false, office: DEMO_OFFICE }),

  geoSearch: async (): Promise<{ enabled: boolean; items: PlaceItem[] }> => ({ enabled: false, items: [] }),

  geoEstimate: async (lat: number, lng: number) => estimate({ lat, lng }),

  geoReverse: async (): Promise<{ enabled: boolean; result: { address: string } | null }> => ({
    enabled: false,
    result: null,
  }),

  submissionStatus: async (code: string): Promise<SubmissionStatusView> => {
    const record = readRecords().find((item) => item.code === code.toUpperCase());
    if (!record) {
      throw new ApiError(404, 'NOT_FOUND', '没找到这个提交码，检查一下是不是敲错了');
    }
    return {
      code: record.code,
      status: record.status,
      name: record.payload.name,
      direction: record.direction,
      address: record.payload.address,
      signature: record.payload.signature,
      createdAt: record.createdAt,
      reviewedAt: null,
      rejectReason: null,
      restaurantId: null,
      history: [{ at: record.createdAt, action: 'submitted' }],
    };
  },

  admin: {
    login: async (): Promise<AdminUser> => adminUnavailable(),
    logout: async (): Promise<{ ok: boolean }> => ({ ok: true }),
    // 401 会被 AdminAuthProvider 当成「未登录」，于是后台页显示登录表单再给出提示
    me: async (): Promise<AdminUser> => {
      throw new ApiError(401, 'UNAUTHORIZED', '演示版没有后台登录');
    },
    changePassword: async (): Promise<{ ok: boolean }> => adminUnavailable(),
    stats: async (): Promise<AdminStats> => adminUnavailable(),
    getSettings: async (): Promise<{ office: GeoPoint & { name: string } }> => adminUnavailable(),
    updateSettings: async (): Promise<{ office: GeoPoint & { name: string } }> => adminUnavailable(),
    submissions: async (): Promise<SubmissionListResult> =>
      adminUnavailable() as unknown as SubmissionListResult,
    submission: async (): Promise<Submission> => adminUnavailable(),
    updateSubmission: async (): Promise<Submission> => adminUnavailable(),
    approve: async (): Promise<{ submission: Submission; restaurant: Restaurant }> => adminUnavailable(),
    reject: async (): Promise<Submission> => adminUnavailable(),
    restaurants: async (): Promise<Restaurant[]> => adminUnavailable(),
    updateRestaurant: async (): Promise<Restaurant> => adminUnavailable(),
    accounts: async (): Promise<AdminUser[]> => adminUnavailable(),
    createAccount: async (): Promise<AdminUser> => adminUnavailable(),
    updateAccount: async (): Promise<AdminUser> => adminUnavailable(),
  },
};

export type DemoApi = typeof demoApi;