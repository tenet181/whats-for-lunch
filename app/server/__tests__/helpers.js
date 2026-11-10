import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../db.js';
import { createApp } from '../app.js';
import { seedRestaurants, ensureAdmin } from '../seed.js';

export async function startTestServer(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lunch-test-'));
  const db = openDb(dir);
  const seeded = await db.mutate((state) => seedRestaurants(state));
  const admin = await db.mutate((state) =>
    ensureAdmin(state, { username: 'admin', password: 'secret123' }),
  );

  const config = {
    port: 0,
    cookieSecure: false,
    trustProxy: false,
    submitPerHour: 100,
    loginPer15Min: 100,
    ...overrides,
  };

  const app = createApp({ db, config });
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port;

  return {
    dir,
    db,
    server,
    base,
    seeded,
    admin,
    stop: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

export async function jsonRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload, headers: response.headers, response };
}

export async function login(base, username = 'admin', password = 'secret123') {
  const result = await jsonRequest(base + '/api/admin/login', {
    method: 'POST',
    body: { username, password },
  });
  const setCookie = result.headers.getSetCookie ? result.headers.getSetCookie() : [];
  const cookie = (setCookie[0] || '').split(';')[0];
  return { ...result, cookie };
}

export const sampleSubmission = {
  x: 300,
  y: 120,
  name: '测试小馆',
  direction: '华阳',
  address: '双流区华阳街道测试路 1 号',
  signature: ['回锅肉', '豆花'],
  perCapita: 30,
  driveTime: '10–13分钟',
  note: '这是一家用于自动化测试的小馆子，味道还不错。',
  dp: 'https://m.dianping.com/shopinfo/testonly',
};