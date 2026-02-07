import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/auth';
import { Layout } from './components/Layout';
import { LoginForm } from './components/LoginForm';
import { Dashboard } from './pages/Dashboard';
import { Staff } from './pages/Staff';
import { Clients } from './pages/Clients';
import { Timesheets } from './pages/Timesheets';
import { ShiftAnalysis } from './pages/ShiftAnalysis';
import { UserManagement } from './pages/UserManagement';
import { canAccessPath } from './config/nav';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const defaultLandingByRole = {
  super_admin: '/',
  finance: '/timesheets',
  viewer: '/',
};

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, checkAuthStatus, isLoading, user } = useAuthStore();

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Checking authentication...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  const path = location.pathname;
  const role = user?.role || 'viewer';
  if (!canAccessPath(role, path)) {
    const defaultPath = defaultLandingByRole[role] || '/';
    return <Navigate to={defaultPath} replace />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute>
                <Staff />
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <ProtectedRoute>
                <Clients />
              </ProtectedRoute>
            }
          />
          <Route
            path="/timesheets"
            element={
              <ProtectedRoute>
                <Timesheets />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shift-analysis"
            element={
              <ProtectedRoute>
                <ShiftAnalysis />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <UserManagement />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
