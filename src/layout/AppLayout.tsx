/**
 * layout/AppLayout.tsx
 *
 * Shell principal de la app: sidebar + header + contenido.
 * El SidebarProvider ya está en main.tsx — no se anida aquí.
 */
import { Outlet } from "react-router";
import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "./AppHeader";
import AppSidebar from "./AppSidebar";
import Backdrop from "./Backdrop";

export default function AppLayout() {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  return (
    <div className="min-h-screen xl:flex">
      <div>
        <AppSidebar />
        <Backdrop />
      </div>
      <div
        className={`flex-1 min-w-0 overflow-x-clip transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]"
        } ${isMobileOpen ? "ml-0" : ""}`}
      >
        <AppHeader />
        <main id="main-content" className="p-4 mx-auto max-w-(--breakpoint-2xl) md:p-6">
          <Outlet />
        </main>
        <p className="pb-6 pt-2 text-center text-[10px] font-light tracking-wide text-gray-300 dark:text-gray-700">
          Desarrollado por Subestática · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
