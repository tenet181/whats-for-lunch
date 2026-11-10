import express from 'express';
import crypto from 'node:crypto';
import { ok, fail, clientIp, isJsonRequest, sameOrigin } from '../http.js';
import {
  SESSION_COOKIE,
  COOKIE_MAX_AGE_S,
  parseCookies,
  serializeCookie,
  clearCookie,
  createSession,
  destroySession,
  verifyPassword,
  hashPassword,
  publicAdmin,
} from '../auth.js';
import {
  validateRestaurantFields,
  validateRejectReason,
  validateUsername,
  validatePassword,
  normalizeName,
} from '../validate.js';
import { placeOnMap, clampPoint } from '../placement.js';
import { DEFAULT_OFFICE, schematicFromGeo } from '../geo.js';
import { publicRestaurant } from './public.js';

const SUBMISSION_PAGE_SIZE = 20;
const AUDIT_LIMIT = 500;

function logAudit(state, actorId, action, targetType, targetId, detail) {
  state.auditLog.push({
    at: new Date().toISOString(),
    actorId,
    action,
    targetType,
    targetId,
    detail: detail || null,
  });
  if (state.auditLog.length > AUDIT_LIMIT) {
    state.auditLog.splice(0, state.auditLog.length - AUDIT_LIMIT);
  }
}

function adminSubmission(submission) {
  return {
    id: submission.id,
    code: submission.code,
    status: submission.status,
    data: submission.data,
    submitter: submission.submitter,
    pick: submission.pick || null,
    review: submission.review,
    restaurantId: submission.restaurantId,
    history: submission.history,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
  };
}

function guardMutation(req, res, next) {
  if (!isJsonRequest(req)) return fail(res, 415, 'UNSUPPORTED_MEDIA_TYPE', '请求需为 application/json');
  if (!sameOrigin(req)) return fail(res, 403, 'FORBIDDEN', '跨站请求被拒绝');
  next();
}

function requireSuper(req, res, next) {
  if (!req.admin || req.admin.role !== 'super') {
    return fail(res, 403, 'FORBIDDEN', '需要超级管理员权限');
  }
  next();
}

