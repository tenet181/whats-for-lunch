import type { Restaurant } from '@/data/restaurants';
import { CENTER } from '@/data/restaurants';

interface Props {
  restaurants: Restaurant[];
  selectedId: number | null;
  onSelect: (r: Restaurant) => void;
}

export function MapView({ restaurants, selectedId, onSelect }: Props) {
  return (
    <svg viewBox="0 0 680 330" className="w-full h-auto select-none" role="img" aria-label="麓坊中心周边午餐示意地图">
      {/* 车程圈 */}
      {[55, 110, 165].map((r) => (
        <circle key={r} cx={CENTER.x} cy={CENTER.y} r={r} fill="none" stroke="#e7e0d4" strokeDasharray="4 4" strokeWidth="1" />
      ))}
      <text x={CENTER.x} y={CENTER.y - 60} textAnchor="middle" fontSize="10" fill="#b8ad9c">5分钟</text>
      <text x={CENTER.x} y={CENTER.y - 115} textAnchor="middle" fontSize="10" fill="#b8ad9c">10分钟</text>
      <text x={CENTER.x} y={CENTER.y - 170 + 14} textAnchor="middle" fontSize="10" fill="#b8ad9c">15分钟</text>

      {/* 方向标注 */}
      <text x="236" y="40" textAnchor="middle" fontSize="12" fill="#8a7f6d">↖ 华阳老城</text>
      <text x="588" y="60" textAnchor="middle" fontSize="12" fill="#8a7f6d">万安 ↗</text>
      <text x="98" y="316" textAnchor="middle" fontSize="12" fill="#8a7f6d">↙ 正兴</text>
      <text x="430" y="326" textAnchor="middle" fontSize="12" fill="#8a7f6d">↓ 太平 / 煎茶（略远）</text>

      {/* 中心 */}
      <circle cx={CENTER.x} cy={CENTER.y} r="7" fill="#c2410c" />
      <circle cx={CENTER.x} cy={CENTER.y} r="13" fill="none" stroke="#c2410c" strokeWidth="1" opacity="0.5" />
      <text x={CENTER.x} y={CENTER.y + 24} textAnchor="middle" fontSize="12" fontWeight="600" fill="#292524">麓坊中心</text>

      {/* 餐馆点 */}
      {restaurants.map((r) => {
        const selected = r.id === selectedId;
        const lx = r.x + (r.labelDx ?? 0);
        // 靠近顶边的点把文字放到下方，避免和方向标注/圆弧文字打架
        const ly = r.y + (r.labelDy ?? (r.y < 90 ? 18 : -14));
        return (
          <g key={r.id} onClick={() => onSelect(r)} className="cursor-pointer" style={{ touchAction: 'manipulation' }}>
            {/* 扩大触控热区 */}
            <circle cx={r.x} cy={r.y} r="20" fill="transparent" />
            {selected && <circle cx={r.x} cy={r.y} r="15" fill="none" stroke="#c2410c" strokeWidth="2" />}
            <circle
              cx={r.x} cy={r.y} r={selected ? 11 : 9}
              fill={r.far ? '#faf7f0' : '#292524'}
              stroke={r.far ? '#a89e8d' : '#292524'}
              strokeWidth="1.5"
              strokeDasharray={r.far ? '3 2' : undefined}
            />
            <text
              x={r.x} y={r.y} textAnchor="middle" dominantBaseline="central"
              fontSize="9" fontWeight="600"
              fill={r.far ? '#57534e' : '#faf7f0'}
              pointerEvents="none"
            >
              {r.id}
            </text>
            <text
              x={lx} y={ly} textAnchor={r.labelAnchor ?? 'middle'}
              fontSize="10.5" fill={selected ? '#c2410c' : '#57534e'}
              fontWeight={selected ? 600 : 400}
              pointerEvents="none"
            >
              {r.name.length > 7 ? r.name.slice(0, 7) + '…' : r.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}