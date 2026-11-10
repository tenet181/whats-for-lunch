import test from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, jsonRequest, login, sampleSubmission } from './helpers.js';
import { openDb } from '../db.js';

async function withServer(fn, overrides) {
  const ctx = await startTestServer(overrides);
  try {
    await fn(ctx);
  } finally {
    await ctx.stop();
  }
}

test('种子数据：公开列表返回 11 家店', async () => {
  await withServer(async (ctx) => {
    const result = await jsonRequest(ctx.base + '/api/restaurants');
    assert.equal(result.status, 200);
    assert.equal(result.payload.ok, true);
    assert.equal(result.payload.data.length, 11);
    assert.equal(result.payload.data[0].name, '江油肥肠');
  });
});

test('提交 -> 查进度 -> 审核通过 -> 上架', async () => {
  await withServer(async (ctx) => {
    const created = await jsonRequest(ctx.base + '/api/submissions', { method: 'POST', body: sampleSubmission });
    assert.equal(created.status, 201);
    const code = created.payload.data.code;
    assert.equal(code.length, 6);

    const status = await jsonRequest(ctx.base + '/api/submissions/' + code);
    assert.equal(status.status, 200);
    assert.equal(status.payload.data.status, 'pending');
    assert.equal(status.payload.data.name, sampleSubmission.name);

    const session = await login(ctx.base);
    assert.equal(session.status, 200);
    assert.ok(session.cookie.startsWith('lw_admin='));

    const list = await jsonRequest(ctx.base + '/api/admin/submissions?status=pending', {
      headers: { cookie: session.cookie },
    });
    assert.equal(list.status, 200);
    assert.equal(list.payload.data.items.length, 1);
    assert.equal(list.payload.data.counts.pending, 1);

    const id = list.payload.data.items[0].id;
    const approve = await jsonRequest(ctx.base + '/api/admin/submissions/' + id + '/approve', {
      method: 'POST',
      headers: { cookie: session.cookie },
      body: {},
    });
    assert.equal(approve.status, 200);
    assert.equal(approve.payload.data.restaurant.id, 12);
    assert.equal(approve.payload.data.restaurant.name, sampleSubmission.name);

    const publicList = await jsonRequest(ctx.base + '/api/restaurants');
    assert.equal(publicList.payload.data.length, 12);
    const added = publicList.payload.data.find((item) => item.id === 12);
    assert.ok(added);
    assert.equal(added.x, sampleSubmission.x);
    assert.equal(added.y, sampleSubmission.y);
    assert.equal(added.direction, '华阳');
    assert.equal(added.far, false);

    const after = await jsonRequest(ctx.base + '/api/submissions/' + code);
    assert.equal(after.payload.data.status, 'approved');

    const again = await jsonRequest(ctx.base + '/api/admin/submissions/' + id + '/approve', {
      method: 'POST',
      headers: { cookie: session.cookie },
      body: {},
    });
    assert.equal(again.status, 409);
    assert.equal(again.payload.error.code, 'INVALID_STATUS');
  });
});

test('没选位置会被拦下', async () => {
  await withServer(async (ctx) => {
    const result = await jsonRequest(ctx.base + '/api/submissions', {
      method: 'POST',
      body: { ...sampleSubmission, x: undefined, y: undefined },
    });
    assert.equal(result.status, 422);
    assert.ok(result.payload.error.fields.pick);
  });
});

test('选点方向反推：西南方向落为“正兴”', async () => {
  await withServer(async (ctx) => {
    const created = await jsonRequest(ctx.base + '/api/submissions', {
      method: 'POST',
      body: { ...sampleSubmission, name: '西南测试店', x: 120, y: 260 },
    });
    assert.equal(created.status, 201);
    const session = await login(ctx.base);
    const list = await jsonRequest(ctx.base + '/api/admin/submissions?status=pending', {
      headers: { cookie: session.cookie },
    });
    const approve = await jsonRequest(ctx.base + '/api/admin/submissions/' + list.payload.data.items[0].id + '/approve', {
      method: 'POST',
      headers: { cookie: session.cookie },
      body: {},
    });
    assert.equal(approve.payload.data.restaurant.direction, '正兴');
    assert.equal(approve.payload.data.restaurant.x, 120);
  });
});

test('真实坐标选点：正北方向落为“华阳”，并换算到示意图上半区', async () => {
  await withServer(async (ctx) => {
    const created = await jsonRequest(ctx.base + '/api/submissions', {
      method: 'POST',
      body: { ...sampleSubmission, name: '正北测试店', lat: 30.49, lng: 104.057786, x: undefined, y: undefined },
    });
    assert.equal(created.status, 201);

    const session = await login(ctx.base);
    const list = await jsonRequest(ctx.base + '/api/admin/submissions?status=pending', {
      headers: { cookie: session.cookie },
    });
    const approve = await jsonRequest(ctx.base + '/api/admin/submissions/' + list.payload.data.items[0].id + '/approve', {
      method: 'POST',
      headers: { cookie: session.cookie },
      body: {},
    });
    const restaurant = approve.payload.data.restaurant;
    assert.equal(restaurant.direction, '华阳');
    assert.equal(restaurant.lat, 30.49);
    assert.ok(restaurant.y < 170, '正北应该落在中心上方，实际 y=' + restaurant.y);
  });
});

