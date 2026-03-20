/**
 * layout/AppHeader.tsx
 *
 * Header principal: toggle sidebar, indicador de datos frescos,
 * toggle de tema, notificaciones, menú de usuario.
 *
 * El indicador "Datos: hace X min" muestra el último refetch exitoso
 * usando TanStack Query's queryClient.getQueryCache() — no hay polling manual.
 */
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useSidebar } from "@/context/SidebarContext";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import { useFilters } from "@/context/FilterContext";
import FilterBar from "@/components/filters/FilterBar";
import GlobalSearch from "@/components/search/GlobalSearch";

const AppHeader: React.FC = () => {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const { filters } = useFilters();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const scrollDir = useScrollDirection();
  const hideFilters = pathname === "/calendario" || pathname === "/usuarios" || pathname === "/ayuda";
  const hasInPageFilters = pathname === "/" || pathname === "/ventas" || pathname === "/acciones" || pathname === "/logistica" || pathname === "/depositos" || pathname.startsWith("/kpis");

  // Header visible when: at top, scrolling up, or mobile menu is open
  const isVisible = scrollDir !== "down" || isMenuOpen || isMobileOpen;

  const handleToggle = () => {
    if (window.innerWidth >= 1024) toggleSidebar();
    else toggleMobileSidebar();
  };

  return (
    <header
      className={`sticky top-0 flex flex-col w-full bg-white border-gray-200 z-99999 dark:border-gray-800 dark:bg-gray-900 lg:border-b transition-transform duration-300 ease-in-out ${
        isVisible ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      {/* Skip to content for keyboard navigation */}
      <a href="#main-content" className="skip-to-content">
        Ir al contenido principal
      </a>

      {/* Fila principal */}
      <div className="flex items-center justify-between w-full gap-2 px-3 py-3 border-b border-gray-200 dark:border-gray-800 sm:gap-4 lg:px-6 lg:py-4 lg:border-b-0">
        {/* Toggle sidebar */}
        <button
          className="flex items-center justify-center w-10 h-10 text-gray-500 border-gray-200 rounded-lg dark:border-gray-800 lg:border dark:text-gray-400 lg:h-11 lg:w-11"
          onClick={handleToggle}
          aria-label="Toggle Sidebar"
        >
          {isMobileOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z" fill="currentColor" />
            </svg>
          ) : (
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <path fillRule="evenodd" clipRule="evenodd" d="M0.583252 1C0.583252 0.585788 0.919038 0.25 1.33325 0.25H14.6666C15.0808 0.25 15.4166 0.585786 15.4166 1C15.4166 1.41421 15.0808 1.75 14.6666 1.75L1.33325 1.75C0.919038 1.75 0.583252 1.41422 0.583252 1ZM0.583252 11C0.583252 10.5858 0.919038 10.25 1.33325 10.25L14.6666 10.25C15.0808 10.25 15.4166 10.5858 15.4166 11C15.4166 11.4142 15.0808 11.75 14.6666 11.75L1.33325 11.75C0.919038 11.75 0.583252 11.4142 0.583252 11ZM1.33325 5.25C0.919038 5.25 0.583252 5.58579 0.583252 6C0.583252 6.41421 0.919038 6.75 1.33325 6.75L7.99992 6.75C8.41413 6.75 8.74992 6.41421 8.74992 6C8.74992 5.58579 8.41413 5.25 7.99992 5.25L1.33325 5.25Z" fill="currentColor" />
            </svg>
          )}
        </button>

        {/* Logo mobile */}
        <Link to="/" className="lg:hidden">
          <img className="dark:hidden h-7 w-auto" src="/negro.avif" alt="FenixBrands" />
          <img className="hidden dark:block h-7 w-auto" src="/blanco.png" alt="FenixBrands" />
        </Link>

        {/* Filtros globales — solo desktop, oculto en calendario */}
        {!hideFilters && (
          <div className="hidden lg:flex lg:items-center lg:gap-3 lg:flex-1">
            <FilterBar filters={filters} compact brandOnly={hasInPageFilters} />
          </div>
        )}
        {hideFilters && <div className="hidden lg:flex lg:flex-1" />}

        {/* Menú móvil toggle */}
        <button
          onClick={() => setMenuOpen(!isMenuOpen)}
          aria-label="Menu de opciones"
          aria-expanded={isMenuOpen}
          className="flex items-center justify-center w-10 h-10 text-gray-700 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"  stroke="currentColor" strokeWidth="2.5">
             <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

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

      {/* Menú móvil expandido */}
      {isMenuOpen && (
        <div className="flex flex-col gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-800 lg:hidden">
          <GlobalSearch />
          {!hideFilters && <FilterBar filters={filters} compact={false} brandOnly={hasInPageFilters} />}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => { setMenuOpen(false); navigate("/ayuda"); }}
              aria-label="Ayuda"
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-brand-400"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </button>
            <ThemeToggleButton />
            <NotificationDropdown />
          </div>
        </div>
      )}
    </header>
  );
};

export default AppHeader;
