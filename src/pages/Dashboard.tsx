import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { 
  LayoutGrid, 
  LogOut, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Circle,
  Search,
  Grid3x3,
  List,
  Plus,
  Image as ImageIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [venues, setVenues] = useState<any[]>([]);
  const [signageSpots, setSignageSpots] = useState<any[]>([]);
  const [selectedVenue, setSelectedVenue] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, selectedVenue]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);

    const { data: profileData } = await supabase
      .from("profiles" as any)
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();
    
    setProfile(profileData);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: venuesData } = await supabase
        .from("venues" as any)
        .select("*")
        .eq("is_active", true);
      setVenues(venuesData || []);

      let query = supabase
        .from("signage_spots" as any)
        .select("*, venues(*)")
        .order("created_at", { ascending: false });

      if (selectedVenue !== "all") {
        query = query.eq("venue_id", selectedVenue);
      }

      const { data: spotsData } = await query;
      setSignageSpots(spotsData || []);
    } catch (error: any) {
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const filteredSpots = signageSpots.filter((spot) =>
    spot.location_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: signageSpots.length,
    current: signageSpots.filter((s) => s.status === "current").length,
    expiring: signageSpots.filter((s) => s.status === "expiring_soon").length,
    overdue: signageSpots.filter((s) => s.status === "overdue").length,
    empty: signageSpots.filter((s) => s.status === "empty").length,
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
                  <LayoutGrid className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Fortress Signage</h1>
                  <p className="text-sm text-muted-foreground">
                    Welcome back, {profile?.full_name || user?.email}
                  </p>
                </div>
              </div>
            </div>

            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <CardDescription>Total Spots</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-0 shadow-md bg-status-current/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-status-current" />
                <CardDescription>Current</CardDescription>
              </div>
              <CardTitle className="text-3xl text-status-current">{stats.current}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-0 shadow-md bg-status-expiring/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-status-expiring" />
                <CardDescription>Expiring Soon</CardDescription>
              </div>
              <CardTitle className="text-3xl text-status-expiring">{stats.expiring}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-0 shadow-md bg-status-overdue/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-status-overdue" />
                <CardDescription>Overdue</CardDescription>
              </div>
              <CardTitle className="text-3xl text-status-overdue">{stats.overdue}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-0 shadow-md bg-status-empty/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Circle className="w-4 h-4 text-status-empty" />
                <CardDescription>Empty / Opportunity</CardDescription>
              </div>
              <CardTitle className="text-3xl text-status-empty">{stats.empty}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search signage locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={selectedVenue} onValueChange={setSelectedVenue}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Select venue" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Venues</SelectItem>
              {venues.map((venue) => (
                <SelectItem key={venue.id} value={venue.id}>
                  {venue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("grid")}
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Signage Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filteredSpots.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No signage spots found</h3>
              <p className="text-muted-foreground mb-4">Get started by creating your first signage spot</p>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Signage Spot
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className={`grid gap-4 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
            {filteredSpots.map((spot) => (
              <Card key={spot.id} className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="aspect-video bg-muted rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                    {spot.current_image_url ? (
                      <img src={spot.current_image_url} alt={spot.location_name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-12 h-12 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-1">{spot.location_name}</CardTitle>
                      <CardDescription>{spot.venues?.name}</CardDescription>
                    </div>
                    <StatusBadge status={spot.status} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    {spot.width_cm && spot.height_cm && (
                      <span>{spot.width_cm}cm × {spot.height_cm}cm</span>
                    )}
                    {spot.last_update_date && (
                      <span>Updated {new Date(spot.last_update_date).toLocaleDateString()}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
