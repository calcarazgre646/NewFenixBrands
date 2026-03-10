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
            <Route index element={<ExecutivePage />} />
            <Route path="kpis" element={<KpiDashboardPage />} />
            <Route path="kpis/:categoryId" element={<KpiCategoryPage />} />
            <Route path="ventas" element={<SalesPage />} />
            <Route path="acciones" element={<ActionQueuePage />} />
            <Route path="logistica" element={<LogisticsPage />} />
            <Route path="calendario" element={<CalendarPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
