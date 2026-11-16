import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * GitHub Pages 没有服务端重写：把 index.html 复制成 404.html，
 * 直接访问 /submit、/status/XXXX 这类前端路由时也能正常渲染。
 * 同时补一个 .nojekyll，避免下划线开头的文件被 Jekyll 忽略。
 */
const dist = join(process.cwd(), 'dist');
const index = join(dist, 'index.html');

if (!existsSync(index)) {
  console.error('[demo] 没找到 dist/index.html，先执行 vite build');
  process.exit(1);
}

copyFileSync(index, join(dist, '404.html'));
writeFileSync(join(dist, '.nojekyll'), '');
console.log('[demo] 已生成 dist/404.html 和 dist/.nojekyll');