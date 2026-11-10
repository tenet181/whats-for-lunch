import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 跨平台收集测试文件，避免依赖 shell 的通配符展开（Node 20 的 --test 不支持 glob）
const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, '..', 'server', '__tests__');

const files = fs
  .readdirSync(dir)
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => path.join(dir, name));

if (files.length === 0) {
  console.error('没有找到测试文件');
  process.exit(1);
}

const child = spawn(process.execPath, ['--test', ...files], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code === null ? 1 : code));
