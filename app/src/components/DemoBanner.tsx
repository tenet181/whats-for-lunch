import { useEffect } from 'react';

const REPO_URL = 'https://github.com/tenet181/whats-for-lunch';

/** 演示版（GitHub Pages）固定底栏：说明数据在本地、后台不可用，并给出源码入口。 */
export function DemoBanner() {
  useEffect(() => {
    document.body.classList.add('demo-mode');
    return () => document.body.classList.remove('demo-mode');
  }, []);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-stone-200 bg-[#faf7f0]/95 px-3 py-2 text-center text-[11px] leading-snug text-stone-500 backdrop-blur">
      🧪 演示版 · 数据只存在这台浏览器，不含后台审核 ·{' '}
      <a
        className="underline underline-offset-2"
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
      >
        源码与完整版
      </a>
    </div>
  );
}