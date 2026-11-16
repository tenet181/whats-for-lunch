import seed from '../../shared/seed-restaurants.json';
import type { Direction, GeoPoint, Restaurant } from '@/types';

/** 演示版没有后端，位置换算统一用这份默认公司位置（与 server/geo.js 的 DEFAULT_OFFICE 一致）。 */
export const DEMO_OFFICE: GeoPoint & { name: string; calibrated: true } = {
  name: '麓坊中心',
  lat: 30.463952,
  lng: 104.057786,
  calibrated: true,
};

interface SeedRestaurant {
  id: number;
  name: string;
  direction: string;
  signature?: string[];
  perCapita?: number | null;
  driveTime?: string;
  address?: string;
  note?: string;
  alert?: string | null;
  dp?: string | null;
  imageUrl?: string | null;
  x: number;
  y: number;
  labelDx?: number;
  labelDy?: number;
  labelAnchor?: 'start' | 'middle' | 'end';
  lat?: number | null;
  lng?: number | null;
}

function driveMinutes(text: string | undefined): number | null {
  const match = String(text ?? '').match(/\d+/);
  if (!match) return null;
  return Number(match[0]);
}

/** 把种子数据转成 /api/restaurants 返回的同一形状，页面代码完全不用改。 */
export const demoRestaurants: Restaurant[] = (seed as unknown as SeedRestaurant[]).map((item) => {
  const minutes = driveMinutes(item.driveTime);
  return {
    id: item.id,
    name: item.name,
    direction: item.direction as Direction,
    signature: item.signature ?? [],
    perCapita: item.perCapita ?? null,
    driveTime: item.driveTime ?? '待确认',
    address: item.address ?? '',
    note: item.note ?? '',
    alert: item.alert ?? null,
    dp: item.dp ?? null,
    imageUrl: item.imageUrl ?? null,
    far: !(minutes !== null && minutes <= 15),
    x: item.x,
    y: item.y,
    labelDx: item.labelDx,
    labelDy: item.labelDy,
    labelAnchor: item.labelAnchor,
    lat: item.lat ?? null,
    lng: item.lng ?? null,
    status: 'published',
    source: 'seed',
  };
});