import type { Direction } from '@/types';

export interface GeoPoint {
  lat: number;
  lng: number;
}

/* ---------- 坐标系转换（GCJ-02 底图用） ---------- */
const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function outOfChina(lat: number, lng: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
}

/** 浏览器/手机 GPS 给的是 WGS-84，高德底图是 GCJ-02，不转会有几百米偏移 */
export function wgs84ToGcj02(lat: number, lng: number): GeoPoint {
  if (outOfChina(lat, lng)) return { lat, lng };
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);
  return { lat: lat + dLat, lng: lng + dLng };
}

/* ---------- 与示意图的换算（仅展示用，服务端是权威） ---------- */
const METERS_PER_MINUTE = 400;
const PX_PER_MINUTE = 11;
const CENTER_PX = { x: 340, y: 170 };
const EARTH_RADIUS = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDegrees(a: GeoPoint, b: GeoPoint): number {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function directionFromBearing(bearing: number): Direction {
  if (bearing >= 45 && bearing < 135) return '万安';
  if (bearing >= 135 && bearing < 200) return '略远';
  if (bearing >= 200 && bearing < 315) return '正兴';
  return '华阳';
}

export function schematicFromGeo(point: GeoPoint, office: GeoPoint) {
  const meters = distanceMeters(office, point);
  const bearing = bearingDegrees(office, point);
  const px = (meters / METERS_PER_MINUTE) * PX_PER_MINUTE;
  const rad = toRad(bearing);
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  return {
    x: Math.round(clamp(CENTER_PX.x + Math.sin(rad) * px, 45, 635)),
    y: Math.round(clamp(CENTER_PX.y - Math.cos(rad) * px, 45, 285)),
    minutes: Math.max(1, Math.round(meters / METERS_PER_MINUTE)),
    direction: directionFromBearing(bearing),
    meters: Math.round(meters),
  };
}

/* ---------- 导航跳转 ---------- */
/** GCJ-02 → BD-09（百度用） */
export function gcj02ToBd09(lat: number, lng: number): GeoPoint {
  const x = lng;
  const y = lat;
  const z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * Math.PI);
  const theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * Math.PI);
  return { lat: z * Math.sin(theta) + 0.006, lng: z * Math.cos(theta) + 0.0065 };
}

export interface NavigationTargets {
  amap: { ios: string; android: string; web: string };
  baidu: { app: string; web: string };
}

export function navigationTargets(name: string, point: GeoPoint): NavigationTargets {
  const nameEnc = encodeURIComponent(name);
  const lat = point.lat.toFixed(6);
  const lng = point.lng.toFixed(6);
  const bd = gcj02ToBd09(point.lat, point.lng);
  const bdLat = bd.lat.toFixed(6);
  const bdLng = bd.lng.toFixed(6);

  return {
    amap: {
      ios: 'iosamap://path?sourceApplication=lunch-picker&dlat=' + lat + '&dlon=' + lng + '&dname=' + nameEnc + '&dev=0&t=0',
      android:
        'androidamap://route?sourceApplication=lunch-picker&dlat=' + lat + '&dlon=' + lng + '&dname=' + nameEnc + '&dev=0&t=0',
      web:
        'https://uri.amap.com/navigation?to=' + lng + ',' + lat + ',' + nameEnc + '&mode=car&coordinate=gaode&callnative=1&src=lunch-picker',
    },
    baidu: {
      app:
        'baidumap://map/direction?destination=latlng:' + bdLat + ',' + bdLng + '|name:' + nameEnc + '&coord_type=bd09ll&mode=driving&src=webapp.lunch-picker',
      web:
        'https://api.map.baidu.com/direction?origin=&destination=latlng:' + bdLat + ',' + bdLng + '|name:' + nameEnc + '&mode=driving&coord_type=bd09ll&output=html&src=webapp.lunch-picker',
    },
  };
}
