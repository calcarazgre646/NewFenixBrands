/**
 * App.tsx — Routing principal con sistema de roles
 *
 * Estructura de rutas:
 *   /signin                — Pública, sin layout
 *   /                      — Inicio (Executive) — super_user, gerencia
 *   /kpis                  — Dashboard KPIs — super_user, gerencia
 *   /kpis/:categoryId      — KPI detalle — super_user, gerencia
 *   /ventas                — Ventas — todos
 *   /acciones              — Cola de Acciones — todos
 *   /logistica             — Logística — todos
 *   /depositos             — Depósitos — super_user, gerencia
 *   /calendario            — Calendario — todos
 *   /ayuda                 — Guía de uso — todos
 *   /sin-acceso            — Página de acceso restringido
 *
 * GUARD: RouteGuard verifica autenticación + permisos por ruta.
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Suspense, lazy } from "react";

import { useAuth } from "@/hooks/useAuth";
import { getDefaultRoute, type Permissions } from "@/domain/auth/types";
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
const DepotsPage        = lazy(() => import("@/features/depots/DepotsPage"));
const CalendarPage      = lazy(() => import("@/features/calendar/CalendarPage"));
const NoAccessPage         = lazy(() => import("@/features/auth/NoAccessPage"));
const ChangePasswordPage   = lazy(() => import("@/features/auth/ChangePasswordPage"));
const UsersPage            = lazy(() => import("@/features/users/UsersPage"));
const CommissionsPage      = lazy(() => import("@/features/commissions/CommissionsPage"));
const ProjectionPage       = lazy(() => import("@/features/projections/ProjectionPage"));
const MyProjectionPage     = lazy(() => import("@/features/projections/MyProjectionPage"));
const MarketingPage        = lazy(() => import("@/features/marketing/MarketingPage"));
const HelpPage             = lazy(() => import("@/features/help/HelpPage"));

// ─── Loading fallback ─────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── Route Guards ─────────────────────────────────────────────────────────────
/**
 * AuthGuard — verifica autenticación (sesión activa).
 * Se usa UNA vez, envolviendo AppLayout. No verifica permisos de ruta.
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, profile } = useAuth();

  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/signin" replace />;
  if (profile?.mustChangePassword) return <Navigate to="/cambiar-contrasena" replace />;
  return <>{children}</>;
}

/**
 * PermissionGuard — verifica permisos de ruta.
 * Solo evalúa el predicado `allowed`. NO re-chequea isLoading ni isAuthenticated
 * (ya garantizados por AuthGuard en el nivel superior).
 *
 * AuthGuard bloquea con spinner hasta que isLoading=false, lo cual incluye
 * session + profile. Cuando PermissionGuard se renderiza, profile ya está cargado.
 */
