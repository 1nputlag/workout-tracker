import { Suspense, lazy } from 'react';
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { EmptyState, Loading } from './components/States';
import { LoginPage } from './pages/LoginPage';

import { WorkoutPage, WorkoutStartPage } from './pages/WorkoutPage';
import { HistoryPage } from './pages/HistoryPage';
import { ExercisesPage } from './pages/ExercisesPage';

// Головна з графіками (Recharts — найбільша залежність) завантажується окремим файлом
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));

/** Захищені сторінки: без токена — перенаправлення на вхід (E2E-05). */
function RequireAuth() {
  const { token, loading } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (loading) return <div className="mx-auto max-w-7xl px-4 md:px-10"><Loading /></div>;
  return <Outlet />;
}

function GuestOnly() {
  const { token } = useAuth();
  return token ? <Navigate to="/" replace /> : <Outlet />;
}

export function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route index element={<Suspense fallback={<Loading />}><DashboardPage /></Suspense>} />
          <Route path="workout" element={<WorkoutStartPage />} />
          <Route path="workout/:id" element={<WorkoutPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="exercises" element={<ExercisesPage />} />
          <Route path="*" element={<EmptyState title="Сторінку не знайдено" text="Перевірте адресу або поверніться на головну." action={<Link to="/" className="btn-dark">На головну</Link>} />} />
        </Route>
      </Route>
    </Routes>
  );
}