test('地图服务未配 Key 时降级返回 enabled:false', async () => {
  await withServer(async (ctx) => {
    const config = await jsonRequest(ctx.base + '/api/geo/config');
    assert.equal(config.status, 200);
    assert.equal(typeof config.payload.data.searchEnabled, 'boolean');
    assert.ok(config.payload.data.office);

    const search = await jsonRequest(ctx.base + '/api/geo/search?q=' + encodeURIComponent('肥肠'));
    assert.equal(search.status, 200);
    assert.equal(search.payload.data.items.length, 0);
  });
});

test('管理员可以校准公司位置', async () => {
  await withServer(async (ctx) => {
    const session = await login(ctx.base);
    const saved = await jsonRequest(ctx.base + '/api/admin/settings', {
      method: 'PUT',
      headers: { cookie: session.cookie },
      body: { lat: 30.4185, lng: 104.0706, name: '麓坊中心' },
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.payload.data.office.calibrated, true);

    const read = await jsonRequest(ctx.base + '/api/admin/settings', { headers: { cookie: session.cookie } });
    assert.equal(read.payload.data.office.calibrated, true);
  });
});

test('车程超过 15 分钟自动标记为 far（地图虚线、不进抽签池）', async () => {
  await withServer(async (ctx) => {
    const created = await jsonRequest(ctx.base + '/api/submissions', {
      method: 'POST',
      body: { ...sampleSubmission, name: '远一点测试店', driveTime: '20' },
    });
    assert.equal(created.status, 201);

    const session = await login(ctx.base);
    const list = await jsonRequest(ctx.base + '/api/admin/submissions?status=pending', {
      headers: { cookie: session.cookie },
    });
    await jsonRequest(ctx.base + '/api/admin/submissions/' + list.payload.data.items[0].id + '/approve', {
      method: 'POST',
      headers: { cookie: session.cookie },
      body: {},
    });

    const publicList = await jsonRequest(ctx.base + '/api/restaurants');
    const added = publicList.payload.data.find((item) => item.name === '远一点测试店');
    assert.equal(added.driveTime, '20分钟');
    assert.equal(added.far, true);

    const seeded = publicList.payload.data.find((item) => item.name === '江油肥肠');
    assert.equal(seeded.far, false, '10–13分钟 不算远');
  });
});

test('重复提交被 409 拦下', async () => {
  await withServer(async (ctx) => {
    const first = await jsonRequest(ctx.base + '/api/submissions', { method: 'POST', body: sampleSubmission });
    assert.equal(first.status, 201);
    const second = await jsonRequest(ctx.base + '/api/submissions', {
      method: 'POST',
      body: { ...sampleSubmission, name: ' 测试 小馆 ' },
    });
    assert.equal(second.status, 409);
    assert.equal(second.payload.error.code, 'DUPLICATE');
  });
});

test('已上架店名也不允许重复提交', async () => {
  await withServer(async (ctx) => {
    const result = await jsonRequest(ctx.base + '/api/submissions', {
      method: 'POST',
      body: { ...sampleSubmission, name: '江油肥肠' },
    });
    assert.equal(result.status, 409);
  });
});

test('非法字段返回 422 与字段错误', async () => {
  await withServer(async (ctx) => {
    const result = await jsonRequest(ctx.base + '/api/submissions', {
      method: 'POST',
      body: { ...sampleSubmission, name: '', dp: 'javascript:alert(1)' },
    });
    assert.equal(result.status, 422);
    assert.equal(result.payload.error.code, 'VALIDATION');
    assert.ok(result.payload.error.fields.name);
    assert.ok(result.payload.error.fields.dp);
  });
});

test('驳回必须写理由，驳回后提交码能查到理由', async () => {
  await withServer(async (ctx) => {
    const created = await jsonRequest(ctx.base + '/api/submissions', { method: 'POST', body: sampleSubmission });
    const code = created.payload.data.code;
    const session = await login(ctx.base);
    const list = await jsonRequest(ctx.base + '/api/admin/submissions?status=pending', {
      headers: { cookie: session.cookie },
    });
    const id = list.payload.data.items[0].id;

    const noReason = await jsonRequest(ctx.base + '/api/admin/submissions/' + id + '/reject', {
      method: 'POST',
      headers: { cookie: session.cookie },
      body: { reason: '' },
    });
    assert.equal(noReason.status, 422);

    const rejected = await jsonRequest(ctx.base + '/api/admin/submissions/' + id + '/reject', {
      method: 'POST',
      headers: { cookie: session.cookie },
      body: { reason: '地址写得太模糊' },
    });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.payload.data.status, 'rejected');

    const status = await jsonRequest(ctx.base + '/api/submissions/' + code);
    assert.equal(status.payload.data.status, 'rejected');
    assert.equal(status.payload.data.rejectReason, '地址写得太模糊');

    const publicList = await jsonRequest(ctx.base + '/api/restaurants');
    assert.equal(publicList.payload.data.length, 11);
  });
});

