import { useCallback, useEffect, useRef, useState } from 'react';
import type { Restaurant } from '@/data/restaurants';

interface Props {
  pool: Restaurant[];
  onPick: (r: Restaurant) => void;
}

export function RandomPicker({ pool, onPick }: Props) {
  const [rolling, setRolling] = useState(false);
  const [current, setCurrent] = useState<Restaurant | null>(null);
  const [winner, setWinner] = useState<Restaurant | null>(null);
  const timer = useRef<number | null>(null);

  const roll = useCallback(() => {
    if (rolling || pool.length === 0) return;
    setRolling(true);
    setWinner(null);
    let ticks = 0;
    const total = 18 + Math.floor(Math.random() * 6);
    const step = () => {
      setCurrent(pool[Math.floor(Math.random() * pool.length)]);
      ticks += 1;
      if (ticks < total) {
        timer.current = window.setTimeout(step, 60 + ticks * 14);
      } else {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        setCurrent(pick);
        setWinner(pick);
        setRolling(false);
        onPick(pick);
      }
    };
    step();
  }, [pool, rolling, onPick]);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  return (
    <div className="flex flex-col items-center px-6 pt-10">
      <p className="text-sm text-stone-500">选择困难？让缘分决定今天中午吃啥</p>

      <div className="mt-8 flex h-40 w-full items-center justify-center rounded-2xl border border-stone-200 bg-white shadow-sm">
        {current ? (
          <div className="text-center">
            <div className={`text-2xl font-semibold ${winner ? 'text-orange-700' : 'text-stone-800'}`}>
              {current.name}
            </div>
            {winner && (
              <div className="mt-2 text-xs text-stone-500">
                {winner.signature.slice(0, 3).join(' · ')}
              </div>
            )}
          </div>
        ) : (
          <div className="text-4xl">🍚</div>
        )}
      </div>

      <button
        onClick={roll}
        disabled={rolling || pool.length === 0}
        className="mt-8 w-full rounded-2xl bg-orange-700 py-4 text-base font-semibold text-white shadow-lg active:scale-[0.98] disabled:opacity-60"
      >
        {rolling ? '挑选中…' : pool.length === 0 ? '没有可抽的店' : winner ? '不满意，再抽一次' : '今天吃啥？抽一家'}
      </button>

      {pool.length === 0 ? (
        <p className="mt-3 text-xs text-stone-400">车程 15 分钟内还没有收录的店，先去「列表」看看？</p>
      ) : (
        <p className="mt-3 text-xs text-stone-400">从车程 15 分钟内的 {pool.length} 家里随机抽选</p>
      )}
    </div>
  );
}