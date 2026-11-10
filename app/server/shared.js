import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const APP_DIR = path.resolve(here, '..');
export const SHARED_DIR = path.join(APP_DIR, 'shared');

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(SHARED_DIR, name), 'utf8'));
}

export const LIMITS = readJson('limits.json');
export const SEED_RESTAURANTS = readJson('seed-restaurants.json');

export const DIRECTIONS = ['华阳', '正兴', '万安', '略远'];
export const FAR_DIRECTION = '略远';
