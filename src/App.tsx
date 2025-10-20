import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import SignageDetail from "./pages/SignageDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/dashboard"
            element={
              <SidebarProvider>
                <div className="flex min-h-screen w-full">
                  <AppSidebar />
                  <div className="flex-1">
                    <header className="sticky top-0 z-10 border-b bg-card/50 backdrop-blur-sm">
                      <div className="flex items-center gap-4 p-4">
                        <SidebarTrigger />
                      </div>
                    </header>
                    <Dashboard />
                  </div>
                </div>
              </SidebarProvider>
            }
          />
          <Route
            path="/campaigns"
            element={
              <SidebarProvider>
                <div className="flex min-h-screen w-full">
                  <AppSidebar />
                  <div className="flex-1">
                    <header className="sticky top-0 z-10 border-b bg-card/50 backdrop-blur-sm">
                      <div className="flex items-center gap-4 p-4">
                        <SidebarTrigger />
                      </div>
                    </header>
                    <Campaigns />
                  </div>
                </div>
              </SidebarProvider>
            }
          />
          <Route
            path="/campaigns/:id"
            element={
              <SidebarProvider>
                <div className="flex min-h-screen w-full">
                  <AppSidebar />
                  <div className="flex-1">
                    <header className="sticky top-0 z-10 border-b bg-card/50 backdrop-blur-sm">
                      <div className="flex items-center gap-4 p-4">
                        <SidebarTrigger />
                      </div>
                    </header>
                    <CampaignDetail />
                  </div>
                </div>
              </SidebarProvider>
            }
          />
          <Route path="/signage/:id" element={<SignageDetail />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
