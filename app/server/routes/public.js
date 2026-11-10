import express from 'express';
import crypto from 'node:crypto';
import { ok, fail, clientIp } from '../http.js';
import { validateSubmission, normalizeName, normalizeDriveTime, driveMinutes } from '../validate.js';
import { clampPoint, directionForPoint } from '../placement.js';
import {
  DEFAULT_OFFICE,
  geoSearchEnabled,
  reverseGeocode,
  schematicFromGeo,
  searchPlaces,
} from '../geo.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeCode(state) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    let code = '';
    for (let i = 0; i < 6; i += 1) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    if (!state.submissions.some((item) => item.code === code)) return code;
  }
  throw new Error('生成提交码失败，请重试');
}

export function publicRestaurant(restaurant) {
  return {
    id: restaurant.id,
    name: restaurant.name,
    direction: restaurant.direction,
    signature: restaurant.signature,
    perCapita: restaurant.perCapita,
    driveTime: normalizeDriveTime(restaurant.driveTime),
    address: restaurant.address,
    note: restaurant.note,
    alert: restaurant.alert || null,
    dp: restaurant.dp || null,
    imageUrl: restaurant.imageUrl || null,
    // 统一规则：车程解析不出或超过 15 分钟 → 显示为「略远」（虚线、不进抽签池）
    far: !(driveMinutes(restaurant.driveTime) !== null && driveMinutes(restaurant.driveTime) <= 15),
    x: restaurant.x,
    y: restaurant.y,
    lat: typeof restaurant.lat === 'number' ? restaurant.lat : null,
    lng: typeof restaurant.lng === 'number' ? restaurant.lng : null,
    labelDx: restaurant.labelDx,
    labelDy: restaurant.labelDy,
    labelAnchor: restaurant.labelAnchor,
    createdAt: restaurant.createdAt || null,
  };
}

function parsePick(body) {
  const source = body && typeof body === 'object' ? body : {};
  const lng = Number(source.lng);
  const lat = Number(source.lat);
  if (Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90) {
    return { lat, lng };
  }
  const legacy = clampPoint(source.x, source.y);
  return legacy ? { x: legacy.x, y: legacy.y } : null;
}

export function createPublicRouter({ db, submitLimiter, geoLimiter }) {
  const office = () => (db.state.settings && db.state.settings.office) || DEFAULT_OFFICE;
  const router = express.Router();

  router.get('/restaurants', (req, res) => {
    const list = db.state.restaurants
      .filter((item) => item.status === 'published')
      .slice()
      .sort((a, b) => a.id - b.id)
      .map(publicRestaurant);
    res.set('Cache-Control', 'no-cache');
    ok(res, list);
  });

  router.post('/submissions', async (req, res) => {
    const ip = clientIp(req);
    const gate = submitLimiter.check(ip);
    if (!gate.ok) {
      res.set('Retry-After', String(gate.retryAfter));
      return fail(res, 429, 'RATE_LIMITED', '报得太勤啦，约 ' + Math.ceil(gate.retryAfter / 60) + ' 分钟后再试试');
    }

    const result = validateSubmission(req.body);
    if (result.honeypot) return fail(res, 400, 'BOT', '提交被拒绝');

    const pick = parsePick(req.body);
    const errors = Object.assign({}, result.errors);
    if (!pick) errors.pick = '请在地图上点一下这家店的位置';
    if (Object.keys(errors).length > 0) {
      return fail(res, 422, 'VALIDATION', '表单还没填对，请检查标红的字段', errors);
    }

    const derived =
      typeof pick.lat === 'number' && typeof pick.lng === 'number'
        ? schematicFromGeo(pick, office())
        : { direction: directionForPoint(pick.x, pick.y) };
    const value = Object.assign({}, result.value, { direction: derived.direction });
    const key = normalizeName(value.name);
    const duplicate =
      db.state.submissions.find((item) => item.status === 'pending' && normalizeName(item.data.name) === key) ||
      db.state.restaurants.find((item) => item.status === 'published' && normalizeName(item.name) === key);
    if (duplicate) {
      return fail(res, 409, 'DUPLICATE', '「' + value.name + '」已经收录或者正在审核中，不用重复报啦');
    }

    const created = await db.mutate((state) => {
      const now = new Date().toISOString();
      const submission = {
        id: crypto.randomUUID(),
        code: makeCode(state),
        status: 'pending',
        data: value,
        pick,
        submitter: result.submitter,
        meta: {
          ipHash: crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16),
          userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
        },
        review: null,
        restaurantId: null,
        history: [{ at: now, action: 'submitted', by: null, note: null }],
        createdAt: now,
        updatedAt: now,
      };
      state.submissions.push(submission);
      return submission;
    });

    ok(res, { code: created.code, id: created.id }, 201);
  });

  router.get('/submissions/:code', (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    const submission = db.state.submissions.find((item) => item.code === code);
    if (!submission) return fail(res, 404, 'NOT_FOUND', '没找到这个提交码，检查一下有没有输错');

    ok(res, {
      code: submission.code,
      status: submission.status,
      name: submission.data.name,
      direction: submission.data.direction,
      address: submission.data.address,
      signature: submission.data.signature,
      createdAt: submission.createdAt,
      reviewedAt: submission.review ? submission.review.at : null,
      rejectReason: submission.status === 'rejected' && submission.review ? submission.review.reason : null,
      restaurantId: submission.restaurantId || null,
      history: submission.history.map((item) => ({ at: item.at, action: item.action })),
    });
  });

  router.get('/geo/config', (req, res) => {
    ok(res, {
      searchEnabled: geoSearchEnabled(),
      office: office(),
    });
  });

  router.get('/geo/search', async (req, res) => {
    const keyword = String(req.query.q || '').trim();
    const gate = geoLimiter.check(clientIp(req));
    if (!gate.ok) {
      res.set('Retry-After', String(gate.retryAfter));
      return fail(res, 429, 'RATE_LIMITED', '查询太频繁了，稍等一下');
    }
    if (!geoSearchEnabled()) return ok(res, { enabled: false, items: [] });
    if (keyword.length < 1) return ok(res, { enabled: true, items: [] });
    try {
      const items = await searchPlaces(keyword, String(req.query.city || '成都'));
      ok(res, { enabled: true, items });
    } catch (err) {
      fail(res, 502, 'GEO_UNAVAILABLE', '地图搜索暂时不可用：' + err.message);
    }
  });

  router.get('/geo/estimate', (req, res) => {
    const lng = Number(req.query.lng);
    const lat = Number(req.query.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return fail(res, 422, 'VALIDATION', '坐标不合法');
    }
    const derived = schematicFromGeo({ lat, lng }, office());
    ok(res, { minutes: derived.minutes, meters: derived.meters, direction: derived.direction });
  });

  router.get('/geo/reverse', async (req, res) => {
    const gate = geoLimiter.check(clientIp(req));
    if (!gate.ok) {
      res.set('Retry-After', String(gate.retryAfter));
      return fail(res, 429, 'RATE_LIMITED', '查询太频繁了，稍等一下');
    }
    if (!geoSearchEnabled()) return ok(res, { enabled: false, address: null });
    const lng = Number(req.query.lng);
    const lat = Number(req.query.lat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return fail(res, 422, 'VALIDATION', '坐标不合法');
    }
    try {
      ok(res, { enabled: true, result: await reverseGeocode(lng, lat) });
    } catch (err) {
      fail(res, 502, 'GEO_UNAVAILABLE', '地址解析暂时不可用：' + err.message);
    }
  });

  return router;
}