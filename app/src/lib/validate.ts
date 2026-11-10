import limits from '../../shared/limits.json';
import type { RestaurantFieldsInput } from '@/types';
import { DIRECTIONS } from '@/types';

export type FieldErrors = Partial<Record<keyof RestaurantFieldsInput | 'pick', string>>;

function isHttpUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface ValidationResult {
  ok: boolean;
  errors: FieldErrors;
  value: RestaurantFieldsInput;
}

export function validateRestaurantFields(
  input: RestaurantFieldsInput,
  options: { requireDirection?: boolean } = {},
): ValidationResult {
  const requireDirection = options.requireDirection !== false;
  const errors: FieldErrors = {};
  const name = input.name.trim();
  const direction = input.direction;
  const address = input.address.trim();
  const signature = input.signature.map((item) => item.trim()).filter(Boolean);
  const driveTime = input.driveTime.trim() || '待确认';
  const note = input.note.trim();
  const dp = input.dp.trim();
  const imageUrl = input.imageUrl.trim();

  if (!name) errors.name = '请填写店名';
  else if (name.length < limits.name.min || name.length > limits.name.max) {
    errors.name = '店名需 ' + limits.name.min + '-' + limits.name.max + ' 字';
  }

  if (!direction && !requireDirection) {
    // 由地图选点反推，不在前台收集
  } else if (!direction || !DIRECTIONS.includes(direction)) {
    errors.direction = '请选择方向';
  }

  if (address && (address.length < limits.address.min || address.length > limits.address.max)) {
    errors.address = '地址需 ' + limits.address.min + '-' + limits.address.max + ' 字';
  }

  if (signature.length < limits.signature.min) errors.signature = '至少填 1 个招牌菜';
  else if (signature.length > limits.signature.max) errors.signature = '最多 ' + limits.signature.max + ' 个招牌菜';
  else if (signature.some((item) => item.length > limits.signature.itemMax)) {
    errors.signature = '每个招牌菜不超过 ' + limits.signature.itemMax + ' 字';
  }

  let perCapita: number | null = null;
  if (input.perCapita !== null && input.perCapita !== undefined && String(input.perCapita) !== '') {
    const value = Number(input.perCapita);
    if (!Number.isFinite(value) || value < limits.perCapita.min || value > limits.perCapita.max) {
      errors.perCapita = '人均写 ' + limits.perCapita.min + '-' + limits.perCapita.max + ' 的数字';
    } else {
      perCapita = Math.round(value);
    }
  }

  if (driveTime.length > limits.driveTime.max) errors.driveTime = '车程描述不超过 ' + limits.driveTime.max + ' 字';

  if (note.length > limits.note.max) errors.note = '点评不超过 ' + limits.note.max + ' 字';

  if (dp && (!isHttpUrl(dp) || dp.length > limits.url.max)) errors.dp = '需以 http:// 或 https:// 开头';
  if (imageUrl && (!isHttpUrl(imageUrl) || imageUrl.length > limits.url.max)) {
    errors.imageUrl = '需以 http:// 或 https:// 开头';
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    value: {
      name,
      direction,
      address,
      signature,
      perCapita,
      driveTime,
      note,
      dp: dp || '',
      imageUrl: imageUrl || '',
    },
  };
}