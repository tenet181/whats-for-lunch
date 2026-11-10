import { useState, type ReactNode } from 'react';
import type { RestaurantFieldsInput } from '@/types';
import type { FieldErrors } from '@/lib/validate';

interface Props {
  value: RestaurantFieldsInput;
  errors: FieldErrors;
  disabled?: boolean;
  onChange: (patch: Partial<RestaurantFieldsInput>) => void;
  /** public：填报页用，方向/地址由地图选点决定，点评与图片不在前台收集 */
  variant?: 'public' | 'admin';
  /** 渲染在「店名」之后的自定义区块（填报页用来插地图选点） */
  slotAfterName?: ReactNode;
  /** 渲染在「车程」输入框下方的额外操作（比如按定位估算） */
  driveTimeAction?: ReactNode;
}

const inputClass =
  'w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 outline-none transition-colors placeholder:text-stone-400 focus:border-stone-400 disabled:bg-stone-100';

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-xs font-medium text-stone-700">{label}</span>
        {hint ? <span className="text-[11px] text-stone-400">{hint}</span> : null}
      </div>
      {children}
      {error ? <p className="mt-1 text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}

export function RestaurantForm({
  value,
  errors,
  disabled,
  onChange,
  variant = 'admin',
  slotAfterName,
  driveTimeAction,
}: Props) {
  const [tagDraft, setTagDraft] = useState('');
  const isPublic = variant === 'public';

  const addTag = () => {
    const tag = tagDraft.trim();
    if (!tag) return;
    if (value.signature.length >= 4) {
      setTagDraft('');
      return;
    }
    if (value.signature.includes(tag)) {
      setTagDraft('');
      return;
    }
    onChange({ signature: [...value.signature, tag] });
    setTagDraft('');
  };

  return (
    <div className="space-y-4">
      <Field label="店名" hint="必填" error={errors.name}>
        <input
          className={inputClass}
          value={value.name}
          disabled={disabled}
          placeholder="比如：江油肥肠"
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </Field>

      {slotAfterName}

      {!isPublic ? (
        <>
          <Field label="详细地址" hint="选填" error={errors.address}>
            <input
              className={inputClass}
              value={value.address}
              disabled={disabled}
              placeholder="例：双流区华阳街道广都中街255号"
              onChange={(event) => onChange({ address: event.target.value })}
            />
          </Field>
        </>
      ) : null}

      <Field label="招牌菜" hint={'1-4 个，回车添加'} error={errors.signature}>
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={tagDraft}
            disabled={disabled || value.signature.length >= 4}
            placeholder={value.signature.length >= 4 ? '最多 4 个' : '比如：红烧肥肠'}
            onChange={(event) => setTagDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addTag();
              }
            }}
          />
          <button
            type="button"
            onClick={addTag}
            disabled={disabled || value.signature.length >= 4}
            className="flex-none rounded-xl border border-stone-300 px-3 text-sm text-stone-600 active:bg-stone-100 disabled:opacity-40"
          >
            添加
          </button>
        </div>
        {value.signature.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {value.signature.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs text-orange-800"
              >
                {tag}
                <button
                  type="button"
                  disabled={disabled}
                  className="text-orange-400 hover:text-orange-700"
                  onClick={() => onChange({ signature: value.signature.filter((item) => item !== tag) })}
                  aria-label={'删除 ' + tag}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="人均" hint="元，可不填" error={errors.perCapita}>
          <input
            type="number"
            inputMode="numeric"
            className={inputClass}
            value={value.perCapita === null ? '' : String(value.perCapita)}
            disabled={disabled}
            placeholder="35"
            onChange={(event) => {
              const raw = event.target.value;
              onChange({ perCapita: raw === '' ? null : Number(raw) });
            }}
          />
        </Field>
        <Field label="车程" hint="分钟，可不填" error={errors.driveTime}>
          <input
            className={inputClass}
            value={value.driveTime}
            disabled={disabled}
            placeholder="10–13 或 20"
            onChange={(event) => onChange({ driveTime: event.target.value })}
          />
          {driveTimeAction}
        </Field>
      </div>

      {!isPublic ? (
        <Field label="一句话点评" hint="选填，5-120 字" error={errors.note}>
          <textarea
            className={inputClass + ' min-h-[84px] resize-y leading-relaxed'}
            value={value.note}
            disabled={disabled}
            placeholder="为什么推荐？必点什么？"
            onChange={(event) => onChange({ note: event.target.value })}
          />
        </Field>
      ) : null}

      <Field label="大众点评链接" hint="可不填" error={errors.dp}>
        <input
          className={inputClass}
          value={value.dp}
          disabled={disabled}
          placeholder="https://m.dianping.com/..."
          onChange={(event) => onChange({ dp: event.target.value })}
        />
      </Field>

      {!isPublic ? (
        <Field label="门店图片链接" hint="可不填" error={errors.imageUrl}>
          <input
            className={inputClass}
            value={value.imageUrl}
            disabled={disabled}
            placeholder="https://..."
            onChange={(event) => onChange({ imageUrl: event.target.value })}
          />
        </Field>
      ) : null}
    </div>
  );
}