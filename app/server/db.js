import fs from 'node:fs';
import path from 'node:path';

function emptyState() {
  return {
    version: 1,
    settings: { office: null },
    counters: { restaurantId: 0 },
    restaurants: [],
    submissions: [],
    admins: [],
    sessions: [],
    auditLog: [],
  };
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyState();
  return {
    version: 1,
    settings: {
      office: raw.settings && raw.settings.office ? raw.settings.office : null,
    },
    counters: { restaurantId: Number(raw.counters && raw.counters.restaurantId) || 0 },
    restaurants: Array.isArray(raw.restaurants) ? raw.restaurants : [],
    submissions: Array.isArray(raw.submissions) ? raw.submissions : [],
    admins: Array.isArray(raw.admins) ? raw.admins : [],
    sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    auditLog: Array.isArray(raw.auditLog) ? raw.auditLog : [],
  };
}

/**
 * 打开（或创建）JSON 数据库。写入串行化，落盘使用 tmp + rename 原子替换。
 */
export function openDb(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'db.json');

  function load() {
    if (!fs.existsSync(file)) return emptyState();
    const text = fs.readFileSync(file, 'utf8');
    if (!text.trim()) return emptyState();
    try {
      return normalize(JSON.parse(text));
    } catch (err) {
      throw new Error(
        'db.json 解析失败：' + file + '。请修复该文件，或从备份/种子重新开始。原始错误：' + err.message,
      );
    }
  }

  let state = load();

  async function save() {
    const tmp = file + '.tmp';
    await fs.promises.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
    await fs.promises.rename(tmp, file);
  }

  let chain = Promise.resolve();

  function mutate(fn) {
    const run = chain.then(async () => {
      const result = await fn(state);
      await save();
      return result;
    });
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  return {
    file,
    get state() {
      return state;
    },
    mutate,
    save,
  };
}