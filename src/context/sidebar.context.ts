/**
 * context/sidebarContext.ts
 *
 * React Context + value type para el sidebar.
 * Separado del Provider para que `react-refresh` pueda hacer HMR del Provider.
 */
import { createContext } from "react";

export type SidebarContextType = {
  isExpanded: boolean;
  isMobileOpen: boolean;
  isHovered: boolean;
  activeItem: string | null;
  openSubmenu: string | null;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
  setIsHovered: (isHovered: boolean) => void;
  setActiveItem: (item: string | null) => void;
  toggleSubmenu: (item: string) => void;
};

export const SidebarContext = createContext<SidebarContextType | undefined>(undefined);
