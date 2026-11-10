import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.admin.login(username.trim(), password);
      toast.success('登录成功');
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#faf7f0] px-4 text-stone-900">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">管理员登录</h1>
        <p className="mt-1 text-xs text-stone-500">中午吃什么 · 审核台</p>

        <div className="mt-5 space-y-3">
          <input
            className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-stone-400"
            value={username}
            autoComplete="username"
            placeholder="用户名"
            disabled={submitting}
            onChange={(event) => setUsername(event.target.value)}
          />
          <input
            type="password"
            className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-stone-400"
            value={password}
            autoComplete="current-password"
            placeholder="密码"
            disabled={submitting}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 w-full rounded-xl bg-stone-800 py-3 text-sm font-medium text-[#faf7f0] active:bg-stone-700 disabled:opacity-60"
        >
          {submitting ? '登录中…' : '登录'}
        </button>

        <Link to="/" className="mt-4 block text-center text-xs text-stone-400 underline underline-offset-2">
          回到首页
        </Link>
      </form>
    </div>
  );
}
