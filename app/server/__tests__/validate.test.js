import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSubmission, validateRestaurantFields, validateRejectReason, normalizeName } from '../validate.js';

const base = {
  name: '测试小馆',
  direction: '华阳',
  address: '双流区华阳街道测试路 1 号',
  signature: ['回锅肉'],
  perCapita: 30,
  driveTime: '10–13分钟',
  note: '这是一家用于自动化测试的小馆子，味道还不错。',
};

test('合法的提交可以通过校验', () => {
  const result = validateSubmission(base);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, {});
  assert.equal(result.value.name, '测试小馆');
  assert.equal(result.value.perCapita, 30);
});

test('缺必填字段会返回字段级错误', () => {
  const result = validateSubmission({ ...base, name: '', signature: [] });
  assert.equal(result.ok, false);
  assert.ok(result.errors.name);
  assert.ok(result.errors.signature);
});

test('地址与点评改为选填', () => {
  const result = validateSubmission({ ...base, address: '', note: '' });
  assert.equal(result.ok, true);
  assert.equal(result.value.address, '');
  assert.equal(result.value.note, '');
});

test('超长字段被拒绝', () => {
  const result = validateSubmission({ ...base, name: '很'.repeat(30) });
  assert.equal(result.ok, false);
  assert.ok(result.errors.name);
});

test('非法方向被拒绝（管理端校验）', () => {
  const result = validateRestaurantFields({ ...base, direction: '火星' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.direction);
});

test('公开提交不强制方向（由地图选点反推）', () => {
  const result = validateSubmission({ ...base, direction: '' });
  assert.equal(result.ok, true);
});

test('javascript: 链接被拒绝', () => {
  const result = validateRestaurantFields({ ...base, dp: 'javascript:alert(1)' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.dp);
});

test('招牌菜数量上限', () => {
  const result = validateRestaurantFields({ ...base, signature: ['a', 'b', 'c', 'd', 'e'] });
  assert.equal(result.ok, false);
  assert.ok(result.errors.signature);
});

test('车程只填数字会自动补「分钟」', () => {
  assert.equal(validateRestaurantFields({ ...base, driveTime: '20' }).value.driveTime, '20分钟');
  assert.equal(validateRestaurantFields({ ...base, driveTime: '10-13' }).value.driveTime, '10-13分钟');
  assert.equal(validateRestaurantFields({ ...base, driveTime: '10–13分钟' }).value.driveTime, '10–13分钟');
});

test('车程为空时落为待确认', () => {
  const result = validateRestaurantFields({ ...base, driveTime: '' });
  assert.equal(result.ok, true);
  assert.equal(result.value.driveTime, '待确认');
});

test('蜜罐字段返回 honeypot 标记', () => {
  const result = validateSubmission({ ...base, website: 'http://spam.example' });
  assert.equal(result.honeypot, true);
});

test('驳回理由长度校验', () => {
  assert.equal(validateRejectReason('').ok, false);
  assert.equal(validateRejectReason('重复收录').ok, true);
});

test('店名归一化忽略空格和标点', () => {
  assert.equal(normalizeName(' 江油 肥肠 '), normalizeName('江油肥肠'));
  assert.equal(normalizeName('A店（总店）'), normalizeName('a店总店'));
});