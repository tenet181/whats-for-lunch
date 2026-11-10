import { LIMITS, DIRECTIONS } from './shared.js';

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isHttpUrl(value) {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeUrl(value, errors, field, label) {
  const raw = trimString(value);
  if (!raw) return null;
  if (raw.length > LIMITS.url.max) {
    errors[field] = label + '过长（不超过 ' + LIMITS.url.max + ' 字符）';
    return null;
  }
  if (!isHttpUrl(raw)) {
    errors[field] = label + '需以 http:// 或 https:// 开头';
    return null;
  }
  return raw;
}

/** 从「10–13分钟」「20」「3-5 分钟」这类文本里取最大的分钟数，解析不出来返回 null */
export function driveMinutes(value) {
  const matches = String(value || '').match(/\d+(\.\d+)?/g);
  if (!matches || matches.length === 0) return null;
  return Math.max.apply(null, matches.map(Number));
}

/** 把「20」「10-13」补成「20分钟」「10-13分钟」 */
export function normalizeDriveTime(value) {
  const raw = trimString(value);
  if (!raw) return '待确认';
  if (/^\d+(\.\d+)?$/.test(raw)) return raw + '分钟';
  if (/^\d+(\.\d+)?\s*[-–—~到至]\s*\d+(\.\d+)?$/.test(raw)) {
    return raw.replace(/\s*[-–—~到至]\s*/, '-') + '分钟';
  }
  return raw;
}

/** 店名归一化，用于重复检测（去空格/全角空格/常见标点，忽略大小写） */
export function normalizeName(name) {
  return String(name || '')
    .replace(/[\s\u3000]/g, '')
    .replace(/[（）()【】[\]·・.。,，、!！?？]/g, '')
    .toLowerCase();
}

export function validateRestaurantFields(raw, options = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const errors = {};
  const requireDirection = options.requireDirection !== false;

  const name = trimString(src.name);
  if (!name) {
    errors.name = '请填写店名';
  } else if (name.length < LIMITS.name.min || name.length > LIMITS.name.max) {
    errors.name = '店名需 ' + LIMITS.name.min + '-' + LIMITS.name.max + ' 字';
  }

  const direction = trimString(src.direction);
  if (!direction && !requireDirection) {
    // 由地图选点反推，交给调用方补上
  } else if (!DIRECTIONS.includes(direction)) {
    errors.direction = '请选择方向（华阳 / 正兴 / 万安 / 略远）';
  }

  const address = trimString(src.address);
  if (address && (address.length < LIMITS.address.min || address.length > LIMITS.address.max)) {
    errors.address = '地址需 ' + LIMITS.address.min + '-' + LIMITS.address.max + ' 字';
  }

  const signature = Array.isArray(src.signature)
    ? src.signature
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  if (signature.length < LIMITS.signature.min) {
    errors.signature = '至少填 1 个招牌菜';
  } else if (signature.length > LIMITS.signature.max) {
    errors.signature = '最多 ' + LIMITS.signature.max + ' 个招牌菜';
  } else if (signature.some((item) => item.length < LIMITS.signature.itemMin || item.length > LIMITS.signature.itemMax)) {
    errors.signature = '每个招牌菜 ' + LIMITS.signature.itemMin + '-' + LIMITS.signature.itemMax + ' 字';
  }

  let perCapita = null;
  const perCapitaRaw = src.perCapita;
  if (perCapitaRaw !== null && perCapitaRaw !== undefined && perCapitaRaw !== '') {
    const value = Number(perCapitaRaw);
    if (!Number.isFinite(value) || value < LIMITS.perCapita.min || value > LIMITS.perCapita.max) {
      errors.perCapita = '人均写 ' + LIMITS.perCapita.min + '-' + LIMITS.perCapita.max + ' 之间的数字';
    } else {
      perCapita = Math.round(value);
    }
  }

  const driveTime = normalizeDriveTime(src.driveTime);
  if (driveTime.length > LIMITS.driveTime.max) {
    errors.driveTime = '车程描述不超过 ' + LIMITS.driveTime.max + ' 字';
  }

  const note = trimString(src.note);
  if (note.length > LIMITS.note.max) {
    errors.note = '点评不超过 ' + LIMITS.note.max + ' 字';
  }

  const dp = normalizeUrl(src.dp, errors, 'dp', '大众点评链接');
  const imageUrl = normalizeUrl(src.imageUrl, errors, 'imageUrl', '图片链接');

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: { name, direction, address, signature, perCapita, driveTime, note, dp, imageUrl },
  };
}

export function validateSubmission(raw) {
  const base = validateRestaurantFields(raw, { requireDirection: false });
  const src = raw && typeof raw === 'object' ? raw : {};
  const errors = Object.assign({}, base.errors);

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    honeypot: Boolean(trimString(src.website)),
    value: base.value,
    submitter: { nickname: null, contact: null },
  };
}

export function validateRejectReason(raw) {
  const reason = trimString(raw);
  if (reason.length < LIMITS.rejectReason.min || reason.length > LIMITS.rejectReason.max) {
    return { ok: false, reason: '请填写 ' + LIMITS.rejectReason.min + '-' + LIMITS.rejectReason.max + ' 字的驳回理由' };
  }
  return { ok: true, value: reason };
}

export function validateUsername(raw) {
  const username = trimString(raw).toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(username)) return { ok: false, message: '用户名只能用字母、数字、下划线、短横线' };
  if (username.length < LIMITS.username.min || username.length > LIMITS.username.max) {
    return { ok: false, message: '用户名需 ' + LIMITS.username.min + '-' + LIMITS.username.max + ' 个字符' };
  }
  return { ok: true, value: username };
}

export function validatePassword(raw) {
  const password = typeof raw === 'string' ? raw : '';
  if (password.length < LIMITS.password.min || password.length > LIMITS.password.max) {
    return { ok: false, message: '密码需 ' + LIMITS.password.min + '-' + LIMITS.password.max + ' 个字符' };
  }
  return { ok: true, value: password };
}