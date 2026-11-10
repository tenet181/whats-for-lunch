import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { api, errorMessage } from '@/lib/api';
import type { SubmissionStatus, SubmissionStatusView } from '@/types';

const STATUS_META: Record<SubmissionStatus, { label: string; className: string; desc: string }> = {
  pending: { label: '待审核', className: 'bg-amber-100 text-amber-800', desc: '管理员还没处理，通常一两天内会有结果。' },
  approved: { label: '已上架', className: 'bg-green-100 text-green-800', desc: '已经出现在地图和列表里了，谢谢你的推荐！' },
  rejected: { label: '未通过', className: 'bg-red-100 text-red-700', desc: '这次没有被收录，理由见下方。' },
};

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

export default function StatusPage() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const justSubmitted = Boolean((location.state as { justSubmitted?: boolean } | null)?.justSubmitted);

  const [input, setInput] = useState(params.code || '');
  const [data, setData] = useState<SubmissionStatusView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      setData(await api.submissionStatus(trimmed));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (params.code) void lookup(params.code);
  }, [params.code, lookup]);

  return (
    <div className="min-h-dvh bg-[#faf7f0] text-stone-900">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-[#faf7f0]/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/" className="text-sm text-stone-500">
            ← 返回
          </Link>
          <h1 className="text-base font-semibold">提交进度</h1>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pb-16 pt-3">
        {justSubmitted ? (
          <div className="mb-3 rounded-2xl border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800">
            ✅ 提交成功，已经进入待审核队列
          </div>
        ) : null}

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const code = input.trim().toUpperCase();
            if (!code) return;
            navigate('/status/' + code);
            void lookup(code);
          }}
        >
          <input
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm tracking-[0.2em] outline-none focus:border-stone-400"
            value={input}
            maxLength={6}
            placeholder="提交码，如 K7M2QX"
            onChange={(event) => setInput(event.target.value.toUpperCase())}
          />
          <button
            type="submit"
            className="flex-none rounded-xl bg-stone-800 px-4 text-sm font-medium text-[#faf7f0] active:bg-stone-700"
          >
            查询
          </button>
        </form>

        {loading ? <p className="mt-6 text-center text-sm text-stone-400">查询中…</p> : null}
        {error ? <p className="mt-6 text-center text-sm text-red-600">{error}</p> : null}

        {data ? (
          <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-base font-semibold">{data.name}</p>
                <p className="mt-1 text-xs text-stone-500">提交码 {data.code}</p>
              </div>
              <span className={'rounded-full px-2.5 py-1 text-xs font-medium ' + STATUS_META[data.status].className}>
                {STATUS_META[data.status].label}
              </span>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-stone-600">{STATUS_META[data.status].desc}</p>

            {data.rejectReason ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
                驳回理由：{data.rejectReason}
              </div>
            ) : null}

            <dl className="mt-3 space-y-1.5 text-xs text-stone-500">
              <div className="flex gap-2">
                <dt className="w-16 flex-none text-stone-400">地址</dt>
                <dd>{data.address || '未填写'}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 flex-none text-stone-400">提交时间</dt>
                <dd>{formatTime(data.createdAt)}</dd>
              </div>
              {data.reviewedAt ? (
                <div className="flex gap-2">
                  <dt className="w-16 flex-none text-stone-400">处理时间</dt>
                  <dd>{formatTime(data.reviewedAt)}</dd>
                </div>
              ) : null}
            </dl>

            <Link
              to="/submit"
              className="mt-4 block rounded-xl border border-stone-200 py-2.5 text-center text-sm text-stone-600 active:bg-stone-50"
            >
              再报一家
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}