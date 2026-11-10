import type { Direction } from '@/types';

export type { Direction, Restaurant } from '@/types';

export const CENTER = { x: 340, y: 170, name: '麓坊中心' };

export const DIRECTION_META: Record<Direction, { label: string; desc: string }> = {
  华阳: { label: '华阳老城', desc: '北边 · 约10–13分钟' },
  正兴: { label: '正兴', desc: '西南 · 约12–15分钟' },
  万安: { label: '万安', desc: '东北 · 约10–13分钟' },
  略远: { label: '略超15分钟', desc: '南边 · 顺路可去' },
};
