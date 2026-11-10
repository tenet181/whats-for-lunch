import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);
const KEY_LEN = 64;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };

export const SESSION_COOKIE = 'lw_admin';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const COOKIE_MAX_AGE_S = SESSION_TTL_MS / 1000;

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scryptAsync(String(password), salt, KEY_LEN, SCRYPT_OPTS);
  return { salt, passwordHash: Buffer.from(derived).toString('hex') };
}

export async function verifyPassword(password, admin) {
  if (!admin || !admin.salt || !admin.passwordHash) return false;
  try {
    const derived = await scryptAsync(String(password), admin.salt, KEY_LEN, SCRYPT_OPTS);
    const left = Buffer.from(derived);
    const right = Buffer.from(admin.passwordHash, 'hex');
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    if (!key) continue;
    const rawValue = part.slice(index + 1).trim();
    try {
      out[key] = decodeURIComponent(rawValue);
    } catch {
      out[key] = rawValue;
    }
  }
  return out;
}

export function serializeCookie(name, value, options = {}) {
  const parts = [name + '=' + encodeURIComponent(value), 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (options.maxAge !== undefined) parts.push('Max-Age=' + Math.floor(options.maxAge));
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearCookie(name) {
  return name + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

export function pruneSessions(state, now = Date.now()) {
  const before = state.sessions.length;
  state.sessions = state.sessions.filter((session) => session.expiresAt > now);
  return before - state.sessions.length;
}

export function createSession(state, adminId, ip) {
  const now = Date.now();
  pruneSessions(state, now);
  const token = crypto.randomBytes(32).toString('base64url');
  state.sessions.push({
    tokenHash: sha256(token),
    adminId,
    createdAt: new Date(now).toISOString(),
    expiresAt: now + SESSION_TTL_MS,
    ip: ip || '',
  });
  return token;
}

export function destroySession(state, token) {
  if (!token) return false;
  const hash = sha256(token);
  const before = state.sessions.length;
  state.sessions = state.sessions.filter((session) => session.tokenHash !== hash);
  return before !== state.sessions.length;
}

export function resolveAdmin(state, token) {
  if (!token) return null;
  const now = Date.now();
  const hash = sha256(token);
  const session = state.sessions.find((item) => item.tokenHash === hash);
  if (!session || session.expiresAt <= now) return null;
  const admin = state.admins.find((item) => item.id === session.adminId);
  if (!admin || admin.disabled) return null;
  return admin;
}

export function publicAdmin(admin) {
  return {
    id: admin.id,
    username: admin.username,
    role: admin.role,
    disabled: Boolean(admin.disabled),
    createdAt: admin.createdAt,
    lastLoginAt: admin.lastLoginAt || null,
  };
}
