import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { APP_DIR } from './shared.js';
import { fail } from './http.js';
import { SESSION_COOKIE, parseCookies, resolveAdmin } from './auth.js';
import { createRateLimiter } from './rate-limit.js';
import { createPublicRouter } from './routes/public.js';
import { createAdminRouter } from './routes/admin.js';

export function createApp({ db, config }) {
  const app = express();
  app.set('trust proxy', config.trustProxy ? 1 : false);
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    next();
  });
  app.use(express.json({ limit: '64kb' }));

  const submitLimiter = createRateLimiter({ max: config.submitPerHour, windowMs: 60 * 60 * 1000 });
  const loginLimiter = createRateLimiter({ max: config.loginPer15Min, windowMs: 15 * 60 * 1000 });
  const geoLimiter = createRateLimiter({ max: config.geoPerMinute, windowMs: 60 * 1000 });

  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use(
    '/api/admin',
    (req, res, next) => {
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
      req.admin = resolveAdmin(db.state, token);
      next();
    },
    createAdminRouter({ db, config, loginLimiter }),
  );

  app.use('/api', createPublicRouter({ db, submitLimiter, geoLimiter }));
  app.use('/api', (req, res) => fail(res, 404, 'NOT_FOUND', '接口不存在'));

  const dist = path.join(APP_DIR, 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      res
        .status(200)
        .type('text/plain; charset=utf-8')
        .send('API 已就绪（端口 ' + config.port + '）。开发请用 npm run dev；生产请先 npm run build。');
    });
  }

  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
      return fail(res, 400, 'INVALID_JSON', '请求体不是合法 JSON');
    }
    if (err && err.type === 'entity.too.large') {
      return fail(res, 413, 'PAYLOAD_TOO_LARGE', '请求体过大');
    }
    console.error('[server error]', err);
    fail(res, 500, 'INTERNAL', '服务器开小差了，稍后再试');
  });

  return app;
}