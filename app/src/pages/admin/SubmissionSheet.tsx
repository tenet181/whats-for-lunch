import { useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/Modal';
import { RestaurantForm } from '@/components/RestaurantForm';
import { api, errorMessage } from '@/lib/api';
import { validateRestaurantFields, type FieldErrors } from '@/lib/validate';
import type { RestaurantFieldsInput, Submission } from '@/types';

function toFields(submission: Submission): RestaurantFieldsInput {
  return {
    name: submission.data.name,
    direction: submission.data.direction,
    address: submission.data.address,
    signature: [...submission.data.signature],
    perCapita: submission.data.perCapita,
    driveTime: submission.data.driveTime,
    note: submission.data.note,
    dp: submission.data.dp || '',
    imageUrl: submission.data.imageUrl || '',
  };
}

interface Props {
  submission: Submission;
  onClose: () => void;
  onDone: () => void;
}

export function SubmissionSheet({ submission, onClose, onDone }: Props) {
  const [fields, setFields] = useState<RestaurantFieldsInput>(() => toFields(submission));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'edit' | 'reject'>('edit');
  const [busy, setBusy] = useState(false);

  const pending = submission.status === 'pending';

  const run = async (action: () => Promise<unknown>, success: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      toast.success(success);
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const estimateDriveTime = async () => {
    if (!submission.pick || !('lat' in submission.pick)) return;
    try {
      const est = await api.geoEstimate(submission.pick.lat, submission.pick.lng);
      setFields((prev) => ({ ...prev, driveTime: est.minutes + '分钟' }));
      toast.success('直线约 ' + (est.meters / 1000).toFixed(1) + ' 公里，估 ' + est.minutes + ' 分钟车程');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const check = () => {
    const result = validateRestaurantFields(fields);
    setErrors(result.errors);
    return result;
  };

  const handleApprove = () => {
    const result = check();
    if (!result.ok) {
      toast.error('先把字段补全再上架');
      return;
    }
    void run(() => api.admin.approve(submission.id, result.value), '已通过并上架：' + fields.name);
  };

  const handleSave = () => {
    const result = check();
    if (!result.ok) return;
    void run(() => api.admin.updateSubmission(submission.id, result.value), '修改已保存');
  };

  const handleReject = () => {
    if (reason.trim().length < 2) {
      toast.error('写一下驳回理由（至少 2 个字）');
      return;
    }
    void run(() => api.admin.reject(submission.id, reason.trim()), '已驳回');
  };

  const footer = pending ? (
    mode === 'reject' ? (
      <div className="space-y-2">
        <textarea
          className="min-h-[70px] w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-stone-400"
          placeholder="驳回理由，提交人凭提交码能看到"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={() => setMode('edit')}
            className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm text-stone-600"
          >
            取消
          </button>
          <button
            onClick={handleReject}
            disabled={busy}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-medium text-white disabled:opacity-60"
          >
            确认驳回
          </button>
        </div>
      </div>
    ) : (
      <div className="flex gap-2">
        <button
          onClick={() => setMode('reject')}
          className="flex-1 rounded-xl border border-stone-300 py-2.5 text-sm text-stone-600"
        >
          驳回
        </button>
        <button
          onClick={handleSave}
          disabled={busy}
          className="flex-1 rounded-xl border border-stone-300 py-2.5 text-sm text-stone-600 disabled:opacity-60"
        >
          保存修改
        </button>
        <button
          onClick={handleApprove}
          disabled={busy}
          className="flex-[1.4] rounded-xl bg-stone-800 py-2.5 text-sm font-medium text-[#faf7f0] disabled:opacity-60"
        >
          通过并上架
        </button>
      </div>
    )
  ) : null;

  return (
    <Modal
      open
      onClose={onClose}
      title={submission.data.name}
      subtitle={'提交码 ' + submission.code + ' · ' + new Date(submission.createdAt).toLocaleString('zh-CN', { hour12: false })}
      footer={footer}
    >
      {pending ? (
        <RestaurantForm
          value={fields}
          errors={errors}
          disabled={busy}
          driveTimeAction={
            submission.pick && 'lat' in submission.pick ? (
              <button
                type="button"
                onClick={() => void estimateDriveTime()}
                className="mt-1.5 text-[11px] text-orange-700 underline underline-offset-2"
              >
                按定位估算车程（直线距离）
              </button>
            ) : null
          }
          onChange={(patch) => {
            setFields((prev) => ({ ...prev, ...patch }));
            setErrors({});
          }}
        />
      ) : (
        <div className="space-y-3 text-sm text-stone-700">
          <p>
            <span className="text-xs text-stone-400">状态：</span>
            {submission.status === 'approved' ? '已上架（店铺 #' + (submission.restaurantId ?? '-') + '）' : '已驳回'}
          </p>
          <p>
            <span className="text-xs text-stone-400">地址：</span>
            {submission.data.address}
          </p>
          <p>
            <span className="text-xs text-stone-400">招牌菜：</span>
            {submission.data.signature.join('、')}
          </p>
          {submission.data.note ? (
            <p>
              <span className="text-xs text-stone-400">点评：</span>
              {submission.data.note}
            </p>
          ) : null}
          {submission.review?.reason ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              驳回理由：{submission.review.reason}
            </p>
          ) : null}
        </div>
      )}

      {submission.pick ? (
        <div className="mt-4 rounded-xl bg-stone-100 px-3 py-2 text-[11px] leading-relaxed text-stone-500">
          地图点位：{' '}
          {'lat' in submission.pick
            ? submission.pick.lat.toFixed(5) + ', ' + submission.pick.lng.toFixed(5)
            : '示意图 (' + submission.pick.x + ', ' + submission.pick.y + ')'}
          　通过后会落到图上这里
        </div>
      ) : null}

    </Modal>
  );
}