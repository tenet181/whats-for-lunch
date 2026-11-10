import { navigationTargets, type GeoPoint } from '@/lib/geo';

export type NavProvider = 'amap' | 'baidu';
export type NavResult = 'app' | 'web' | 'wechat';

export function isWeChatBrowser(): boolean {
  return /micromessenger/i.test(navigator.userAgent);
}

export function isMobileDevice(): boolean {
  return /android|iphone|ipad|ipod|harmonyos|mobile/i.test(navigator.userAgent);
}

/**
 * 移动端优先用 App 深链直接拉起导航；1.4 秒没切走就回落到网页版。
 * 微信内置浏览器会拦截深链，返回 'wechat' 由调用方给出替代方案。
 */
export function openNavigation(provider: NavProvider, name: string, point: GeoPoint): NavResult {
  const targets = navigationTargets(name, point);
  const web = provider === 'amap' ? targets.amap.web : targets.baidu.web;

  if (!isMobileDevice()) {
    window.open(web, '_blank', 'noopener');
    return 'web';
  }

  if (isWeChatBrowser()) return 'wechat';

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const scheme = provider === 'amap' ? (isIos ? targets.amap.ios : targets.amap.android) : targets.baidu.app;

  const timer = window.setTimeout(() => {
    if (!document.hidden) window.location.href = web;
  }, 1400);

  const onVisibility = () => {
    if (document.hidden) window.clearTimeout(timer);
  };
  document.addEventListener('visibilitychange', onVisibility, { once: true });

  try {
    window.location.href = scheme;
  } catch {
    window.clearTimeout(timer);
    window.location.href = web;
  }

  return 'app';
}
