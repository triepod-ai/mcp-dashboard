import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "@/components/ui/toaster.tsx";
import { ThemeProvider } from "./contexts/ThemeContext.tsx";
import DashboardApp from "./components/DashboardApp.tsx";
import "./index.css";
import { TooltipProvider } from "./components/ui/tooltip.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="mcp-dashboard-theme">
      <TooltipProvider>
        <DashboardApp />
      </TooltipProvider>
      <Toaster />
    </ThemeProvider>
  </StrictMode>,
);
