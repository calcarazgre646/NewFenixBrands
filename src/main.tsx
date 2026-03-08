import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import "./index.css";
import "flatpickr/dist/flatpickr.css";
import App from "./App";
import { queryClient } from "@/lib/queryClient";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { FilterProvider } from "@/context/FilterContext";
import { SidebarProvider } from "@/context/SidebarContext";
import { AppWrapper } from "@/components/common/PageMeta";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
    {/* 1. Theme — debe estar primero para aplicar clase .dark al DOM */}
    <ThemeProvider>
      {/* 2. TanStack Query — proveedor de toda la capa de datos */}
      <QueryClientProvider client={queryClient}>
        {/* 3. Auth — necesita queryClient para invalidar caches en logout */}
        <AuthProvider>
          {/* 4. Filtros globales — por debajo de auth (necesita usuario) */}
          <FilterProvider>
            {/* 5. Sidebar — UI state */}
            <SidebarProvider>
              <AppWrapper>
                <App />
              </AppWrapper>
            </SidebarProvider>
          </FilterProvider>
        </AuthProvider>
        {/* DevTools solo en desarrollo */}
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);
