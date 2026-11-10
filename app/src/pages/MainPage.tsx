import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { Restaurant } from '@/types';
import { MapView } from '@/components/MapView';
import { DetailSheet } from '@/components/DetailSheet';
import { RandomPicker } from '@/components/RandomPicker';
import { useRestaurants } from '@/hooks/useRestaurants';

type Tab = '地图' | '列表' | '抽一家';
const TABS: Tab[] = ['地图', '列表', '抽一家'];

function ListSkeleton() {
  return (
    <div className="mt-3 space-y-2">
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className="animate-pulse rounded-2xl border border-stone-200 bg-white p-3.5">
          <div className="h-4 w-32 rounded bg-stone-200" />
          <div className="mt-2 flex gap-1.5">
            <div className="h-4 w-16 rounded-full bg-stone-100" />
            <div className="h-4 w-14 rounded-full bg-stone-100" />
          </div>
          <div className="mt-2 h-3 w-48 rounded bg-stone-100" />
        </div>
      ))}
    </div>
  );
}

export default function MainPage() {
  const [tab, setTab] = useState<Tab>('地图');
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const { data: restaurants, loading, error, reload } = useRestaurants();

  // 抽签池：车程 15 分钟内（far 由后端按车程计算，解析不出也算远）
  const nearPool = useMemo(() => restaurants.filter((item) => !item.far), [restaurants]);

  return (
    <div className="min-h-dvh bg-[#faf7f0] text-stone-900">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-[#faf7f0]/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-start justify-between gap-3 px-4 pb-2 pt-4">
          <div>
            <h1 className="text-lg font-semibold">中午吃什么</h1>
            <p className="mt-0.5 text-xs text-stone-500">
              麓坊中心 · 15分钟车程 · {loading ? '加载中…' : restaurants.length + ' 家饭馆'}
            </p>
          </div>
          <Link
            to="/submit"
            className="flex-none rounded-full bg-stone-800 px-3 py-1.5 text-xs font-medium text-[#faf7f0] active:bg-stone-700"
          >
            ＋ 报一家
          </Link>
        </div>
        <nav className="mx-auto flex max-w-md gap-1 px-4 pb-2">
          {TABS.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={
                'flex-1 rounded-lg py-2 text-sm font-medium transition-colors ' +
                (tab === item ? 'bg-stone-800 text-[#faf7f0]' : 'text-stone-500 active:bg-stone-200')
              }
            >
              {item === '抽一家' ? '🎲 抽一家' : item}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-md pb-24">
        {error ? (
          <div className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
            <p>{error}</p>
            <button onClick={() => void reload()} className="mt-1.5 font-medium underline">
              重新加载
            </button>
          </div>
        ) : null}

        {tab === '地图' && (
          <div className="px-4 pt-3">
            <div className="rounded-2xl border border-stone-200 bg-white p-2 shadow-sm">
              {loading ? (
                <div className="flex h-[270px] animate-pulse items-center justify-center rounded-xl bg-stone-50 text-xs text-stone-400">
                  地图加载中…
                </div>
              ) : (
                <MapView restaurants={restaurants} selectedId={selected?.id ?? null} onSelect={setSelected} />
              )}
            </div>
            <div className="mt-2 flex items-center gap-4 px-1 text-[11px] text-stone-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-stone-800" /> 15分钟圈内
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-stone-400 bg-transparent" /> 超过 15 分钟
              </span>
              <span>点圆点看详情</span>
            </div>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
              正兴片区拆迁中：2号张血旺、3号小平肥肠粉、4号耙泥鳅去之前请在大众点评确认最新地址。
            </div>
            <Link
              to="/submit"
              className="mt-3 block rounded-xl border border-dashed border-stone-300 px-3 py-3 text-center text-xs text-stone-500 active:bg-stone-100"
            >
              还发现了好吃的馆子？点这里报上去，审核过就能出现在地图上 →
            </Link>
          </div>
        )}

        {tab === '列表' && (
          <div className="px-4 pt-3">
            {loading ? <ListSkeleton /> : null}

            {!loading && !error && restaurants.length === 0 ? (
              <p className="mt-10 text-center text-sm text-stone-400">还没有收录任何店，去报一家？</p>
            ) : null}

            <div className="mt-3 space-y-2">
              {restaurants.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className="w-full rounded-2xl border border-stone-200 bg-white p-3.5 text-left shadow-sm active:bg-stone-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          'inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-semibold ' +
                          (item.far
                            ? 'border border-dashed border-stone-400 text-stone-500'
                            : 'bg-stone-800 text-[#faf7f0]')
                        }
                      >
                        {item.id}
                      </span>
                      <span className="font-medium">{item.name}</span>
                      {item.alert ? <span className="text-xs">⚠️</span> : null}
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {item.signature.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] text-orange-800">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-stone-400">
                    {item.driveTime}
                    {item.address ? ' · ' + item.address : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === '抽一家' && (
          <RandomPicker pool={nearPool} onPick={(item) => setSelected(item)} />
        )}

        <div className="mt-8 flex items-center justify-center gap-4 px-4 pb-6 text-[11px] text-stone-400">
          <Link to="/status" className="underline underline-offset-2">
            查提交进度
          </Link>
          <span>·</span>
          <Link to="/admin" className="underline underline-offset-2">
            管理入口
          </Link>
        </div>
      </main>

      {selected ? <DetailSheet r={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}