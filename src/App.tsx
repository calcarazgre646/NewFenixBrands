/**
 * App.tsx — Routing principal
 *
 * Estructura de rutas:
 *   /signin                — Pública, sin layout
 *   /                      — Inicio
 *   /kpis                  — Dashboard KPIs (grid de 9 KPIs)
 *   /kpis/:categoryId      — (stub — sin implementar)
 *   /ventas                — Ventas
 *   /acciones              — Cola de Acciones (inventario waterfall)
 *   /logistica             — Logística (ETAs, importaciones)
 *   /calendario            — Calendario (FullCalendar + Supabase)
 *
 * GUARD: AuthGuard envuelve todas las rutas protegidas.
 * Si no hay usuario, redirige a /signin.
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Suspense, lazy } from "react";

import { useAuth } from "@/context/AuthContext";
import AppLayout from "@/layout/AppLayout";
import { FeatureErrorBoundary } from "@/components/common/FeatureErrorBoundary";
import { ScrollToTop } from "@/components/common/ScrollToTop";

// ─── Páginas (lazy load para code splitting) ──────────────────────────────────
const SignInPage        = lazy(() => import("@/features/auth/SignInPage"));
const ExecutivePage     = lazy(() => import("@/features/executive/ExecutivePage"));
const KpiDashboardPage  = lazy(() => import("@/features/kpis/KpiDashboardPage"));
const KpiCategoryPage   = lazy(() => import("@/features/kpis/KpiCategoryPage"));
const SalesPage         = lazy(() => import("@/features/sales/SalesPage"));
const ActionQueuePage   = lazy(() => import("@/features/action-queue/ActionQueuePage"));
const LogisticsPage     = lazy(() => import("@/features/logistics/LogisticsPage"));
const CalendarPage      = lazy(() => import("@/features/calendar/CalendarPage"));

// ─── Loading fallback ─────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── Auth Guard ───────────────────────────────────────────────────────────────
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Ruta pública */}
          <Route path="/signin" element={<SignInPage />} />

          {/* Rutas protegidas — dentro del layout con sidebar */}
          <Route
            element={
              <AuthGuard>
                <AppLayout />
              </AuthGuard>
            }
          >
            <Route index element={<FeatureErrorBoundary feature="Inicio"><ExecutivePage /></FeatureErrorBoundary>} />
            <Route path="kpis" element={<FeatureErrorBoundary feature="KPIs"><KpiDashboardPage /></FeatureErrorBoundary>} />
            <Route path="kpis/:categoryId" element={<FeatureErrorBoundary feature="KPIs"><KpiCategoryPage /></FeatureErrorBoundary>} />
            <Route path="ventas" element={<FeatureErrorBoundary feature="Ventas"><SalesPage /></FeatureErrorBoundary>} />
            <Route path="acciones" element={<FeatureErrorBoundary feature="Centro de Acciones"><ActionQueuePage /></FeatureErrorBoundary>} />
            <Route path="logistica" element={<FeatureErrorBoundary feature="Logística"><LogisticsPage /></FeatureErrorBoundary>} />
            <Route path="calendario" element={<FeatureErrorBoundary feature="Calendario"><CalendarPage /></FeatureErrorBoundary>} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