function PermissionGuard({
  children,
  allowed,
}: {
  children: React.ReactNode;
  allowed: (p: Permissions) => boolean;
}) {
  const { permissions } = useAuth();

  if (!allowed(permissions)) {
    return <Navigate to="/sin-acceso" replace />;
  }
  return <>{children}</>;
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Rutas públicas / sin layout */}
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/cambiar-contrasena" element={<ChangePasswordPage />} />

          {/* Rutas protegidas — dentro del layout con sidebar */}
          <Route
            element={
              <AuthGuard>
                <AppLayout />
              </AuthGuard>
            }
          >
            {/* Executive & KPIs — solo super_user y gerencia */}
            <Route index element={
              <PermissionGuard allowed={(p) => p.canViewExecutive}>
                <FeatureErrorBoundary feature="Inicio"><ExecutivePage /></FeatureErrorBoundary>
              </PermissionGuard>
            } />
            <Route path="kpis" element={
              <PermissionGuard allowed={(p) => p.canViewKpis}>
                <FeatureErrorBoundary feature="KPIs"><KpiDashboardPage /></FeatureErrorBoundary>
              </PermissionGuard>
            } />
            <Route path="kpis/:categoryId" element={
              <PermissionGuard allowed={(p) => p.canViewKpis}>
                <FeatureErrorBoundary feature="KPIs"><KpiCategoryPage /></FeatureErrorBoundary>
              </PermissionGuard>
            } />

            {/* Ventas, Acciones, Logística — todos los roles */}
            <Route path="ventas" element={
              <PermissionGuard allowed={(p) => p.canViewSales}>
                <FeatureErrorBoundary feature="Ventas"><SalesPage /></FeatureErrorBoundary>
              </PermissionGuard>
            } />
            <Route path="acciones" element={
              <PermissionGuard allowed={(p) => p.canViewActions}>
                <FeatureErrorBoundary feature="Centro de Acciones"><ActionQueuePage /></FeatureErrorBoundary>
              </PermissionGuard>
            } />
            <Route path="logistica" element={
              <PermissionGuard allowed={(p) => p.canViewLogistics}>
                <FeatureErrorBoundary feature="Logística"><LogisticsPage /></FeatureErrorBoundary>
              </PermissionGuard>
            } />

            {/* Depósitos — solo super_user y gerencia */}
            <Route path="depositos" element={
              <PermissionGuard allowed={(p) => p.canViewDepots}>
                <FeatureErrorBoundary feature="Depósitos"><DepotsPage /></FeatureErrorBoundary>
              </PermissionGuard>
            } />

            {/* Calendario — todos */}
            <Route path="calendario" element={
              <PermissionGuard allowed={(p) => p.canViewCalendar}>
                <FeatureErrorBoundary feature="Calendario"><CalendarPage /></FeatureErrorBoundary>
              </PermissionGuard>
            } />

            {/* Comisiones — super_user y gerencia */}
            <Route path="comisiones" element={
              <PermissionGuard allowed={(p) => p.canViewCommissions}>
                <FeatureErrorBoundary feature="Comisiones"><CommissionsPage /></FeatureErrorBoundary>
              </PermissionGuard>
            } />

            {/* Proyección por Vendedor — super_user y gerencia */}
            <Route path="proyeccion-vendedor" element={
              <PermissionGuard allowed={(p) => p.canViewSellerProjections}>
                <FeatureErrorBoundary feature="Proyección Vendedor"><ProjectionPage /></FeatureErrorBoundary>
              </PermissionGuard>
            } />

            {/* Mi Proyección — vendedor mapeado a su propia vista */}
            <Route path="mi-proyeccion" element={
              <PermissionGuard allowed={(p) => p.canViewMyProjection}>
                <FeatureErrorBoundary feature="Mi Proyección"><MyProjectionPage /></FeatureErrorBoundary>
              </PermissionGuard>
            } />

            {/* Marketing (SAM) — super_user y gerencia */}
            <Route path="marketing" element={
              <PermissionGuard allowed={(p) => p.canViewMarketing}>
                <FeatureErrorBoundary feature="Marketing"><MarketingPage /></FeatureErrorBoundary>
              </PermissionGuard>
            } />

            {/* Gestión de usuarios — solo super_user */}
            <Route path="usuarios" element={
              <PermissionGuard allowed={(p) => p.canManageUsers}>
                <FeatureErrorBoundary feature="Usuarios"><UsersPage /></FeatureErrorBoundary>
              </PermissionGuard>
            } />

            {/* Ayuda — todos los autenticados */}
            <Route path="ayuda" element={
              <FeatureErrorBoundary feature="Ayuda"><HelpPage /></FeatureErrorBoundary>
            } />

            {/* Acceso restringido */}
            <Route path="sin-acceso" element={<NoAccessPage />} />
          </Route>

          {/* Catch-all — redirige a ruta por defecto según rol */}
          <Route path="*" element={<SmartRedirect />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

/** Redirige al usuario a su ruta por defecto según permisos */
function SmartRedirect() {
  const { isAuthenticated, permissions } = useAuth();
  if (!isAuthenticated) return <Navigate to="/signin" replace />;
  return <Navigate to={getDefaultRoute(permissions)} replace />;
}
