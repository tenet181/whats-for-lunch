export type Direction = '华阳' | '正兴' | '万安' | '略远';

export const DIRECTIONS: Direction[] = ['华阳', '正兴', '万安', '略远'];

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface PlaceItem extends GeoPoint {
  id: string;
  name: string;
  address: string;
  district: string;
}

export interface Restaurant {
  id: number;
  name: string;
  direction: Direction;
  signature: string[];
  perCapita: number | null;
  driveTime: string;
  address: string;
  note: string;
  alert?: string | null;
  dp?: string | null;
  imageUrl?: string | null;
  far?: boolean;
  x: number;
  y: number;
  labelDx?: number;
  labelDy?: number;
  labelAnchor?: 'start' | 'middle' | 'end';
  lat?: number | null;
  lng?: number | null;
  createdAt?: string | null;
  status?: 'published' | 'offline';
  source?: 'seed' | 'submission';
  submissionId?: string | null;
  updatedAt?: string | null;
}

/** 表单可编辑的餐馆字段（前后端同名） */
export interface RestaurantFieldsInput {
  name: string;
  direction: Direction | '';
  address: string;
  signature: string[];
  perCapita: number | null;
  driveTime: string;
  note: string;
  dp: string;
  imageUrl: string;
}

export function emptyRestaurantFields(): RestaurantFieldsInput {
  return {
    name: '',
    direction: '',
    address: '',
    signature: [],
    perCapita: null,
    driveTime: '',
    note: '',
    dp: '',
    imageUrl: '',
  };
}

export interface SubmitPayload extends RestaurantFieldsInput {
  /** 地图选点（GCJ-02 真实坐标） */
  lat: number;
  lng: number;
  website?: string;
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface SubmissionReview {
  by: string;
  at: string;
  reason: string | null;
  edited?: boolean;
}

export interface SubmissionHistoryItem {
  at: string;
  action: string;
  by?: string | null;
  note?: string | null;
}

export interface Submission {
  id: string;
  code: string;
  status: SubmissionStatus;
  data: RestaurantFieldsInput;
  /** 已停用，保留字段兼容历史数据 */
  submitter?: { nickname: string | null; contact: string | null } | null;
  /** 填报表单里的地图选点（新数据为 lat/lng，老数据是示意图 x/y） */
  pick?: ({ lat: number; lng: number } | { x: number; y: number }) | null;
  review: SubmissionReview | null;
  restaurantId: number | null;
  history: SubmissionHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionStatusView {
  code: string;
  status: SubmissionStatus;
  name: string;
  direction: Direction;
  address: string;
  signature: string[];
  createdAt: string;
  reviewedAt: string | null;
  rejectReason: string | null;
  restaurantId: number | null;
  history: { at: string; action: string }[];
}

export interface AdminUser {
  id: string;
  username: string;
  role: 'super' | 'reviewer';
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminStats {
  pending: number;
  approved: number;
  rejected: number;
  published: number;
  offline: number;
  newThisWeek: number;
}

export interface SubmissionListResult {
  items: Submission[];
  total: number;
  page: number;
  pageSize: number;
  counts: { pending: number; approved: number; rejected: number };
}