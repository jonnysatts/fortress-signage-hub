import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutGrid, Database, RefreshCw } from "lucide-react";

export default function DashboardPlaceholder() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full border-0 shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-primary mx-auto mb-4 flex items-center justify-center shadow-glow">
            <LayoutGrid className="w-10 h-10 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl">Dashboard Setting Up</CardTitle>
          <CardDescription className="text-base mt-2">
            Your database is being configured. This will only take a moment.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="bg-muted/50 rounded-xl p-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Database className="w-6 h-6 text-primary" />
              <RefreshCw className="w-6 h-6 text-primary animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground">
              Database tables, authentication, and storage are being created...
            </p>
          </div>

          <div className="space-y-3 text-sm text-left bg-card rounded-lg p-4 border">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-status-current flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Database Schema Created</p>
                <p className="text-muted-foreground text-xs">Tables for venues, signage, and campaigns</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-status-current flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Authentication Configured</p>
                <p className="text-muted-foreground text-xs">User roles and permissions system</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-status-expiring flex items-center justify-center flex-shrink-0 mt-0.5 animate-pulse">
                <RefreshCw className="w-3 h-3 text-white" />
              </div>
              <div>
                <p className="font-medium">Syncing Types...</p>
                <p className="text-muted-foreground text-xs">TypeScript types being generated</p>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <Button 
              onClick={() => window.location.reload()}
              size="lg"
              className="w-full"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Page
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              Click refresh in about 30 seconds to check if the setup is complete
            </p>
          </div>

          <Button 
            variant="outline"
            onClick={() => navigate("/")}
            className="w-full"
          >
            Back to Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
