import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Modal } from '@/components/Modal';
import { api, errorMessage } from '@/lib/api';
import type { AdminUser } from '@/types';

export function AccountsPanel() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'reviewer' | 'super'>('reviewer');
  const [busy, setBusy] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.admin.accounts());
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.admin.createAccount({ username: username.trim(), password, role });
      toast.success('已创建账号：' + username.trim());
      setUsername('');
      setPassword('');
      setRole('reviewer');
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleDisabled = async (account: AdminUser) => {
    try {
      await api.admin.updateAccount(account.id, { disabled: !account.disabled });
      toast.success(account.disabled ? '已启用' : '已停用');
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const submitReset = async () => {
    if (!resetTarget) return;
    try {
      await api.admin.updateAccount(resetTarget.id, { password: resetPassword });
      toast.success('密码已重置');
      setResetTarget(null);
      setResetPassword('');
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-2xl border border-stone-200 bg-white p-3.5 shadow-sm">
        <p className="text-xs font-medium text-stone-700">新增管理员</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input
            className="rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-400"
            placeholder="用户名"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <input
            type="password"
            className="rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-400"
            placeholder="初始密码（≥6位）"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="mt-2 flex gap-2">
          <select
            className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-400"
            value={role}
            onChange={(event) => setRole(event.target.value === 'super' ? 'super' : 'reviewer')}
          >
            <option value="reviewer">审核员（只能审核）</option>
            <option value="super">超级管理员（可管账号）</option>
          </select>
          <button
            onClick={() => void create()}
            disabled={busy}
            className="rounded-xl bg-stone-800 px-4 py-2 text-sm font-medium text-[#faf7f0] disabled:opacity-60"
          >
            创建
          </button>
        </div>
      </div>

      {loading ? <p className="py-6 text-center text-sm text-stone-400">加载中…</p> : null}

      <div className="space-y-2">
        {items.map((account) => (
          <div key={account.id} className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  {account.username}
                  <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-600">
                    {account.role === 'super' ? '超级管理员' : '审核员'}
                  </span>
                  {account.disabled ? (
                    <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">已停用</span>
                  ) : null}
                </p>
                <p className="mt-1 text-[11px] text-stone-400">
                  最近登录：{account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString('zh-CN', { hour12: false }) : '从未登录'}
                </p>
              </div>
              <div className="flex flex-none gap-1.5">
                <button
                  onClick={() => setResetTarget(account)}
                  className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-[11px] text-stone-600"
                >
                  重置密码
                </button>
                <button
                  onClick={() => void toggleDisabled(account)}
                  className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-[11px] text-stone-600"
                >
                  {account.disabled ? '启用' : '停用'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={Boolean(resetTarget)}
        title={'重置密码 · ' + (resetTarget?.username || '')}
        onClose={() => setResetTarget(null)}
        footer={
          <button onClick={() => void submitReset()} className="w-full rounded-xl bg-stone-800 py-2.5 text-sm font-medium text-[#faf7f0]">
            确认重置
          </button>
        }
      >
        <input
          type="password"
          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-stone-400"
          placeholder="新密码（≥6位）"
          value={resetPassword}
          onChange={(event) => setResetPassword(event.target.value)}
        />
      </Modal>
    </div>
  );
}
