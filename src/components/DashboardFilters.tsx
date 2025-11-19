import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Grid3x3, List } from "lucide-react";
import { BulkScheduleDialog } from "@/components/BulkScheduleDialog";

interface VenueOption {
  id: string;
  name: string;
}

interface DashboardFiltersProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedVenue: string;
  setSelectedVenue: (value: string) => void;
  selectedPriority: string;
  setSelectedPriority: (value: string) => void;
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  venues: VenueOption[];
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;
  isMultiSelectMode: boolean;
  setIsMultiSelectMode: (value: boolean) => void;
  setSelectedSpots: (spots: Set<string>) => void;
  selectedSpots: Set<string>;
  onBulkSuccess: () => void;
}

export function DashboardFilters({
  searchQuery,
  setSearchQuery,
  selectedVenue,
  setSelectedVenue,
  selectedPriority,
  setSelectedPriority,
  selectedCategory,
  setSelectedCategory,
  venues,
  viewMode,
  setViewMode,
  isMultiSelectMode,
  setIsMultiSelectMode,
  setSelectedSpots,
  selectedSpots,
  onBulkSuccess,
}: DashboardFiltersProps) {
  return (
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
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-md border cursor-pointer transition-colors ${
            isMultiSelectMode 
              ? "bg-primary text-primary-foreground border-primary" 
              : "bg-background border-input hover:bg-accent hover:text-accent-foreground"
          }`}
          onClick={() => {
            setIsMultiSelectMode(!isMultiSelectMode);
            setSelectedSpots(new Set());
          }}
          title="Multi-select mode"
        >
          <Checkbox checked={isMultiSelectMode} className="pointer-events-none" />
        </div>
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
        {isMultiSelectMode && selectedSpots.size > 0 && (
          <BulkScheduleDialog 
            selectedSpotIds={Array.from(selectedSpots)} 
            onSuccess={onBulkSuccess}
          />
        )}
      </div>
    </div>
  );
}
