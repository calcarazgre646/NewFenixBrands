/**
 * layout/AppSidebar.tsx
 *
 * Sidebar de navegación principal.
 * Items filtrados según permisos del usuario.
 */
import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  BoltIcon,
  DollarLineIcon,
  HorizontaLDots,
  ListIcon,
  CalenderIcon,
  AngleLeftIcon,
  AngleRightIcon,
  ShipIcon,
  WarehouseIcon,
  GroupIcon,
} from "@/icons";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import { useFilters } from "@/context/FilterContext";
import { getRoleLabel, type Permissions } from "@/domain/auth/types";

// ─── Definición de items de navegación con permisos ─────────────────────────
interface NavItem {
  path:    string;
  label:   string;
  icon:    React.ReactNode;
  allowed: (p: Permissions) => boolean;
}

const ALL_MAIN_NAV: NavItem[] = [
  { path: "/",          label: "Inicio",              icon: <BoltIcon />,       allowed: (p) => p.canViewExecutive },
  { path: "/ventas",    label: "Ventas",              icon: <DollarLineIcon />, allowed: (p) => p.canViewSales },
  { path: "/acciones",  label: "Centro de Acciones",  icon: <ListIcon />,       allowed: (p) => p.canViewActions },
  { path: "/logistica", label: "Logística / ETAs",    icon: <ShipIcon />,      allowed: (p) => p.canViewLogistics },
  { path: "/depositos", label: "Depósitos",           icon: <WarehouseIcon />,  allowed: (p) => p.canViewDepots },
];

const ALL_ANALYSIS_NAV: NavItem[] = [
  { path: "/kpis",      label: "KPIs",       icon: <BoltIcon />,    allowed: (p) => p.canViewKpis },
  { path: "/calendario", label: "Calendario", icon: <CalenderIcon />, allowed: (p) => p.canViewCalendar },
];

