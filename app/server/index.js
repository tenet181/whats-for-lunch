import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { createApp } from './app.js';
import { seedRestaurants, ensureAdmin, ensureOffice } from './seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// 可选：读取 app/.env（不提交到仓库）
const envFile = path.join(here, '..', '.env');
if (fs.existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch (err) {
    console.warn('[中午吃什么] .env 读取失败：' + err.message);
  }
}
const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(here, 'data');

const config = {
  port: PORT,
  cookieSecure: process.env.COOKIE_SECURE === '1',
  trustProxy: process.env.TRUST_PROXY === '1',
  submitPerHour: Number(process.env.SUBMIT_PER_HOUR || 5),
  loginPer15Min: Number(process.env.LOGIN_PER_15MIN || 10),
  geoPerMinute: Number(process.env.GEO_PER_MINUTE || 30),
};

const db = openDb(DATA_DIR);

const seededCount = await db.mutate((state) => seedRestaurants(state));
await db.mutate((state) => ensureOffice(state));
const adminResult = await db.mutate((state) =>
  ensureAdmin(state, { username: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD }),
);

const app = createApp({ db, config });
app.listen(PORT, () => {
  console.log('[中午吃什么] API 已启动: http://127.0.0.1:' + PORT);
  console.log('[中午吃什么] 数据文件: ' + db.file);
  if (seededCount > 0) console.log('[中午吃什么] 已灌入种子数据 ' + seededCount + ' 家');
  if (adminResult.created) {
    console.log('[中午吃什么] 已创建管理员: ' + adminResult.username);
    if (adminResult.generated) {
      console.log('[中午吃什么] 初始密码（只显示这一次，请立刻登录后台修改）: ' + adminResult.password);
    }
  }
});