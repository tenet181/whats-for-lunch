/**
 * 真实坐标（GCJ-02）与示意图坐标之间的换算，以及高德 Web 服务代理。
 */

const METERS_PER_MINUTE = 400;
const PX_PER_MINUTE = 11;
const EARTH_RADIUS = 6371000;
const CENTER_PX = { x: 340, y: 170 };
export const SCHEMATIC = { minX: 45, maxX: 635, minY: 45, maxY: 285 };

/** 麓坊中心的兜底坐标（管理员可在后台校准） */
export const DEFAULT_OFFICE = { name: '麓坊中心', lat: 30.463952, lng: 104.057786, calibrated: true };

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDegrees(a, b) {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function directionFromBearing(bearing) {
  if (bearing >= 45 && bearing < 135) return '万安';
  if (bearing >= 135 && bearing < 200) return '略远';
  if (bearing >= 200 && bearing < 315) return '正兴';
  return '华阳';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** 由真实坐标换算示意图上的落点、方向和分钟数 */
export function schematicFromGeo(point, office = DEFAULT_OFFICE) {
  const meters = haversineMeters(office, point);
  const bearing = bearingDegrees(office, point);
  const distancePx = meters / METERS_PER_MINUTE * PX_PER_MINUTE;
  const rad = toRad(bearing);
  return {
    x: Math.round(clamp(CENTER_PX.x + Math.sin(rad) * distancePx, SCHEMATIC.minX, SCHEMATIC.maxX)),
    y: Math.round(clamp(CENTER_PX.y - Math.cos(rad) * distancePx, SCHEMATIC.minY, SCHEMATIC.maxY)),
    minutes: Math.max(1, Math.round(meters / METERS_PER_MINUTE)),
    direction: directionFromBearing(bearing),
    meters: Math.round(meters),
  };
}

function amapKey() {
  return process.env.AMAP_WEB_KEY || '';
}

export function geoSearchEnabled() {
  return Boolean(amapKey());
}

async function amapGet(path, params, attempt = 1) {
  const url = new URL('https://restapi.amap.com' + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  url.searchParams.set('key', amapKey());
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error('高德接口返回 ' + response.status);
    const payload = await response.json();
    if (payload.status !== '1') {
      throw new Error('高德接口错误：' + (payload.info || 'unknown'));
    }
    return payload;
  } catch (err) {
    if (attempt < 2) return amapGet(path, params, attempt + 1);
    throw err;
  }
}

export async function searchPlaces(keyword, city = '成都') {
  if (!geoSearchEnabled()) return [];
  const payload = await amapGet('/v3/place/text', {
    keywords: keyword,
    city,
    citylimit: 'true',
    offset: 10,
    page: 1,
    extensions: 'base',
  });
  const pois = Array.isArray(payload.pois) ? payload.pois : [];
  return pois
    .map((poi) => {
      const [lng, lat] = String(poi.location || '').split(',').map(Number);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
      return {
        id: String(poi.id || ''),
        name: String(poi.name || ''),
        address: String(poi.address || ''),
        district: [poi.pname, poi.cityname, poi.adname].filter(Boolean).join(' '),
        lng,
        lat,
      };
    })
    .filter(Boolean);
}

export async function reverseGeocode(lng, lat) {
  if (!geoSearchEnabled()) return null;
  const payload = await amapGet('/v3/geocode/regeo', {
    location: lng + ',' + lat,
    extensions: 'base',
    radius: 500,
  });
  const regeocode = payload.regeocode;
  if (!regeocode) return null;
  const formatted = String(regeocode.formatted_address || '');
  const pois = Array.isArray(regeocode.pois) ? regeocode.pois : [];
  return {
    address: formatted,
    poi: pois[0]
      ? {
          name: String(pois[0].name || ''),
          distance: Number(pois[0].distance) || null,
        }
      : null,
  };
}