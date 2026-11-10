import test from 'node:test';
import assert from 'node:assert/strict';
import { placeOnMap, MAP, clampPoint } from '../placement.js';

const points = [
  { x: 330, y: 95 },
  { x: 128, y: 244 },
  { x: 560, y: 92 },
];

test('落点在画布范围内', () => {
  for (const direction of ['华阳', '正兴', '万安', '略远']) {
    const point = placeOnMap(direction, points, '测试店' + direction);
    assert.ok(point.x >= MAP.minX && point.x <= MAP.maxX, direction + ' x 越界: ' + point.x);
    assert.ok(point.y >= MAP.minY && point.y <= MAP.maxY, direction + ' y 越界: ' + point.y);
  }
});

test('新落点与已有圆点至少相距 28px', () => {
  for (const direction of ['华阳', '正兴', '万安', '略远']) {
    const point = placeOnMap(direction, points, '新店' + direction);
    for (const existing of points) {
      const distance = Math.hypot(point.x - existing.x, point.y - existing.y);
      assert.ok(distance >= 28, direction + ' 距离过近: ' + distance.toFixed(1));
    }
  }
});

test('同样的输入得到同样的落点', () => {
  const a = placeOnMap('华阳', points, '稳定小馆');
  const b = placeOnMap('华阳', points, '稳定小馆');
  assert.deepEqual(a, b);
});

test('点很多时依然能找到位置', () => {
  const crowded = [];
  for (let i = 0; i < 12; i += 1) crowded.push(placeOnMap('华阳', crowded, 'crowd-' + i));
  assert.equal(crowded.length, 12);
  for (let i = 0; i < crowded.length; i += 1) {
    for (let j = i + 1; j < crowded.length; j += 1) {
      assert.ok(Math.hypot(crowded[i].x - crowded[j].x, crowded[i].y - crowded[j].y) >= 28);
    }
  }
});

test('clampPoint 收敛到画布内并拒绝非法值', () => {
  assert.deepEqual(clampPoint(-100, 999), { x: MAP.minX, y: MAP.maxY });
  assert.equal(clampPoint('abc', 10), null);
});
