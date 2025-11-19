import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { TrendingUp, TrendingDown, LayoutDashboard, Calendar as CalendarIcon, Image, AlertCircle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type SignageSpot = Database["public"]["Tables"]["signage_spots"]["Row"];
type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
type SignageCampaignRow = Database["public"]["Tables"]["signage_campaigns"]["Row"];
type CampaignWithLinks = CampaignRow & { signage_campaigns?: SignageCampaignRow[] | null };
type VenueRow = Database["public"]["Tables"]["venues"]["Row"];
type PhotoHistoryRow = Database["public"]["Tables"]["photo_history"]["Row"];

const COLORS = {
  current: 'hsl(var(--chart-1))',
  expiring_soon: 'hsl(var(--chart-2))',
  overdue: 'hsl(var(--chart-3))',
  empty: 'hsl(var(--chart-4))',
  planned: 'hsl(var(--chart-5))',
  high: 'hsl(var(--destructive))',
  medium: 'hsl(var(--chart-2))',
  low: 'hsl(var(--chart-4))',
};

export default function Analytics() {
  const navigate = useNavigate();
  const [signageSpots, setSignageSpots] = useState<SignageSpot[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignWithLinks[]>([]);
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [photoHistory, setPhotoHistory] = useState<PhotoHistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
  }, [navigate]);

  useEffect(() => {
    checkAuth();
    fetchData();
  }, [checkAuth]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [spotsRes, campaignsRes, venuesRes, photosRes] = await Promise.all([
        supabase.from('signage_spots').select('*'),
        supabase.from('campaigns').select('*, signage_campaigns(*)'),
        supabase.from('venues').select('*').eq('is_active', true),
        supabase.from('photo_history').select('*'),
      ]);

      setSignageSpots(spotsRes.data || []);
      setCampaigns((campaignsRes.data as CampaignWithLinks[] | null) || []);
      setVenues(venuesRes.data || []);
      setPhotoHistory(photosRes.data || []);
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate metrics
  const totalSpots = signageSpots.length;
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.is_active).length;
  const totalPhotos = photoHistory.length;

  // Status distribution
  const statusData = [
    { name: 'Current', value: signageSpots.filter(s => s.status === 'current').length, fill: COLORS.current },
    { name: 'Expiring Soon', value: signageSpots.filter(s => s.status === 'expiring_soon').length, fill: COLORS.expiring_soon },
    { name: 'Overdue', value: signageSpots.filter(s => s.status === 'overdue').length, fill: COLORS.overdue },
    { name: 'Empty', value: signageSpots.filter(s => s.status === 'empty').length, fill: COLORS.empty },
    { name: 'Planned', value: signageSpots.filter(s => s.status === 'planned').length, fill: COLORS.planned },
  ].filter(d => d.value > 0);

  // Priority distribution
  const priorityData = [
    { name: 'High', value: signageSpots.filter(s => s.priority_level === 'high').length, fill: COLORS.high },
    { name: 'Medium', value: signageSpots.filter(s => s.priority_level === 'medium').length, fill: COLORS.medium },
    { name: 'Low', value: signageSpots.filter(s => s.priority_level === 'low').length, fill: COLORS.low },
  ].filter(d => d.value > 0);

  // Venue distribution
  const venueData = venues.map(venue => ({
    name: venue.name,
    spots: signageSpots.filter(s => s.venue_id === venue.id).length,
  })).filter(d => d.spots > 0);

  // Campaign performance
  const campaignPerformance = campaigns.map(campaign => ({
    name: campaign.name,
    spots: campaign.signage_campaigns?.length || 0,
    status: campaign.is_active ? 'Active' : 'Inactive',
  })).sort((a, b) => b.spots - a.spots).slice(0, 10);

  // Monthly update trend (last 6 months)
  const getMonthlyUpdates = () => {
    const monthlyData: Record<string, number> = {};
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      monthlyData[monthKey] = 0;
    }

    photoHistory.forEach(photo => {
      const date = new Date(photo.upload_date);
      const monthKey = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      if (monthlyData[monthKey] !== undefined) {
        monthlyData[monthKey]++;
      }
    });

    return Object.entries(monthlyData).map(([month, updates]) => ({
      month,
      updates,
    }));
  };

  const monthlyUpdates = getMonthlyUpdates();

  // Health score calculation
  const healthScore = Math.round(
    ((signageSpots.filter(s => s.status === 'current').length / totalSpots) * 100)
  );

  const needsAttentionCount = signageSpots.filter(
    s => s.status === 'overdue' || s.status === 'expiring_soon'
  ).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Insights and metrics for your signage management
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Signage Spots</CardTitle>
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSpots}</div>
              <p className="text-xs text-muted-foreground">
                {needsAttentionCount} need attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeCampaigns}</div>
              <p className="text-xs text-muted-foreground">
                {totalCampaigns} total campaigns
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Health Score</CardTitle>
              {healthScore >= 70 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-destructive" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{healthScore}%</div>
              <p className="text-xs text-muted-foreground">
                Current signage ratio
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Photos</CardTitle>
              <Image className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPhotos}</div>
              <p className="text-xs text-muted-foreground">
                Across all signage
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Status Distribution</CardTitle>
                  <CardDescription>Current status of all signage spots</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Priority Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Priority Levels</CardTitle>
                  <CardDescription>Breakdown by priority</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={priorityData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))">
                        {priorityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Venue Distribution */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Signage by Venue</CardTitle>
                  <CardDescription>Distribution across all venues</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={venueData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="spots" fill="hsl(var(--primary))" name="Signage Spots" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Performance</CardTitle>
                <CardDescription>Top campaigns by signage coverage</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={campaignPerformance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="spots" fill="hsl(var(--primary))" name="Linked Spots" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Update Activity</CardTitle>
                <CardDescription>Photo uploads over the last 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyUpdates}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="updates" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      name="Photo Uploads"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {needsAttentionCount > 0 && (
              <Card className="border-destructive">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                    Attention Required
                  </CardTitle>
                  <CardDescription>Signage spots that need immediate action</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Overdue signage</span>
                      <span className="text-2xl font-bold text-destructive">
                        {signageSpots.filter(s => s.status === 'overdue').length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Expiring soon</span>
                      <span className="text-2xl font-bold text-yellow-500">
                        {signageSpots.filter(s => s.status === 'expiring_soon').length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
