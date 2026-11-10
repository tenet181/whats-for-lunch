export const MAP = { width: 680, height: 330, minX: 45, maxX: 635, minY: 45, maxY: 285 };
const MIN_DIST = 28;
const GOLDEN_ANGLE = 2.399963229728653;

const ANCHORS = {
  华阳: { x: 330, y: 95 },
  正兴: { x: 130, y: 265 },
  万安: { x: 555, y: 95 },
  略远: { x: 430, y: 300 },
};

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

function hashAngle(text) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) {
    h = (h * 31 + text.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 360) * (Math.PI / 180);
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 为一家新店在示意图上找落点：
 * 以方向锚点为圆心做黄金角螺旋，取第一个与已有点距离 >= 28 的候选点。
 */
export function placeOnMap(direction, existingPoints, seedText = '') {
  const anchor = ANCHORS[direction] || ANCHORS['华阳'];
  const points = Array.isArray(existingPoints) ? existingPoints : [];
  const start = hashAngle(String(seedText || '') + direction);

  for (let k = 0; k < 240; k += 1) {
    const angle = start + k * GOLDEN_ANGLE;
    const radius = 6 + 4.2 * Math.sqrt(k);
    const x = clamp(anchor.x + Math.cos(angle) * radius, MAP.minX, MAP.maxX);
    const y = clamp(anchor.y + Math.sin(angle) * radius, MAP.minY, MAP.maxY);
    const candidate = { x: Math.round(x), y: Math.round(y) };
    if (points.every((p) => distance(p, candidate) >= MIN_DIST)) return candidate;
  }

  return {
    x: Math.round(clamp(anchor.x, MAP.minX, MAP.maxX)),
    y: Math.round(clamp(anchor.y, MAP.minY, MAP.maxY)),
  };
}

/**
 * 由示意图坐标反推方向。必须与前端 src/lib/geo.ts 保持一致。
 */
export function directionForPoint(x, y) {
  const dx = Number(x) - 340;
  const dy = Number(y) - 170;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return '华阳';
  if (dist <= 100) return '华阳';
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (deg >= -85 && deg <= -10 && dx > 120) return '万安';
  if (deg > 110 && deg <= 180) return '正兴';
  if (deg >= 20 && deg <= 110 && dx > 40) return '略远';
  if (dy > 60) return '略远';
  return '华阳';
}

export function clampPoint(x, y) {
  const nx = Number(x);
  const ny = Number(y);
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
  return {
    x: Math.round(clamp(nx, MAP.minX, MAP.maxX)),
    y: Math.round(clamp(ny, MAP.minY, MAP.maxY)),
  };
}
