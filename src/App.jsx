import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Layout from './components/Layout';
import AuthPage from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Generator from './pages/Generator';
import Backlog from './pages/Backlog';
import HypothesisPage from './pages/Hypothesis';
import Datasets from './pages/Datasets';
import DatasetPage from './pages/Dataset';
import Settings from './pages/Settings';
import { Logo } from './components/Layout';

function Splash() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4">
      <div className="animate-pulse"><Logo size={44} /></div>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-slate-200"><div className="h-full w-1/2 animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-brand-500" /></div>
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={loading ? <Splash /> : user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={loading ? <Splash /> : user ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="generator" element={<Generator />} />
        <Route path="backlog" element={<Backlog />} />
        <Route path="hypotheses/:id" element={<HypothesisPage />} />
        <Route path="data" element={<Datasets />} />
        <Route path="data/:id" element={<DatasetPage />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
