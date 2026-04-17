/**
 * context/themeContext.ts
 *
 * React Context + value type para el tema.
 * Separado del Provider para que `react-refresh` pueda hacer HMR del Provider.
 */
import { createContext } from "react";

export type Theme = "light" | "dark";

export type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
