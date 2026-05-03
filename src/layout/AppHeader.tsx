/**
 * layout/AppHeader.tsx
 *
 * Header principal: toggle sidebar, indicador de datos frescos,
 * toggle de tema, notificaciones, menú de usuario.
 */
import { useState, useRef, useEffect, useContext } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useSidebar } from "@/hooks/useSidebar";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import { useFilters } from "@/hooks/useFilters";
import { useAuth } from "@/hooks/useAuth";
import GlobalSearch from "@/components/search/GlobalSearch";
import GlobalFilters from "@/components/filters/GlobalFilters";
import { ViewFilterSupportContext } from "@/context/viewFilters.context";

const AppHeader: React.FC = () => {
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const { resetFilters } = useFilters();
  const { user, profile, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [mobileUserMenu, setMobileUserMenu] = useState(false);
  const mobileUserRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileUserMenu) return;
    function handleClick(e: MouseEvent) {
      if (mobileUserRef.current && !mobileUserRef.current.contains(e.target as Node)) setMobileUserMenu(false);
    }
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") setMobileUserMenu(false); }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [mobileUserMenu]);

  function handleMobileLogout() {
    setMobileUserMenu(false);
    resetFilters();
    logout();
    navigate("/signin");
  }
  const scrollDir = useScrollDirection();
  const viewFilters = useContext(ViewFilterSupportContext);
  const filtersSupport = viewFilters?.support ?? null;

  // Header visible when: at top, scrolling up, or mobile sidebar is open
  const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;
  const isVisible = isMobile || scrollDir !== "down" || isMobileOpen;

  const fullName = profile?.fullName || (user?.user_metadata?.full_name as string | undefined);

  const handleToggle = () => {
    if (window.innerWidth >= 1024) toggleSidebar();
    else toggleMobileSidebar();
  };

  return (
    <>
    <header
      className={`sticky top-0 flex flex-col w-full bg-white border-gray-200 z-99999 dark:border-gray-800 dark:bg-gray-900 lg:border-b transition-all duration-300 ease-in-out ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      } ${isMobileOpen ? "sidebar-open" : ""}`}
      style={{ zIndex: 99999 }}
    >
      {/* Skip to content for keyboard navigation */}
      <a href="#main-content" className="skip-to-content">
        Ir al contenido principal
      </a>

      {/* Fila principal */}
      <div className="flex items-center justify-between w-full gap-2 px-3 py-3 border-b border-gray-200 dark:border-gray-800 sm:gap-4 lg:px-6 lg:py-4 lg:border-b-0">
        {/* Mobile: flechita + logo */}
        <div className="mobile-header-left lg:hidden flex items-center gap-2">
          <button
            className="sidebar-toggle-btn flex items-center justify-center w-8 h-8 text-gray-400 dark:text-gray-500 shrink-0"
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
          >
            <svg className={`h-4 w-4 transition-transform duration-300 ${isMobileOpen ? "rotate-180" : ""}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 2l4 4-4 4" />
            </svg>
          </button>
          <Link to="/" className="mobile-header-logo">
            <img className="dark:hidden h-7 w-auto" src="/negro.avif" alt="FenixBrands" />
            <img className="hidden dark:block h-7 w-auto" src="/blanco.png" alt="FenixBrands" />
          </Link>
        </div>

        {/* Acciones mobile — derecha: ?, tema, notificaciones, usuario */}
        <div className="mobile-header-actions flex items-center gap-1 ml-auto mr-[16px] lg:hidden">
          <button
            type="button"
            onClick={() => navigate("/ayuda")}
            aria-label="Ayuda"
            className={`flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-brand-400 ${
              pathname === "/ayuda" ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400" : ""
            }`}
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </button>
          <ThemeToggleButton />
          <NotificationDropdown />
          <div ref={mobileUserRef} className="relative">
            <button
              type="button"
              onClick={() => setMobileUserMenu(!mobileUserMenu)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-brand-400"
              aria-label="Menú de usuario"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </button>
            {mobileUserMenu && (
              <div className="absolute right-0 top-full mt-2 rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900" style={{ zIndex: 9999999, width: "max-content" }}>
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                  <p className="text-[12px] font-semibold text-gray-800 dark:text-white">{fullName || user?.email?.split("@")[0] || "Usuario"}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">{user?.email || ""}</p>
                </div>
                <button
                  type="button"
                  onClick={handleMobileLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 mt-1 text-[11px] font-medium text-gray-500 whitespace-nowrap hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filtros globales — alineados a la izquierda del header desktop.
            (Toggle del sidebar removido del header: el del propio sidebar ya
            cumple esa función y libera ~50px para los 3 dropdowns.)
            Cada Page declara su `support` con <DeclareViewFilters>. Las vistas
            que no lo declaran no muestran la barra. */}
        <div className="hidden lg:flex lg:items-center lg:gap-3 lg:flex-1">
          {filtersSupport && <GlobalFilters support={filtersSupport} />}
        </div>

        {/* Buscador global — desktop */}
        <div className="hidden lg:block">
          <GlobalSearch />
        </div>

        {/* Acciones derecha — desktop */}
        <div className="hidden lg:flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/ayuda")}
            aria-label="Ayuda"
            title="Guía de uso"
            className={`flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-brand-400 ${
              pathname === "/ayuda" ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400" : ""
            }`}
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </button>
          <ThemeToggleButton />
          <NotificationDropdown />
        </div>
      </div>

    </header>
    </>
  );
};

export default AppHeader;