export function createAdminRouter({ db, config, loginLimiter }) {
  const router = express.Router();

  router.post('/login', guardMutation, async (req, res) => {
    const ip = clientIp(req);
    const gate = loginLimiter.check(ip);
    if (!gate.ok) {
      res.set('Retry-After', String(gate.retryAfter));
      return fail(res, 429, 'RATE_LIMITED', '尝试次数过多，请 ' + Math.ceil(gate.retryAfter / 60) + ' 分钟后再试');
    }

    const body = req.body || {};
    const username = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!username || !password) return fail(res, 422, 'VALIDATION', '请输入用户名和密码');

    const admin = db.state.admins.find((item) => item.username === username);
    const valid = Boolean(admin) && !admin.disabled && (await verifyPassword(password, admin));
    if (!valid) return fail(res, 401, 'INVALID_CREDENTIALS', '用户名或密码不对');

    loginLimiter.reset(ip);
    const token = await db.mutate((state) => {
      const target = state.admins.find((item) => item.id === admin.id);
      target.lastLoginAt = new Date().toISOString();
      return createSession(state, admin.id, ip);
    });

    res.set('Set-Cookie', serializeCookie(SESSION_COOKIE, token, { maxAge: COOKIE_MAX_AGE_S, secure: config.cookieSecure }));
    ok(res, publicAdmin(admin));
  });

  router.post('/logout', async (req, res) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) {
      await db.mutate((state) => {
        destroySession(state, token);
      });
    }
    res.set('Set-Cookie', clearCookie(SESSION_COOKIE));
    ok(res, { ok: true });
  });

  router.use((req, res, next) => {
    if (!req.admin) return fail(res, 401, 'UNAUTHORIZED', '请先登录');
    next();
  });

  router.get('/me', (req, res) => ok(res, publicAdmin(req.admin)));

  router.post('/me/password', guardMutation, async (req, res) => {
    const body = req.body || {};
    const current = String(body.currentPassword || '');
    const next = String(body.newPassword || '');
    const valid = await verifyPassword(current, req.admin);
    if (!valid) return fail(res, 422, 'INVALID_CREDENTIALS', '当前密码不对');
    const checked = validatePassword(next);
    if (!checked.ok) return fail(res, 422, 'VALIDATION', checked.message, { newPassword: checked.message });

    await db.mutate(async (state) => {
      const target = state.admins.find((item) => item.id === req.admin.id);
      const hashed = await hashPassword(checked.value);
      target.salt = hashed.salt;
      target.passwordHash = hashed.passwordHash;
      // 改密码后使其它会话失效
      state.sessions = state.sessions.filter((session) => session.adminId !== req.admin.id);
      logAudit(state, req.admin.id, 'account.password', 'admin', req.admin.id, null);
    });

    res.set('Set-Cookie', clearCookie(SESSION_COOKIE));
    ok(res, { ok: true });
  });

  router.get('/stats', (req, res) => {
    const state = db.state;
    const counts = { pending: 0, approved: 0, rejected: 0 };
    for (const item of state.submissions) counts[item.status] = (counts[item.status] || 0) + 1;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    ok(res, {
      pending: counts.pending,
      approved: counts.approved,
      rejected: counts.rejected,
      published: state.restaurants.filter((item) => item.status === 'published').length,
      offline: state.restaurants.filter((item) => item.status === 'offline').length,
      newThisWeek: state.submissions.filter((item) => new Date(item.createdAt).getTime() >= weekAgo).length,
    });
  });

  router.get('/submissions', (req, res) => {
    const state = db.state;
    const status = String(req.query.status || 'all');
    const q = String(req.query.q || '').trim().toLowerCase();
    const page = Math.max(1, Number(req.query.page) || 1);

    const counts = { pending: 0, approved: 0, rejected: 0 };
    for (const item of state.submissions) counts[item.status] = (counts[item.status] || 0) + 1;

    let list = state.submissions.slice();
    if (status !== 'all') list = list.filter((item) => item.status === status);
    if (q) {
      list = list.filter((item) => {
        const haystack = [item.data.name, item.data.address].join(' ').toLowerCase();
        return haystack.includes(q);
      });
    }
    list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    const total = list.length;
    const items = list.slice((page - 1) * SUBMISSION_PAGE_SIZE, page * SUBMISSION_PAGE_SIZE).map(adminSubmission);
    ok(res, { items, total, page, pageSize: SUBMISSION_PAGE_SIZE, counts });
  });

  router.get('/submissions/:id', (req, res) => {
    const submission = db.state.submissions.find((item) => item.id === req.params.id);
    if (!submission) return fail(res, 404, 'NOT_FOUND', '提交不存在');
    ok(res, adminSubmission(submission));
  });

  router.patch('/submissions/:id', guardMutation, async (req, res) => {
    const submission = db.state.submissions.find((item) => item.id === req.params.id);
    if (!submission) return fail(res, 404, 'NOT_FOUND', '提交不存在');
    if (submission.status !== 'pending') return fail(res, 409, 'INVALID_STATUS', '只有待审核的提交可以修改');

    const result = validateRestaurantFields(req.body);
    if (!result.ok) return fail(res, 422, 'VALIDATION', '字段校验没通过', result.errors);

    await db.mutate((state) => {
      const target = state.submissions.find((item) => item.id === submission.id);
      const now = new Date().toISOString();
      target.data = result.value;
      target.review = Object.assign({}, target.review || {}, { edited: true });
      target.updatedAt = now;
      target.history.push({ at: now, action: 'edited', by: req.admin.id, note: null });
      logAudit(state, req.admin.id, 'submission.edit', 'submission', target.id, null);
    });

    ok(res, adminSubmission(db.state.submissions.find((item) => item.id === submission.id)));
  });

  router.post('/submissions/:id/approve', guardMutation, async (req, res) => {
    const submission = db.state.submissions.find((item) => item.id === req.params.id);
    if (!submission) return fail(res, 404, 'NOT_FOUND', '提交不存在');
    if (submission.status !== 'pending') return fail(res, 409, 'INVALID_STATUS', '这条已经处理过了');

    let value = submission.data;
    const body = req.body || {};
    if (body.name !== undefined || body.address !== undefined || body.signature !== undefined) {
      const result = validateRestaurantFields(body);
      if (!result.ok) return fail(res, 422, 'VALIDATION', '字段校验没通过', result.errors);
      value = result.value;
    }

    const key = normalizeName(value.name);
    const duplicate = db.state.restaurants.find((item) => item.status === 'published' && normalizeName(item.name) === key);
    if (duplicate) {
      return fail(res, 409, 'DUPLICATE', '已有一家同名在架店铺（#' + duplicate.id + ' ' + duplicate.name + '）');
    }

    const created = await db.mutate((state) => {
      const target = state.submissions.find((item) => item.id === submission.id);
      const now = new Date().toISOString();
      const existing = state.restaurants.filter((item) => item.status === 'published');
      const office = (state.settings && state.settings.office) || DEFAULT_OFFICE;
      let point;
      let geo = null;
      if (target.pick && typeof target.pick.lat === 'number' && typeof target.pick.lng === 'number') {
        const derived = schematicFromGeo(target.pick, office);
        point = { x: derived.x, y: derived.y };
        geo = { lat: target.pick.lat, lng: target.pick.lng };
      } else if (target.pick && typeof target.pick.x === 'number') {
        point = clampPoint(target.pick.x, target.pick.y) || placeOnMap(value.direction, existing, value.name);
      } else {
        point = placeOnMap(value.direction, existing, value.name);
      }
      state.counters.restaurantId += 1;

      const restaurant = Object.assign({}, value, {
        id: state.counters.restaurantId,
        alert: null,
        far: value.direction === '略远',
        x: point.x,
        y: point.y,
        lat: geo ? geo.lat : null,
        lng: geo ? geo.lng : null,
        status: 'published',
        source: 'submission',
        submissionId: target.id,
        createdAt: now,
        updatedAt: now,
      });
      state.restaurants.push(restaurant);

      target.status = 'approved';
      target.data = value;
      target.restaurantId = restaurant.id;
      target.review = { by: req.admin.id, at: now, reason: null, edited: Boolean(target.review && target.review.edited) };
      target.updatedAt = now;
      target.history.push({ at: now, action: 'approved', by: req.admin.id, note: null });
      logAudit(state, req.admin.id, 'submission.approve', 'submission', target.id, 'restaurant#' + restaurant.id);
      return restaurant;
    });

    ok(res, {
      submission: adminSubmission(db.state.submissions.find((item) => item.id === submission.id)),
      restaurant: publicRestaurant(created),
    });
  });

  router.post('/submissions/:id/reject', guardMutation, async (req, res) => {
    const submission = db.state.submissions.find((item) => item.id === req.params.id);
    if (!submission) return fail(res, 404, 'NOT_FOUND', '提交不存在');
    if (submission.status !== 'pending') return fail(res, 409, 'INVALID_STATUS', '这条已经处理过了');

    const checked = validateRejectReason((req.body || {}).reason);
    if (!checked.ok) return fail(res, 422, 'VALIDATION', checked.reason, { reason: checked.reason });

    await db.mutate((state) => {
      const target = state.submissions.find((item) => item.id === submission.id);
      const now = new Date().toISOString();
      target.status = 'rejected';
      target.review = {
        by: req.admin.id,
        at: now,
        reason: checked.value,
        edited: Boolean(target.review && target.review.edited),
      };
      target.updatedAt = now;
      target.history.push({ at: now, action: 'rejected', by: req.admin.id, note: checked.value });
      logAudit(state, req.admin.id, 'submission.reject', 'submission', target.id, checked.value);
    });

    ok(res, adminSubmission(db.state.submissions.find((item) => item.id === submission.id)));
  });

  router.get('/restaurants', (req, res) => {
    const list = db.state.restaurants
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((item) =>
        Object.assign(publicRestaurant(item), {
          status: item.status,
          source: item.source || 'seed',
          submissionId: item.submissionId || null,
          updatedAt: item.updatedAt || null,
        }),
      );
    ok(res, list);
  });

  router.patch('/restaurants/:id', guardMutation, async (req, res) => {
    const restaurant = db.state.restaurants.find((item) => item.id === Number(req.params.id));
    if (!restaurant) return fail(res, 404, 'NOT_FOUND', '店铺不存在');

    const body = req.body || {};
    const merged = {
      name: body.name === undefined ? restaurant.name : body.name,
      direction: body.direction === undefined ? restaurant.direction : body.direction,
      address: body.address === undefined ? restaurant.address : body.address,
      signature: body.signature === undefined ? restaurant.signature : body.signature,
      perCapita: body.perCapita === undefined ? restaurant.perCapita : body.perCapita,
      driveTime: body.driveTime === undefined ? restaurant.driveTime : body.driveTime,
      note: body.note === undefined ? restaurant.note : body.note,
      dp: body.dp === undefined ? restaurant.dp : body.dp,
      imageUrl: body.imageUrl === undefined ? restaurant.imageUrl : body.imageUrl,
    };
    const result = validateRestaurantFields(merged);
    if (!result.ok) return fail(res, 422, 'VALIDATION', '字段校验没通过', result.errors);

    if (body.status !== undefined && body.status !== 'published' && body.status !== 'offline') {
      return fail(res, 422, 'VALIDATION', '状态只能是 published 或 offline', { status: '状态不合法' });
    }
    let alert = restaurant.alert || null;
    if (body.alert !== undefined) {
      const rawAlert = body.alert === null ? '' : String(body.alert).trim();
      if (rawAlert.length > 120) return fail(res, 422, 'VALIDATION', '提醒不超过 120 字', { alert: '提醒不超过 120 字' });
      alert = rawAlert || null;
    }
    let far = Boolean(restaurant.far);
    if (body.far !== undefined) far = Boolean(body.far);
    let x = restaurant.x;
    let y = restaurant.y;
    let lat = typeof restaurant.lat === 'number' ? restaurant.lat : null;
    let lng = typeof restaurant.lng === 'number' ? restaurant.lng : null;
    if (body.lat !== undefined || body.lng !== undefined) {
      const nextLat = Number(body.lat);
      const nextLng = Number(body.lng);
      if (
        !Number.isFinite(nextLat) ||
        !Number.isFinite(nextLng) ||
        Math.abs(nextLat) > 90 ||
        Math.abs(nextLng) > 180
      ) {
        return fail(res, 422, 'VALIDATION', '坐标不合法', { lat: '坐标不合法' });
      }
      lat = nextLat;
      lng = nextLng;
      const office = (db.state.settings && db.state.settings.office) || DEFAULT_OFFICE;
      const derived = schematicFromGeo({ lat, lng }, office);
      x = derived.x;
      y = derived.y;
    } else if (body.x !== undefined || body.y !== undefined) {
      const point = clampPoint(body.x === undefined ? x : body.x, body.y === undefined ? y : body.y);
      if (!point) return fail(res, 422, 'VALIDATION', '坐标不合法', { x: '坐标不合法' });
      x = point.x;
      y = point.y;
    }

    await db.mutate((state) => {
      const target = state.restaurants.find((item) => item.id === restaurant.id);
      Object.assign(target, result.value, {
        alert,
        far,
        x,
        y,
        lat,
        lng,
        status: body.status === undefined ? target.status : body.status,
        updatedAt: new Date().toISOString(),
      });
      logAudit(state, req.admin.id, 'restaurant.update', 'restaurant', String(target.id), body.status || null);
    });

    ok(res, publicRestaurant(db.state.restaurants.find((item) => item.id === restaurant.id)));
  });

  router.get('/settings', (req, res) => {
    ok(res, { office: (db.state.settings && db.state.settings.office) || DEFAULT_OFFICE });
  });

  router.put('/settings', guardMutation, async (req, res) => {
    const body = req.body || {};
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return fail(res, 422, 'VALIDATION', '坐标不合法', { lat: '坐标不合法' });
    }
    const name = String(body.name || '麓坊中心').slice(0, 40) || '麓坊中心';
    const office = { lat, lng, name, calibrated: true };
    await db.mutate((state) => {
      state.settings = state.settings || {};
      state.settings.office = office;
      logAudit(state, req.admin.id, 'settings.office', 'settings', 'office', lat + ',' + lng);
    });
    ok(res, { office });
  });

  router.get('/accounts', requireSuper, (req, res) => {
    ok(res, db.state.admins.map(publicAdmin));
  });

  router.post('/accounts', requireSuper, guardMutation, async (req, res) => {
    const body = req.body || {};
    const username = validateUsername(body.username);
    if (!username.ok) return fail(res, 422, 'VALIDATION', username.message, { username: username.message });
    const password = validatePassword(body.password);
    if (!password.ok) return fail(res, 422, 'VALIDATION', password.message, { password: password.message });
    const role = body.role === 'super' ? 'super' : 'reviewer';
    if (db.state.admins.some((item) => item.username === username.value)) {
      return fail(res, 409, 'DUPLICATE', '这个用户名已存在', { username: '用户名已存在' });
    }

    const created = await db.mutate(async (state) => {
      const hashed = await hashPassword(password.value);
      const account = {
        id: crypto.randomUUID(),
        username: username.value,
        role,
        salt: hashed.salt,
        passwordHash: hashed.passwordHash,
        disabled: false,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
      };
      state.admins.push(account);
      logAudit(state, req.admin.id, 'account.create', 'admin', account.id, account.username);
      return account;
    });

    ok(res, publicAdmin(created), 201);
  });

  router.patch('/accounts/:id', requireSuper, guardMutation, async (req, res) => {
    const account = db.state.admins.find((item) => item.id === req.params.id);
    if (!account) return fail(res, 404, 'NOT_FOUND', '账号不存在');

    const body = req.body || {};
    const isSelf = account.id === req.admin.id;
    if (body.disabled === true && isSelf) return fail(res, 422, 'VALIDATION', '不能停用自己');
    if (body.role !== undefined && body.role !== 'super' && body.role !== 'reviewer') {
      return fail(res, 422, 'VALIDATION', '角色只能是 super 或 reviewer');
    }
    if (isSelf && body.role === 'reviewer') return fail(res, 422, 'VALIDATION', '不能给自己降级');

    const lastSuper =
      account.role === 'super' &&
      !account.disabled &&
      db.state.admins.filter((item) => item.role === 'super' && !item.disabled).length <= 1;
    if (lastSuper && (body.role === 'reviewer' || body.disabled === true)) {
      return fail(res, 422, 'VALIDATION', '至少要保留一个可用的超级管理员');
    }

    let passwordValue = null;
    if (body.password !== undefined && body.password !== '') {
      const checked = validatePassword(body.password);
      if (!checked.ok) return fail(res, 422, 'VALIDATION', checked.message, { password: checked.message });
      passwordValue = checked.value;
    }

    await db.mutate(async (state) => {
      const target = state.admins.find((item) => item.id === account.id);
      if (passwordValue) {
        const hashed = await hashPassword(passwordValue);
        target.salt = hashed.salt;
        target.passwordHash = hashed.passwordHash;
        state.sessions = state.sessions.filter((session) => session.adminId !== target.id);
      }
      if (body.role !== undefined) target.role = body.role;
      if (body.disabled !== undefined) {
        target.disabled = Boolean(body.disabled);
        if (target.disabled) {
          state.sessions = state.sessions.filter((session) => session.adminId !== target.id);
        }
      }
      logAudit(state, req.admin.id, 'account.update', 'admin', target.id, passwordValue ? 'reset-password' : null);
    });

    ok(res, publicAdmin(db.state.admins.find((item) => item.id === account.id)));
  });

  return router;
}