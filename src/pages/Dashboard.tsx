import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { ImportDataButton } from "@/components/ImportDataButton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  User,
  Trash2,
  Tag,
  Users,
  Calendar,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

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
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedPriority, setSelectedPriority] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showAssignedToMe, setShowAssignedToMe] = useState(false);
  const [selectedSpots, setSelectedSpots] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

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

    const { data: profileData, error: profileError } = await supabase
      .from("profiles" as any)
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();
    
    if (!profileError && profileData) {
      setProfile(profileData);
    }
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
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const filteredSpots = signageSpots.filter((spot) => {
    // Search filter
    if (!spot.location_name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Status filter
    if (selectedStatus !== "all" && spot.status !== selectedStatus) {
      return false;
    }
    
    // Priority filter
    if (selectedPriority !== "all" && spot.priority_level !== selectedPriority) {
      return false;
    }
    
    // Category filter
    if (selectedCategory !== "all" && spot.content_category !== selectedCategory) {
      return false;
    }
    
    // Assigned to me filter
    if (showAssignedToMe && spot.assigned_user_id !== user?.id) {
      return false;
    }
    
    return true;
  });

  const handleSelectAll = () => {
    if (selectedSpots.size === filteredSpots.length) {
      setSelectedSpots(new Set());
    } else {
      setSelectedSpots(new Set(filteredSpots.map(s => s.id)));
    }
  };

  const toggleSpotSelection = (spotId: string) => {
    const newSelected = new Set(selectedSpots);
    if (newSelected.has(spotId)) {
      newSelected.delete(spotId);
    } else {
      newSelected.add(spotId);
    }
    setSelectedSpots(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedSpots.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedSpots.size} signage spot(s)?`)) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from("signage_spots" as any)
        .delete()
        .in("id", Array.from(selectedSpots));
      
      if (error) throw error;
      
      toast.success(`Deleted ${selectedSpots.size} signage spot(s)`);
      setSelectedSpots(new Set());
      setIsMultiSelectMode(false);
      fetchData();
    } catch (error: any) {
      toast.error("Failed to delete spots: " + error.message);
    }
  };

  const getDaysSinceUpdate = (lastUpdateDate: string | null) => {
    if (!lastUpdateDate) return null;
    const daysDiff = Math.floor((Date.now() - new Date(lastUpdateDate).getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff;
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
      default:
        return "outline";
    }
  };

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

            <div className="flex items-center gap-2">
              <ImportDataButton />
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
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

        {/* Quick Status Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={selectedStatus === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedStatus("all")}
          >
            All ({signageSpots.length})
          </Button>
          <Button
            variant={selectedStatus === "current" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedStatus("current")}
            className={selectedStatus === "current" ? "" : "border-status-current/20"}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Current ({stats.current})
          </Button>
          <Button
            variant={selectedStatus === "expiring_soon" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedStatus("expiring_soon")}
            className={selectedStatus === "expiring_soon" ? "" : "border-status-expiring/20"}
          >
            <Clock className="w-3 h-3 mr-1" />
            Expiring ({stats.expiring})
          </Button>
          <Button
            variant={selectedStatus === "overdue" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedStatus("overdue")}
            className={selectedStatus === "overdue" ? "" : "border-status-overdue/20"}
          >
            <AlertCircle className="w-3 h-3 mr-1" />
            Overdue ({stats.overdue})
          </Button>
          <Button
            variant={selectedStatus === "empty" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedStatus("empty")}
            className={selectedStatus === "empty" ? "" : "border-status-empty/20"}
          >
            <Circle className="w-3 h-3 mr-1" />
            Empty ({stats.empty})
          </Button>
          <Button
            variant={showAssignedToMe ? "default" : "outline"}
            size="sm"
            onClick={() => setShowAssignedToMe(!showAssignedToMe)}
          >
            <User className="w-3 h-3 mr-1" />
            Assigned to Me
          </Button>
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

          <Select value={selectedPriority} onValueChange={setSelectedPriority}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="promotional">Promotional</SelectItem>
              <SelectItem value="wayfinding">Wayfinding</SelectItem>
              <SelectItem value="informational">Informational</SelectItem>
              <SelectItem value="safety">Safety</SelectItem>
              <SelectItem value="branding">Branding</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button
              variant={isMultiSelectMode ? "default" : "outline"}
              size="icon"
              onClick={() => {
                setIsMultiSelectMode(!isMultiSelectMode);
                setSelectedSpots(new Set());
              }}
              title="Multi-select mode"
            >
              <Checkbox checked={isMultiSelectMode} className="pointer-events-none" />
            </Button>
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

        {/* Bulk Operations Toolbar */}
        {isMultiSelectMode && selectedSpots.size > 0 && (
          <Card className="mb-6 border-primary">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">
                    {selectedSpots.size} spot{selectedSpots.size !== 1 ? "s" : ""} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {selectedSpots.size === filteredSpots.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Selected
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
            {filteredSpots.map((spot) => {
              const daysSinceUpdate = getDaysSinceUpdate(spot.last_update_date);
              const needsUpdate = daysSinceUpdate !== null && daysSinceUpdate > 180;
              
              return (
                <Card 
                  key={spot.id} 
                  className={`border-0 shadow-md hover:shadow-lg transition-shadow ${
                    isMultiSelectMode ? "" : "cursor-pointer"
                  } ${selectedSpots.has(spot.id) ? "ring-2 ring-primary" : ""}`}
                  onClick={() => {
                    if (isMultiSelectMode) {
                      toggleSpotSelection(spot.id);
                    } else {
                      navigate(`/signage/${spot.id}`);
                    }
                  }}
                >
                  <CardHeader>
                    <div className="relative">
                      {isMultiSelectMode && (
                        <div className="absolute top-2 left-2 z-10">
                          <Checkbox
                            checked={selectedSpots.has(spot.id)}
                            onCheckedChange={() => toggleSpotSelection(spot.id)}
                            className="bg-background"
                          />
                        </div>
                      )}
                      <div className="aspect-video bg-muted rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                        {spot.current_image_url ? (
                          <img src={spot.current_image_url} alt={spot.location_name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-12 h-12 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{spot.location_name}</CardTitle>
                        <CardDescription>{spot.venues?.name}</CardDescription>
                      </div>
                      <StatusBadge status={spot.status} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {spot.priority_level && (
                        <Badge variant={getPriorityBadgeVariant(spot.priority_level)} className="text-xs">
                          {spot.priority_level}
                        </Badge>
                      )}
                      {needsUpdate && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Update needed
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex flex-col gap-1">
                        {spot.width_cm && spot.height_cm && (
                          <span>{spot.width_cm}cm × {spot.height_cm}cm</span>
                        )}
                        {daysSinceUpdate !== null && (
                          <span className={needsUpdate ? "text-destructive font-medium" : ""}>
                            {daysSinceUpdate === 0 ? "Updated today" : `${daysSinceUpdate} days ago`}
                          </span>
                        )}
                      </div>
                      {spot.last_update_date && (
                        <span className="text-xs">{new Date(spot.last_update_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
