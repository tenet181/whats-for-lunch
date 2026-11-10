import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '..');
const children = [];
let stopping = false;

function shutdown(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      child.kill();
    } catch {
      // ignore
    }
  }
  setTimeout(() => process.exit(code), 100);
}

function start(name, command, args) {
  const child = spawn(command, args, { cwd: appDir, stdio: 'inherit' });
  child.on('exit', (code) => {
    if (stopping) return;
    console.error('[' + name + '] 进程退出，退出码 ' + code);
    shutdown(code === null ? 1 : code);
  });
  child.on('error', (err) => {
    console.error('[' + name + '] 启动失败：' + err.message);
    shutdown(1);
  });
  children.push(child);
  return child;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('[dev] API  -> http://127.0.0.1:8787');
console.log('[dev] Web  -> http://127.0.0.1:3000');

start('api', process.execPath, ['server/index.js']);
start('web', process.execPath, [path.join(appDir, 'node_modules', 'vite', 'bin', 'vite.js')]);
