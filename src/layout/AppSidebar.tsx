/**
 * layout/AppSidebar.tsx
 *
 * Sidebar de navegación principal.
 */
import { useCallback } from "react";
import { Link, useLocation } from "react-router";
import {
  BoltIcon,
  DollarLineIcon,
  HorizontaLDots,
  ListIcon,
  CalenderIcon,
  AngleLeftIcon,
  AngleRightIcon,
  BoxIcon,
} from "@/icons";
import { useSidebar } from "@/context/SidebarContext";

// Secciones principales del sidebar
const MAIN_NAV = [
  { path: "/",          label: "Inicio",             icon: <BoltIcon /> },
  { path: "/ventas",    label: "Ventas",               icon: <DollarLineIcon /> },
  { path: "/acciones",  label: "Centro de Acciones",    icon: <ListIcon /> },
  { path: "/logistica", label: "Logística / ETAs",    icon: <BoxIcon /> },
];

const ANALYSIS_NAV = [
  { path: "/calendario", label: "Calendario",     icon: <CalenderIcon /> },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, toggleSidebar } = useSidebar();
  const location = useLocation();

  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname]
  );

  const showLabel = isExpanded || isHovered || isMobileOpen;

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200
        ${isExpanded || isMobileOpen ? "w-[290px]" : isHovered ? "w-[290px]" : "w-[90px]"}
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo + colapsar */}
      <div className={`py-8 flex items-center ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-between"}`}>
        <Link to="/">
          {showLabel ? (
            <>
              <img src="/negro.avif" alt="FenixBrands" className="h-8 w-auto object-contain dark:hidden" />
              <img src="/blanco.png" alt="FenixBrands" className="h-8 w-auto object-contain hidden dark:block" />
            </>
          ) : (
            <>
              <img src="/images/logo/logo-icon.svg" alt="FenixBrands" className="h-8 w-8 object-contain dark:hidden" />
              <img src="/images/logo/logo-icon-dark.svg" alt="FenixBrands" className="h-8 w-8 object-contain hidden dark:block" />
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

      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">

            {/* ── Comercial ─── */}
            <div>
              <h2 className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`}>
                {showLabel ? "Comercial" : <HorizontaLDots className="size-6" />}
              </h2>
              <ul className="flex flex-col gap-2">
                {MAIN_NAV.map(({ path, label, icon }) => (
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

            {/* ── Análisis ─── */}
            <div>
              <h2 className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`}>
                {showLabel ? "Análisis" : <HorizontaLDots className="size-6" />}
              </h2>
              <ul className="flex flex-col gap-2">
                {ANALYSIS_NAV.map(({ path, label, icon }) => (
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

          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