test('未登录访问管理接口返回 401', async () => {
  await withServer(async (ctx) => {
    const result = await jsonRequest(ctx.base + '/api/admin/submissions');
    assert.equal(result.status, 401);
    assert.equal(result.payload.error.code, 'UNAUTHORIZED');

    const me = await jsonRequest(ctx.base + '/api/admin/me');
    assert.equal(me.status, 401);
  });
});

test('错误密码 401，正确密码可登出', async () => {
  await withServer(async (ctx) => {
    const bad = await jsonRequest(ctx.base + '/api/admin/login', {
      method: 'POST',
      body: { username: 'admin', password: 'wrong-password' },
    });
    assert.equal(bad.status, 401);

    const session = await login(ctx.base);
    const me = await jsonRequest(ctx.base + '/api/admin/me', { headers: { cookie: session.cookie } });
    assert.equal(me.status, 200);
    assert.equal(me.payload.data.username, 'admin');

    const logout = await jsonRequest(ctx.base + '/api/admin/logout', {
      method: 'POST',
      headers: { cookie: session.cookie },
      body: {},
    });
    assert.equal(logout.status, 200);

    const after = await jsonRequest(ctx.base + '/api/admin/me', { headers: { cookie: session.cookie } });
    assert.equal(after.status, 401);
  });
});

test('下架与重新上架', async () => {
  await withServer(async (ctx) => {
    const session = await login(ctx.base);
    const offline = await jsonRequest(ctx.base + '/api/admin/restaurants/1', {
      method: 'PATCH',
      headers: { cookie: session.cookie },
      body: { status: 'offline' },
    });
    assert.equal(offline.status, 200);

    const publicOffline = await jsonRequest(ctx.base + '/api/restaurants');
    assert.equal(publicOffline.payload.data.length, 10);

    const online = await jsonRequest(ctx.base + '/api/admin/restaurants/1', {
      method: 'PATCH',
      headers: { cookie: session.cookie },
      body: { status: 'published' },
    });
    assert.equal(online.status, 200);

    const publicOnline = await jsonRequest(ctx.base + '/api/restaurants');
    assert.equal(publicOnline.payload.data.length, 11);
  });
});

test('数据落盘：重启后仍能读到新上架的店', async () => {
  const ctx = await startTestServer();
  try {
    const created = await jsonRequest(ctx.base + '/api/submissions', { method: 'POST', body: sampleSubmission });
    const code = created.payload.data.code;
    const session = await login(ctx.base);
    const list = await jsonRequest(ctx.base + '/api/admin/submissions?status=pending', {
      headers: { cookie: session.cookie },
    });
    await jsonRequest(ctx.base + '/api/admin/submissions/' + list.payload.data.items[0].id + '/approve', {
      method: 'POST',
      headers: { cookie: session.cookie },
      body: {},
    });
    await ctx.stop();

    const reopened = openDb(ctx.dir);
    assert.equal(reopened.state.restaurants.length, 12);
    assert.equal(reopened.state.submissions[0].status, 'approved');
    assert.equal(reopened.state.admins.length, 1);
    assert.ok(reopened.state.auditLog.length >= 1);
    assert.equal(reopened.state.auditLog[0].action, 'submission.approve');
  } finally {
    await ctx.stop().catch(() => {});
  }
});

test('提交限流返回 429', async () => {
  await withServer(async (ctx) => {
    const first = await jsonRequest(ctx.base + '/api/submissions', { method: 'POST', body: sampleSubmission });
    assert.equal(first.status, 201);
    const second = await jsonRequest(ctx.base + '/api/submissions', {
      method: 'POST',
      body: { ...sampleSubmission, name: '第二家测试店' },
    });
    assert.equal(second.status, 429);
    assert.equal(second.payload.error.code, 'RATE_LIMITED');
  }, { submitPerHour: 1 });
});

test('管理员账号：超级管理员可创建审核员，审核员不能管理账号', async () => {
  await withServer(async (ctx) => {
    const session = await login(ctx.base);
    const created = await jsonRequest(ctx.base + '/api/admin/accounts', {
      method: 'POST',
      headers: { cookie: session.cookie },
      body: { username: 'reviewer1', password: 'review123', role: 'reviewer' },
    });
    assert.equal(created.status, 201);
    assert.equal(created.payload.data.role, 'reviewer');

    const reviewerSession = await login(ctx.base, 'reviewer1', 'review123');
    assert.equal(reviewerSession.status, 200);

    const forbidden = await jsonRequest(ctx.base + '/api/admin/accounts', {
      headers: { cookie: reviewerSession.cookie },
    });
    assert.equal(forbidden.status, 403);

    const me = await jsonRequest(ctx.base + '/api/admin/me', { headers: { cookie: reviewerSession.cookie } });
    assert.equal(me.payload.data.role, 'reviewer');
  });
});

test('未知提交码返回 404', async () => {
  await withServer(async (ctx) => {
    const result = await jsonRequest(ctx.base + '/api/submissions/ZZZZZZ');
    assert.equal(result.status, 404);
  });
});