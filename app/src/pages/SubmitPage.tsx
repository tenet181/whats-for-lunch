import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { RestaurantForm } from '@/components/RestaurantForm';
import { MapPicker } from '@/components/MapPicker';
import { api, ApiError, errorMessage } from '@/lib/api';
import { validateRestaurantFields, type FieldErrors } from '@/lib/validate';
import { emptyRestaurantFields, type RestaurantFieldsInput } from '@/types';

const inputClass =
  'w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 outline-none transition-colors placeholder:text-stone-400 focus:border-stone-400';

export default function SubmitPage() {
  const navigate = useNavigate();
  const [fields, setFields] = useState<RestaurantFieldsInput>(emptyRestaurantFields());
  const [pick, setPick] = useState<{ lat: number; lng: number } | null>(null);
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const checked = validateRestaurantFields(fields, { requireDirection: false });
    const nextErrors: FieldErrors = { ...checked.errors };
    if (!pick) nextErrors.pick = '请在地图上点一下这家店的位置';

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error(pick ? '还有必填项没填好' : '先在地图上点一下位置');
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const result = await api.submit({
        ...checked.value,
        lat: pick!.lat,
        lng: pick!.lng,
        website: honeypot,
      });
      navigate('/status/' + result.code, { state: { justSubmitted: true } });
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields as FieldErrors);
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#faf7f0] text-stone-900">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-[#faf7f0]/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/" className="text-sm text-stone-500">
            ← 返回
          </Link>
          <h1 className="text-base font-semibold">报一家新馆子</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="mx-auto max-w-md px-4 pb-28 pt-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <RestaurantForm
            variant="public"
            value={fields}
            errors={errors}
            disabled={submitting}
            onChange={(patch) => {
              setFields((prev) => ({ ...prev, ...patch }));
              setErrors((prev) => {
                const next = { ...prev };
                for (const key of Object.keys(patch)) delete next[key as keyof FieldErrors];
                return next;
              });
            }}
            slotAfterName={
              <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-xs font-medium text-stone-700">
                    在哪儿 <span className="ml-1 font-normal text-red-500">必填</span>
                  </span>
                  <span className="text-[11px] text-stone-400">点地图选位置</span>
                </div>
                <MapPicker
                  value={pick}
                  onChange={(next) => {
                    setPick(next);
                    setErrors((prev) => ({ ...prev, pick: undefined }));
                  }}
                  onAddress={(address) => setFields((prev) => (prev.address ? prev : { ...prev, address }))}
                />
                <div className="mt-3">
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-xs font-medium text-stone-700">详细地址</span>
                    <span className="text-[11px] text-stone-400">选填，方便导航</span>
                  </div>
                  <input
                    className={inputClass}
                    value={fields.address}
                    disabled={submitting}
                    placeholder="例：双流区华阳街道广都中街255号"
                    onChange={(event) => setFields((prev) => ({ ...prev, address: event.target.value }))}
                  />
                  {errors.address ? <p className="mt-1 text-[11px] text-red-600">{errors.address}</p> : null}
                </div>
              </div>
            }
          />
        </div>

        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
          提交后会先进入待审核，管理员确认信息属实才会出现在地图上。重复的店会被自动挡下。
        </div>

        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 w-full rounded-2xl bg-orange-700 py-3.5 text-base font-semibold text-white shadow-lg active:scale-[0.99] disabled:opacity-60"
        >
          {submitting ? '提交中…' : '提交，等审核'}
        </button>
      </form>
    </div>
  );
}