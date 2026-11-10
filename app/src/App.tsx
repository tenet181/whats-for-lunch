import { Route, Routes } from 'react-router';
import { Link } from 'react-router';
import MainPage from '@/pages/MainPage';
import SubmitPage from '@/pages/SubmitPage';
import StatusPage from '@/pages/StatusPage';
import LoginPage from '@/pages/admin/LoginPage';
import AdminPage from '@/pages/admin/AdminPage';
import { RequireAdmin } from '@/components/RequireAdmin';

function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#faf7f0] text-stone-700">
      <p className="text-sm">这个页面不存在</p>
      <Link to="/" className="text-xs underline underline-offset-2">
        回到首页
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainPage />} />
      <Route path="/submit" element={<SubmitPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/status/:code" element={<StatusPage />} />
      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin" element={<RequireAdmin />}>
        <Route index element={<AdminPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
