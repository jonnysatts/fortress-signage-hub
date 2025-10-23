import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import SignageDetail from "./pages/SignageDetail";
import Settings from "./pages/Settings";
import CustomFields from "./pages/CustomFields";
import Analytics from "./pages/Analytics";
import Calendar from "./pages/Calendar";
import UpcomingUpdates from "./pages/UpcomingUpdates";
import StaleContentWarnings from "./pages/StaleContentWarnings";
import FloorPlans from "./pages/FloorPlans";
import FloorPlanManager from "./pages/FloorPlanManager";
import FloorPlanEditor from "./pages/FloorPlanEditor";
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
              <ProtectedRoute>
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
              </ProtectedRoute>
            }
          />
          <Route
            path="/campaigns"
            element={
              <ProtectedRoute>
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
              </ProtectedRoute>
            }
          />
          <Route
            path="/campaigns/:id"
            element={
              <ProtectedRoute>
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
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SidebarProvider>
                  <div className="flex min-h-screen w-full">
                    <AppSidebar />
                    <div className="flex-1">
                      <header className="sticky top-0 z-10 border-b bg-card/50 backdrop-blur-sm">
                        <div className="flex items-center gap-4 p-4">
                          <SidebarTrigger />
                        </div>
                      </header>
                      <Settings />
                    </div>
                  </div>
                </SidebarProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/custom-fields"
            element={
              <ProtectedRoute>
                <SidebarProvider>
                  <div className="flex min-h-screen w-full">
                    <AppSidebar />
                    <div className="flex-1">
                      <header className="sticky top-0 z-10 border-b bg-card/50 backdrop-blur-sm">
                        <div className="flex items-center gap-4 p-4">
                          <SidebarTrigger />
                        </div>
                      </header>
                      <CustomFields />
                    </div>
                  </div>
                </SidebarProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <SidebarProvider>
                  <div className="flex min-h-screen w-full">
                    <AppSidebar />
                    <div className="flex-1">
                      <header className="sticky top-0 z-10 border-b bg-card/50 backdrop-blur-sm">
                        <div className="flex items-center gap-4 p-4">
                          <SidebarTrigger />
                        </div>
                      </header>
                      <Analytics />
                    </div>
                  </div>
                </SidebarProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <SidebarProvider>
                  <div className="flex min-h-screen w-full">
                    <AppSidebar />
                    <div className="flex-1">
                      <header className="sticky top-0 z-10 border-b bg-card/50 backdrop-blur-sm">
                        <div className="flex items-center gap-4 p-4">
                          <SidebarTrigger />
                        </div>
                      </header>
                      <Calendar />
                    </div>
                  </div>
                </SidebarProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/upcoming-updates"
            element={
              <ProtectedRoute>
                <SidebarProvider>
                  <div className="flex min-h-screen w-full">
                    <AppSidebar />
                    <div className="flex-1">
                      <header className="sticky top-0 z-10 border-b bg-card/50 backdrop-blur-sm">
                        <div className="flex items-center gap-4 p-4">
                          <SidebarTrigger />
                        </div>
                      </header>
                      <UpcomingUpdates />
                    </div>
                  </div>
                </SidebarProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/stale-content"
            element={
              <ProtectedRoute>
                <SidebarProvider>
                  <div className="flex min-h-screen w-full">
                    <AppSidebar />
                    <div className="flex-1">
                      <header className="sticky top-0 z-10 border-b bg-card/50 backdrop-blur-sm">
                        <div className="flex items-center gap-4 p-4">
                          <SidebarTrigger />
                        </div>
                      </header>
                      <StaleContentWarnings />
                    </div>
                  </div>
                </SidebarProvider>
              </ProtectedRoute>
            }
          />
          <Route 
            path="/signage/:id" 
            element={
              <ProtectedRoute>
                <SignageDetail />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/floor-plans"
            element={
              <ProtectedRoute>
                <SidebarProvider>
                  <div className="flex min-h-screen w-full">
                    <AppSidebar />
                    <div className="flex-1">
                      <header className="sticky top-0 z-10 border-b bg-card/50 backdrop-blur-sm">
                        <div className="flex items-center gap-4 p-4">
                          <SidebarTrigger />
                        </div>
                      </header>
                      <FloorPlans />
                    </div>
                  </div>
                </SidebarProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/floor-plans/manage"
            element={
              <ProtectedRoute>
                <SidebarProvider>
                  <div className="flex min-h-screen w-full">
                    <AppSidebar />
                    <div className="flex-1">
                      <header className="sticky top-0 z-10 border-b bg-card/50 backdrop-blur-sm">
                        <div className="flex items-center gap-4 p-4">
                          <SidebarTrigger />
                        </div>
                      </header>
                      <FloorPlanManager />
                    </div>
                  </div>
                </SidebarProvider>
              </ProtectedRoute>
            }
          />
          <Route
            path="/floor-plans/:id/edit"
            element={
              <ProtectedRoute>
                <FloorPlanEditor />
              </ProtectedRoute>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
