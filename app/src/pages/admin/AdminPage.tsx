import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Modal } from '@/components/Modal';
import { api, errorMessage } from '@/lib/api';
import { useAdminAuth } from '@/hooks/adminAuth';
import type { AdminStats, Submission, SubmissionListResult, SubmissionStatus } from '@/types';
import { SubmissionSheet } from './SubmissionSheet';
import { RestaurantManager } from './RestaurantManager';
import { AccountsPanel } from './AccountsPanel';

type TabKey = 'pending' | 'approved' | 'rejected' | 'published' | 'accounts';

const STATUS_STYLE: Record<SubmissionStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
};
const STATUS_LABEL: Record<SubmissionStatus, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
};

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      resolve();
    } catch (err) {
      reject(err);
    } finally {
      document.body.removeChild(area);
    }
  });
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, logout } = useAdminAuth();
  const [tab, setTab] = useState<TabKey>('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<SubmissionListResult | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Submission | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);

  const isSuper = user?.role === 'super';
  const isSubmissionTab = tab === 'pending' || tab === 'approved' || tab === 'rejected';

  const loadStats = useCallback(async () => {
    try {
      setStats(await api.admin.stats());
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }, []);

  const loadList = useCallback(async () => {
    if (!isSubmissionTab) return;
    setLoading(true);
    try {
      setResult(await api.admin.submissions({ status: tab, q: search.trim(), page }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tab, search, page, isSubmissionTab]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    setPage(1);
  }, [tab, search]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadList(), loadStats()]);
  }, [loadList, loadStats]);

  const quickApprove = async (submission: Submission) => {
    try {
      await api.admin.approve(submission.id);
      toast.success('已上架：' + submission.data.name);
      await refreshAll();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  const shareSubmitLink = async () => {
    const url = window.location.origin + '/submit';
    try {
      await copyText(url);
      toast.success('填报链接已复制：' + url);
    } catch {
      toast.error('复制失败，手动复制：' + url);
    }
  };

  const changePassword = async () => {
    if (passwordBusy) return;
    setPasswordBusy(true);
    try {
      await api.admin.changePassword(currentPassword, newPassword);
      toast.success('密码已修改，请重新登录');
      setPasswordOpen(false);
      await logout();
      navigate('/admin/login', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPasswordBusy(false);
    }
  };

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: 'pending', label: '待审核', count: stats?.pending },
    { key: 'approved', label: '已通过' },
    { key: 'rejected', label: '已驳回' },
    { key: 'published', label: '店铺管理' },
  ];
  if (isSuper) tabs.push({ key: 'accounts', label: '账号' });

  return (
    <div className="min-h-dvh bg-[#faf7f0] text-stone-900">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-[#faf7f0]/95 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-base font-semibold">审核台</h1>
              <p className="mt-0.5 text-[11px] text-stone-500">
                {user ? user.username + (isSuper ? ' · 超级管理员' : ' · 审核员') : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button onClick={shareSubmitLink} className="rounded-full border border-stone-300 px-3 py-1.5 text-stone-600">
                填报链接
              </button>
              <button onClick={() => setPasswordOpen(true)} className="rounded-full border border-stone-300 px-3 py-1.5 text-stone-600">
                改密码
              </button>
              <button onClick={handleLogout} className="rounded-full bg-stone-800 px-3 py-1.5 text-[#faf7f0]">
                退出
              </button>
            </div>
          </div>

          <div className="mt-3 flex gap-1 overflow-x-auto">
            {tabs.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={
                  'flex-none rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ' +
                  (tab === item.key ? 'bg-stone-800 text-[#faf7f0]' : 'text-stone-500 active:bg-stone-200')
                }
              >
                {item.label}
                {item.count ? (
                  <span className="ml-1 rounded-full bg-orange-600 px-1.5 text-[10px] text-white">{item.count}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-20 pt-3">
        {stats ? (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: '待审核', value: stats.pending },
              { label: '在架', value: stats.published },
              { label: '本周提交', value: stats.newThisWeek },
              { label: '已驳回', value: stats.rejected },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-stone-200 bg-white px-2 py-2 text-center">
                <p className="text-lg font-semibold">{item.value}</p>
                <p className="text-[11px] text-stone-500">{item.label}</p>
              </div>
            ))}
          </div>
        ) : null}

        {isSubmissionTab ? (
          <>
            <div className="mt-3 flex gap-2">
              <input
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-stone-400"
                placeholder="搜店名 / 地址 / 联系方式"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {loading ? <p className="mt-8 text-center text-sm text-stone-400">加载中…</p> : null}

            {!loading && result && result.items.length === 0 ? (
              <div className="mt-12 text-center text-sm text-stone-400">
                <p>这里空空的</p>
                <p className="mt-1 text-xs">把「填报链接」发到群里，同事报的店会出现在这里。</p>
              </div>
            ) : null}

            <div className="mt-3 space-y-2">
              {result?.items.map((submission) => (
                <div key={submission.id} className="rounded-2xl border border-stone-200 bg-white p-3.5 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{submission.data.name}</span>
                        <span className={'rounded-full px-2 py-0.5 text-[10px] ' + STATUS_STYLE[submission.status]}>
                          {STATUS_LABEL[submission.status]}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-stone-500">{submission.data.address}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {submission.data.signature.map((tag) => (
                          <span key={tag} className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] text-orange-800">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[11px] text-stone-400">
                        {new Date(submission.createdAt).toLocaleString('zh-CN', { hour12: false })} · 提交码 {submission.code}
                      </p>
                    </div>
                    <div className="flex flex-none flex-col gap-1.5">
                      <button
                        onClick={() => setActive(submission)}
                        className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-[11px] text-stone-600"
                      >
                        {submission.status === 'pending' ? '审核' : '详情'}
                      </button>
                      {submission.status === 'pending' ? (
                        <button
                          onClick={() => void quickApprove(submission)}
                          className="rounded-lg bg-stone-800 px-2.5 py-1.5 text-[11px] text-[#faf7f0]"
                        >
                          直接通过
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {result && result.total > result.pageSize ? (
              <div className="mt-4 flex items-center justify-center gap-3 text-xs text-stone-500">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 disabled:opacity-40"
                >
                  上一页
                </button>
                <span>
                  {page} / {Math.ceil(result.total / result.pageSize)}
                </span>
                <button
                  disabled={page >= Math.ceil(result.total / result.pageSize)}
                  onClick={() => setPage((prev) => prev + 1)}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {tab === 'published' ? <RestaurantManager /> : null}
        {tab === 'accounts' && isSuper ? <AccountsPanel /> : null}

        <div className="mt-8 text-center">
          <Link to="/" className="text-[11px] text-stone-400 underline underline-offset-2">
            回到前台页面
          </Link>
        </div>
      </main>

      {active ? (
        <SubmissionSheet
          submission={active}
          onClose={() => setActive(null)}
          onDone={() => {
            setActive(null);
            void refreshAll();
          }}
        />
      ) : null}

      <Modal
        open={passwordOpen}
        title="修改密码"
        onClose={() => setPasswordOpen(false)}
        footer={
          <button
            onClick={() => void changePassword()}
            disabled={passwordBusy}
            className="w-full rounded-xl bg-stone-800 py-2.5 text-sm font-medium text-[#faf7f0] disabled:opacity-60"
          >
            确认修改
          </button>
        }
      >
        <div className="space-y-3">
          <input
            type="password"
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-stone-400"
            placeholder="当前密码"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <input
            type="password"
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-stone-400"
            placeholder="新密码（至少 6 位）"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <p className="text-[11px] text-stone-400">改完会用新密码重新登录一次。</p>
        </div>
      </Modal>
    </div>
  );
}