const ALL_CONTROL_NAV: NavItem[] = [
  { path: "/usuarios", label: "Usuarios", icon: <GroupIcon />, allowed: (p) => p.canManageUsers },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const { user, logout, permissions, profile } = useAuth();
  const { resetFilters } = useFilters();
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Filtrar items de nav según permisos
  const mainNav = useMemo(
    () => ALL_MAIN_NAV.filter((item) => item.allowed(permissions)),
    [permissions]
  );
  const analysisNav = useMemo(
    () => ALL_ANALYSIS_NAV.filter((item) => item.allowed(permissions)),
    [permissions]
  );
  const controlNav = useMemo(
    () => ALL_CONTROL_NAV.filter((item) => item.allowed(permissions)),
    [permissions]
  );

  // Close user menu on click outside or Escape
  useEffect(() => {
    if (!userMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [userMenuOpen]);

  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname]
  );

  const showLabel = isExpanded || isHovered || isMobileOpen;

  const fullName = profile?.fullName || (user?.user_metadata?.full_name as string | undefined);
  const initials = fullName
    ? fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || "FB";
  const displayName = fullName || user?.email?.split("@")[0] || "Usuario";
  const firstName = fullName ? fullName.split(" ")[0] : displayName;

  // Saludo según hora del día
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";

  function handleLogout() {
    resetFilters();
    logout();
    navigate("/signin");
  }

  return (
    <aside
      className={`fixed flex flex-col top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200
        ${isExpanded || isMobileOpen ? "w-[290px]" : isHovered ? "w-[290px]" : "w-[90px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Mobile: saludo + flechita cerrar */}
      <div className="sidebar-mobile-logo hidden lg:!hidden">
        <span className="font-medium text-gray-500 dark:text-gray-400 truncate min-w-0 flex-1" style={{ fontSize: `${Math.min(13, Math.max(9, 330 / (`${greeting}, ${firstName}`).length))}px` }}>
          {greeting}, {firstName}
        </span>
        <button
          onClick={toggleMobileSidebar}
          className="flex items-center justify-center w-8 h-8 text-gray-400 dark:text-gray-500 shrink-0 ml-auto"
          aria-label="Cerrar menú"
        >
          <svg className="h-4 w-4" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 2l-4 4 4 4" />
          </svg>
        </button>
      </div>

      {/* Logo + colapsar (desktop) */}
      <div className={`sidebar-logo-original py-8 flex items-center ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-between"}`}>
        <Link to="/">
          {showLabel ? (
            <>
              <img src="/negro.avif" alt="FenixBrands" className="h-8 w-auto object-contain dark:hidden" />
              <img src="/blanco.png" alt="FenixBrands" className="h-8 w-auto object-contain hidden dark:block" />
            </>
          ) : (
            <>
              <img src="/images/logo/GH.png" alt="FenixBrands" className="h-8 w-8 object-contain dark:hidden" />
              <img src="/images/logo/GH2.png" alt="FenixBrands" className="h-8 w-8 object-contain hidden dark:block" />
            </>
          )}
        </Link>
        {showLabel && (
          <button
            type="button"
            onClick={toggleSidebar}
            title={isExpanded ? "Colapsar menú" : "Fijar menú"}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors shrink-0"
          >
            {isExpanded ? <AngleLeftIcon className="w-4 h-4" /> : <AngleRightIcon className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* ── Navigation (flex-1 pushes user section to bottom) ── */}
      <div className="flex flex-1 flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">

            {/* ── Comercial ─── */}
            {mainNav.length > 0 && (
              <div>
                <h2 className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`}>
                  {showLabel ? "Comercial" : <HorizontaLDots className="size-6" />}
                </h2>
                <ul className="flex flex-col gap-2">
                  {mainNav.map(({ path, label, icon }) => (
                    <li key={path}>
                      <Link to={path} className={`menu-item group ${isActive(path) ? "menu-item-active" : "menu-item-inactive"}`}>
                        <span className={`menu-item-icon-size ${isActive(path) ? "menu-item-icon-active" : "menu-item-icon-inactive"}`}>
                          {icon}
                        </span>
                        {showLabel && <span className="menu-item-text">{label}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Análisis ─── */}
            {analysisNav.length > 0 && (
              <div>
                <h2 className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`}>
                  {showLabel ? "Análisis" : <HorizontaLDots className="size-6" />}
                </h2>
                <ul className="flex flex-col gap-2">
                  {analysisNav.map(({ path, label, icon }) => (
                    <li key={path}>
                      <Link to={path} className={`menu-item group ${location.pathname.startsWith(path) ? "menu-item-active" : "menu-item-inactive"}`}>
                        <span className={`menu-item-icon-size ${location.pathname.startsWith(path) ? "menu-item-icon-active" : "menu-item-icon-inactive"}`}>
                          {icon}
                        </span>
                        {showLabel && <span className="menu-item-text">{label}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Control ─── */}
            {controlNav.length > 0 && (
              <div>
                <h2 className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`}>
                  {showLabel ? "Control" : <HorizontaLDots className="size-6" />}
                </h2>
                <ul className="flex flex-col gap-2">
                  {controlNav.map(({ path, label, icon }) => (
                    <li key={path}>
                      <Link to={path} className={`menu-item group ${isActive(path) ? "menu-item-active" : "menu-item-inactive"}`}>
                        <span className={`menu-item-icon-size ${isActive(path) ? "menu-item-icon-active" : "menu-item-icon-inactive"}`}>
                          {icon}
                        </span>
                        {showLabel && <span className="menu-item-text">{label}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          </div>
        </nav>
      </div>

      {/* ── User section (pinned to bottom — hidden on mobile, moved to header) ── */}
      <div ref={userMenuRef} className="sidebar-user-section relative shrink-0 border-t border-gray-200 py-4 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className={`dropdown-toggle flex w-full items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
            !showLabel ? "justify-center" : ""
          }`}
          aria-label="Menú de usuario"
          aria-expanded={userMenuOpen}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-600 dark:bg-brand-500/20 dark:text-brand-400">
            {initials}
          </span>
          {showLabel && (
            <>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                  {displayName}
                </span>
                <span className="block truncate text-[11px] text-gray-400 dark:text-gray-500">
                  {profile ? getRoleLabel(profile.role) : user?.email || ""}
                </span>
              </span>
              <svg
                className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
            </>
          )}
        </button>

        {/* Popover menu — opens upward */}
        {userMenuOpen && (
          <div className={`absolute z-50 rounded-xl border border-gray-200 bg-white p-1.5 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900 ${
            showLabel ? "bottom-full left-0 right-0 mb-2" : "bottom-full left-0 mb-2 w-[200px]"
          }`}>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Cerrar Sesión
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default AppSidebar;
