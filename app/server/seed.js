import crypto from 'node:crypto';
import { SEED_RESTAURANTS } from './shared.js';
import { DEFAULT_OFFICE } from './geo.js';
import { hashPassword } from './auth.js';

export function seedRestaurants(state) {
  if (state.restaurants.length > 0) return 0;
  const now = new Date().toISOString();
  for (const item of SEED_RESTAURANTS) {
    state.restaurants.push(
      Object.assign({}, item, {
        alert: item.alert || null,
        dp: item.dp || null,
        imageUrl: item.imageUrl || null,
        far: item.direction === '略远',
        status: 'published',
        source: 'seed',
        submissionId: null,
        createdAt: now,
        updatedAt: now,
      }),
    );
    state.counters.restaurantId = Math.max(state.counters.restaurantId, item.id);
  }
  return SEED_RESTAURANTS.length;
}

export function ensureOffice(state) {
  if (state.settings && state.settings.office) return false;
  state.settings = state.settings || {};
  state.settings.office = Object.assign({}, DEFAULT_OFFICE);
  return true;
}

export async function ensureAdmin(state, options = {}) {
  if (state.admins.length > 0) return { created: false };
  const generated = !options.password;
  const password = options.password || crypto.randomBytes(9).toString('base64url');
  const { salt, passwordHash } = await hashPassword(password);
  state.admins.push({
    id: crypto.randomUUID(),
    username: (options.username || 'admin').toLowerCase(),
    role: 'super',
    salt,
    passwordHash,
    disabled: false,
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  });
  return { created: true, username: (options.username || 'admin').toLowerCase(), password, generated };
}