import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuthStore } from './store/auth';
import { useAwardRatesStore } from './store/awardRates';
import { Layout } from './components/Layout';
import { LoginForm } from './components/LoginForm';
import { Dashboard } from './pages/Dashboard';
import { Staff } from './pages/Staff';
import { Clients } from './pages/Clients';
import { Timesheets } from './pages/Timesheets';
import { ShiftAnalysis } from './pages/ShiftAnalysis';
import { ForecastAnalysis } from './pages/ForecastAnalysis';
import { AccessManagement } from './pages/admin/AccessManagement';
import { WorkforceHub } from './pages/WorkforceHub';
import { RuleEngineLayout } from './pages/rule-engine/RuleEngineLayout';
import { RulesReference } from './pages/rule-engine/RulesReference';
import { TestMonitor } from './pages/rule-engine/TestMonitor';
import { AwardRatesPage } from './pages/rule-engine/AwardRatesPage';
import { RateCardCoverage } from './pages/rule-engine/RateCardCoverage';
import { RosterCoverageLayout } from './pages/roster-coverage/RosterCoverageLayout';
import { RosterDashboard } from './pages/roster-coverage/RosterDashboard';
import { RosterFindCover } from './pages/roster-coverage/RosterFindCover';
import { RosterParticipants } from './pages/roster-coverage/RosterParticipants';
import { RosterTeam } from './pages/roster-coverage/RosterTeam';
import { RosterStaffProfile } from './pages/roster-coverage/RosterStaffProfile';
import { RosterTimesheetUpload } from './pages/roster-coverage/RosterTimesheetUpload';
import { RosterReports } from './pages/roster-coverage/RosterReports';
import { RosterShiftLog } from './pages/roster-coverage/RosterShiftLog';
import { CrmLayout } from './pages/crm/CrmLayout';
import { CrmDashboard } from './pages/crm/CrmDashboard';
import { CrmSupportCoordinators } from './pages/crm/CrmSupportCoordinators';
import { CrmLeads } from './pages/crm/CrmLeads';
import { CrmMarketingActivities } from './pages/crm/CrmMarketingActivities';
import { CrmImportExport } from './pages/crm/CrmImportExport';
import { CirPage } from './pages/cir/CirPage';
import { HrRequirementsPage } from './pages/hr-requirements/HrRequirementsPage';
import { canAccessPath, getDefaultLanding } from './config/nav';
import { LoadingScreen } from './ui/LoadingSpinner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const { isAuthenticated, checkAuthStatus, isLoading, user } = useAuthStore();
  const hydrateAwardRates = useAwardRatesStore((s) => s.hydrate);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  useEffect(() => {
    if (isAuthenticated) hydrateAwardRates();
  }, [isAuthenticated, hydrateAwardRates]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingScreen message="Checking authentication..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  const path = location.pathname;
  const permissions = user?.permissions ?? [];
  if (!canAccessPath(permissions, path)) {
    const defaultPath = getDefaultLanding(permissions);
    return <Navigate to={defaultPath} replace />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" richColors closeButton />
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
            path="/forecast-analysis"
            element={
              <ProtectedRoute>
                <ForecastAnalysis />
              </ProtectedRoute>
            }
          />
          <Route
            path="/forecast-actuals"
            element={
              <ProtectedRoute>
                <Navigate to="/forecast-analysis?tab=forecast-vs-actuals" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/standard-forecast"
            element={
              <ProtectedRoute>
                <Navigate to="/forecast-analysis?tab=templates" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/standard-vs-forecast"
            element={
              <ProtectedRoute>
                <Navigate to="/forecast-analysis?tab=standard-vs-forecast" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/access"
            element={
              <ProtectedRoute>
                <AccessManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <Navigate to="/admin/access" replace />
              </ProtectedRoute>
            }
          />
          <Route path="/pay-hours-tests" element={<Navigate to="/rule-engine/tests" replace />} />
          <Route
            path="/rule-engine"
            element={
              <ProtectedRoute>
                <RuleEngineLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RulesReference />} />
            <Route path="tests" element={<TestMonitor />} />
            <Route path="rates" element={<AwardRatesPage />} />
            <Route path="coverage" element={<RateCardCoverage />} />
          </Route>
          <Route
            path="/workforce"
            element={
              <ProtectedRoute>
                <WorkforceHub />
              </ProtectedRoute>
            }
          />
          <Route
            path="/roster-coverage"
            element={
              <ProtectedRoute>
                <RosterCoverageLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RosterDashboard />} />
            <Route path="shift-log" element={<RosterShiftLog />} />
            <Route path="find-cover" element={<RosterFindCover />} />
            <Route path="participants" element={<RosterParticipants />} />
            <Route path="team" element={<RosterTeam />} />
            <Route path="team/:staffId" element={<RosterStaffProfile />} />
            <Route path="timesheet" element={<RosterTimesheetUpload />} />
            <Route path="reports" element={<RosterReports />} />
          </Route>
          <Route
            path="/crm"
            element={
              <ProtectedRoute>
                <CrmLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<CrmDashboard />} />
            <Route path="support-coordinators" element={<CrmSupportCoordinators />} />
            <Route path="leads" element={<CrmLeads />} />
            <Route path="marketing" element={<CrmMarketingActivities />} />
            <Route path="import-export" element={<CrmImportExport />} />
            <Route path="staffing" element={<Navigate to="/hr-requirements" replace />} />
          </Route>
          <Route
            path="/continuous-improvement"
            element={
              <ProtectedRoute>
                <CirPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr-requirements"
            element={
              <ProtectedRoute>
                <HrRequirementsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/shifts" element={<ProtectedRoute><Navigate to="/workforce#workforce-roster" replace /></ProtectedRoute>} />
          <Route path="/pay-hours" element={<ProtectedRoute><Navigate to="/workforce#workforce-roster" replace /></ProtectedRoute>} />
          <Route path="/cost-analysis" element={<ProtectedRoute><Navigate to="/workforce?step=cost" replace /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
