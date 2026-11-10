import { useState } from 'react';
import type { Restaurant } from '@/data/restaurants';
import { openNavigation, type NavProvider } from '@/lib/navigation';

interface Props {
  r: Restaurant;
  onClose: () => void;
}

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      resolve();
    } catch (e) {
      reject(e);
    } finally {
      document.body.removeChild(ta);
    }
  });
}

export function DetailSheet({ r, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [imageBroken, setImageBroken] = useState(false);
  const [wechatHint, setWechatHint] = useState(false);

  const handleCopy = async () => {
    try {
      await copyText(`${r.name}：${r.address}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-[#faf7f0] p-5 pb-8 shadow-2xl animate-[slideUp_.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-300" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-stone-800 text-xs font-semibold text-[#faf7f0]">
                {r.id}
              </span>
              <h2 className="text-lg font-semibold text-stone-900">{r.name}</h2>
            </div>
            <p className="mt-1 text-xs text-stone-500">车程 {r.driveTime}</p>
          </div>
        </div>

        {r.address ? (
          <button
            onClick={handleCopy}
            className={`mt-2 flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition-colors ${
              copied
                ? 'border-green-300 bg-green-50 text-green-700'
                : 'border-stone-200 bg-white text-stone-600 active:bg-stone-50'
            }`}
          >
            <span className="min-w-0 flex-1 truncate">📍 {r.address}</span>
            <span className={`flex-none font-medium ${copied ? 'text-green-600' : 'text-orange-700'}`}>
              {copied ? '✓ 已复制' : '复制地址'}
            </span>
          </button>
        ) : (
          <p className="mt-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-xs text-stone-500">
            📍 填报人没写详细地址，去大众点评看看
          </p>
        )}

        {r.imageUrl && !imageBroken ? (
          <img
            src={r.imageUrl}
            alt={r.name}
            loading="lazy"
            onError={() => setImageBroken(true)}
            className="mt-3 h-40 w-full rounded-xl object-cover"
          />
        ) : null}

        <div className="mt-3 flex flex-wrap gap-1.5">
          {r.signature.map((s) => (
            <span key={s} className="rounded-full bg-orange-100 px-2.5 py-1 text-xs text-orange-800">
              {s}
            </span>
          ))}
        </div>

        {r.note ? <p className="mt-3 text-sm leading-relaxed text-stone-600">{r.note}</p> : null}

        {r.alert && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            ⚠️ {r.alert}
          </div>
        )}

        {typeof r.lat === 'number' && typeof r.lng === 'number' ? (
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] text-stone-400">导航过去</p>
            <div className="flex gap-2">
              {(['amap', 'baidu'] as NavProvider[]).map((provider) => (
                <button
                  key={provider}
                  onClick={() => {
                    if (typeof r.lat !== 'number' || typeof r.lng !== 'number') return;
                    const result = openNavigation(provider, r.name, { lat: r.lat, lng: r.lng });
                    if (result === 'wechat') setWechatHint(true);
                  }}
                  className="flex-1 rounded-xl border border-stone-200 bg-white py-2.5 text-center text-xs font-medium text-stone-700 active:bg-stone-50"
                >
                  {provider === 'amap' ? '高德地图' : '百度地图'}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-stone-400">
              手机上会直接拉起地图 App 开始导航
            </p>

            {wechatHint ? (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800">
                <p>微信里打不开地图 App（微信会拦截外部跳转），两个办法：</p>
                <p className="mt-1">① 点上面的「复制地址」，粘到高德 / 百度地图里搜</p>
                <p>② 点右上角「···」→「在浏览器打开」，再点导航按钮就能直接拉起 App</p>
                <button
                  onClick={handleCopy}
                  className="mt-2 rounded-lg bg-amber-700 px-3 py-1.5 text-[11px] text-white active:bg-amber-800"
                >
                  {copied ? '✓ 已复制地址' : '复制地址'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-stone-800 py-3 text-sm font-medium text-[#faf7f0] active:bg-stone-700"
          >
            知道了
          </button>
          {r.dp && (
            <a
              href={r.dp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#f63] py-3 text-sm font-medium text-white active:bg-[#e05525]"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9v-2h2v2zm0-4H9V7h2v5zm4 4h-2v-2h2v2zm0-4h-2V7h2v5z"/>
              </svg>
              大众点评
            </a>
          )}
        </div>
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(40%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}