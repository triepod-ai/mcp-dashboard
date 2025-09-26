import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "@/components/ui/toaster.tsx";
import DashboardApp from "./components/DashboardApp.tsx";
import "./index.css";
import { TooltipProvider } from "./components/ui/tooltip.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <DashboardApp />
    </TooltipProvider>
    <Toaster />
  </StrictMode>,
);
