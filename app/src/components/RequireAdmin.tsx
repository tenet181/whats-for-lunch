import { Navigate, Outlet } from 'react-router';
import { AdminAuthProvider } from '@/hooks/AdminAuthProvider';
import { useAdminAuth } from '@/hooks/adminAuth';

function AdminGuard() {
  const { user, loading, error } = useAdminAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#faf7f0] text-sm text-stone-500">
        正在校验登录状态…
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <p className="mt-2 text-xs text-stone-500">后端服务可能没启动，试试 npm run dev。</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" replace />;
  return <Outlet />;
}

export function RequireAdmin() {
  return (
    <AdminAuthProvider>
      <AdminGuard />
    </AdminAuthProvider>
  );
}
