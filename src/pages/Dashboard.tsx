import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SignageCard } from "@/components/SignageCard";
import { DashboardFilters } from "@/components/DashboardFilters";
import { OnboardingTour } from "@/components/OnboardingTour";
import { CreateSignageDialog } from "@/components/CreateSignageDialog";
import { useOnboarding } from "@/hooks/useOnboarding";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
  Plus,
  Image as ImageIcon,
  User as UserIcon,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

type Profile = Database['public']['Tables']['profiles']['Row'];
type Venue = Database['public']['Tables']['venues']['Row'];
type SignageSpot = Database['public']['Tables']['signage_spots']['Row'] & {
  venues?: Venue | null;
  signage_campaigns?: {
    campaign_id: string;
    campaigns: {
      id: string;
      name: string;
      is_active: boolean | null;
    } | null;
  }[] | null;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { showOnboarding, completeOnboarding, skipOnboarding } = useOnboarding();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [signageSpots, setSignageSpots] = useState<SignageSpot[]>([]);
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
  const [showUpcomingOnly, setShowUpcomingOnly] = useState(false);

  const checkAuth = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profileError && profileData) {
      setProfile(profileData);
    }
  }, [navigate]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: venuesData } = await supabase
        .from("venues")
        .select("*")
        .eq("is_active", true);
      setVenues(venuesData || []);

      let query = supabase
        .from("signage_spots")
        .select(`
          *,
          venues(*),
          signage_campaigns(
            campaign_id,
            campaigns(id, name, is_active)
          )
        `)
        .order("created_at", { ascending: false });

      if (selectedVenue !== "all") {
        query = query.eq("venue_id", selectedVenue);
      }

      const { data: spotsData, error } = await query;

      if (error) throw error;

      // Transform data to match SignageSpot type
      const spots = spotsData?.map(spot => ({
        ...spot,
        signage_campaigns: spot.signage_campaigns || []
      })) as unknown as SignageSpot[];

      setSignageSpots(spots || []);
    } catch (error: unknown) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedVenue]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const filteredSpots = useMemo(() => {
    return signageSpots.filter((spot) => {
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

      // Upcoming changes filter
      if (showUpcomingOnly && !spot.next_planned_date) {
        return false;
      }

      return true;
    });
  }, [signageSpots, searchQuery, selectedStatus, selectedPriority, selectedCategory, showAssignedToMe, showUpcomingOnly, user?.id]);

  const upcomingCount = signageSpots.filter(s => s.next_planned_date).length;

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
        .from("signage_spots")
        .delete()
        .in("id", Array.from(selectedSpots));

      if (error) throw error;

      toast.success(`Deleted ${selectedSpots.size} signage spot(s)`);
      setSelectedSpots(new Set());
      setIsMultiSelectMode(false);
      fetchData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to delete spots: " + errorMessage);
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

  const stats = useMemo(() => ({
    total: signageSpots.length,
    current: signageSpots.filter((s) => s.status === "current").length,
    expiring: signageSpots.filter((s) => s.status === "expiring_soon").length,
    overdue: signageSpots.filter((s) => s.status === "overdue").length,
    empty: signageSpots.filter((s) => s.status === "empty").length,
  }), [signageSpots]);

  return (
    <div className="bg-gradient-subtle min-h-screen">
      {showOnboarding && (
        <OnboardingTour
          onComplete={completeOnboarding}
          onSkip={skipOnboarding}
        />
      )}

      <main className="container mx-auto px-4 py-8">
        {/* Quick Status Filters */}
        <div className="flex flex-wrap gap-2 mb-6 items-center justify-between">
          <div className="flex flex-wrap gap-2">
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
              <UserIcon className="w-3 h-3 mr-1" />
              Assigned to Me
            </Button>
            <Button
              variant={showUpcomingOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowUpcomingOnly(!showUpcomingOnly)}
            >
              <Clock className="w-3 h-3 mr-1" />
              Upcoming Changes ({upcomingCount})
            </Button>
          </div>
          
          {/* Create Button - Only for Admins and Managers */}
          {(profile?.role === 'admin' || profile?.role === 'manager') && (
            <CreateSignageDialog onSuccess={fetchData} />
          )}
        </div>

        {/* Filters */}
        <DashboardFilters
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedVenue={selectedVenue}
          setSelectedVenue={setSelectedVenue}
          selectedPriority={selectedPriority}
          setSelectedPriority={setSelectedPriority}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          venues={venues}
          viewMode={viewMode}
          setViewMode={setViewMode}
          isMultiSelectMode={isMultiSelectMode}
          setIsMultiSelectMode={setIsMultiSelectMode}
          setSelectedSpots={setSelectedSpots}
          selectedSpots={selectedSpots}
          onBulkSuccess={fetchData}
        />

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
              const activeCampaign = spot.signage_campaigns?.find((sc) => sc.campaigns?.is_active);

              return (
                <SignageCard
                  key={spot.id}
                  spot={spot}
                  isMultiSelectMode={isMultiSelectMode}
                  isSelected={selectedSpots.has(spot.id)}
                  onToggleSelection={() => toggleSpotSelection(spot.id)}
                  onClick={() => {
                    if (isMultiSelectMode) {
                      toggleSpotSelection(spot.id);
                    } else {
                      navigate(`/signage/${spot.id}`);
                    }
                  }}
                  daysSinceUpdate={daysSinceUpdate}
                  needsUpdate={needsUpdate}
                  activeCampaign={activeCampaign}
                  getPriorityBadgeVariant={getPriorityBadgeVariant}
                  onQuickUpload={() => navigate(`/signage/${spot.id}?tab=upload`)}
                  onViewDetails={() => navigate(`/signage/${spot.id}`)}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
