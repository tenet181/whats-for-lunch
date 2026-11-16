import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 发布演示版到 GitHub Pages：构建 dist → 复制到临时目录 → 以 gh-pages 分支强推。
 * 之所以不用 Actions：普通 OAuth token 没有 workflow 权限，推不了新建的 workflow 文件；
 * 分支发布同样能自动上线（Pages 已设为 gh-pages / 根目录）。
 */
const appDir = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const repoDir = join(appDir, '..');

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: 'inherit', ...options });
}

/** fs.cpSync(recursive) 在本机 Windows 上会直接把 node 弄崩，这里手写一份拷贝。 */
function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);
    if (entry.isDirectory()) copyTree(source, target);
    else copyFileSync(source, target);
  }
}

console.log('[deploy] 1/4 构建演示版');
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build:demo'], {
  cwd: appDir,
  // Windows 上 .cmd 必须经由 shell 才能 spawn（Node 20+ 的安全限制）
  shell: process.platform === 'win32',
});

console.log('[deploy] 2/4 读取 origin');
const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: repoDir, encoding: 'utf8' }).trim();
console.log('         ' + remote);

console.log('[deploy] 3/4 准备 gh-pages 内容');
const staging = mkdtempSync(join(tmpdir(), 'wfl-pages-'));
copyTree(join(appDir, 'dist'), staging);
run('git', ['init', '-q', '-b', 'gh-pages'], { cwd: staging });
run('git', ['add', '-A'], { cwd: staging });
run(
  'git',
  ['-c', 'user.name=whats-for-lunch', '-c', 'user.email=noreply@github.com', 'commit', '-q', '-m', 'chore: 发布演示版静态产物'],
  { cwd: staging },
);

console.log('[deploy] 4/4 推送 gh-pages');
run('git', ['push', '--force', remote, 'gh-pages'], { cwd: staging });

rmSync(staging, { recursive: true, force: true });
console.log('[deploy] 完成：https://tenet181.github.io/whats-for-lunch/ （构建通常要 1 分钟左右生效）');