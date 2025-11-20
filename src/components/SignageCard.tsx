import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/StatusBadge";
import { Calendar, ImageIcon, AlertCircle, Upload, ExternalLink, MapPin, Image, ChevronLeft, ChevronRight } from "lucide-react";

interface SpotVenue {
  name?: string | null;
}

interface SignageSpotSummary {
  id: string;
  location_name: string;
  width_cm: number | null;
  height_cm: number | null;
  current_image_url: string | null;
  location_photo_url: string | null;
  status: string;
  priority_level: string | null;
  last_update_date: string | null;
  venues?: SpotVenue | null;
}

interface ActiveCampaignSummary {
  campaigns: {
    id: string;
    name: string;
  };
}

interface SignageCardProps {
  spot: SignageSpotSummary;
  isMultiSelectMode: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
  onClick: () => void;
  daysSinceUpdate: number | null;
  needsUpdate: boolean;
  activeCampaign?: ActiveCampaignSummary | null;
  getPriorityBadgeVariant: (priority: string) => "destructive" | "default" | "secondary" | "outline";
  onQuickUpload?: () => void;
  onViewDetails?: () => void;
  onReportIssue?: () => void;
}

export function SignageCard({
  spot,
  isMultiSelectMode,
  isSelected,
  onToggleSelection,
  onClick,
  daysSinceUpdate,
  needsUpdate,
  activeCampaign,
  getPriorityBadgeVariant,
  onQuickUpload,
  onViewDetails,
  onReportIssue,
}: SignageCardProps) {
  const [showLocation, setShowLocation] = useState(false);
  
  const hasLocationPhoto = !!spot.location_photo_url;
  const hasCurrentImage = !!spot.current_image_url;
  const canToggle = hasLocationPhoto && hasCurrentImage;
  
  const displayImage = showLocation ? spot.location_photo_url : spot.current_image_url;
  
  return (
    <Card 
      className={`border-0 shadow-md hover:shadow-lg transition-all animate-fade-in ${
        isMultiSelectMode ? "" : "cursor-pointer hover:-translate-y-1"
      } ${isSelected ? "ring-2 ring-primary" : ""}`}
      onClick={onClick}
    >
      <CardHeader>
        <div className="relative">
          {isMultiSelectMode && (
            <div className="absolute top-2 left-2 z-10">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelection}
                className="bg-background"
              />
            </div>
          )}
          <div className="aspect-video bg-muted rounded-lg mb-3 flex items-center justify-center overflow-hidden relative group">
            {displayImage ? (
              <>
                <img src={displayImage} alt={spot.location_name} className="w-full h-full object-cover transition-opacity duration-300" />
                
                {canToggle && (
                  <>
                    {/* Navigation buttons */}
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLocation(!showLocation);
                      }}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLocation(!showLocation);
                      }}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    
                    {/* Label badge */}
                    <Badge 
                      variant="secondary" 
                      className="absolute top-2 left-2 text-xs flex items-center gap-1"
                    >
                      {showLocation ? (
                        <>
                          <MapPin className="w-3 h-3" />
                          Location Photo
                        </>
                      ) : (
                        <>
                          <Image className="w-3 h-3" />
                          Current Image
                        </>
                      )}
                    </Badge>
                    
                    {/* Carousel dots */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                      <button
                        className={`h-2 w-2 rounded-full transition-all ${
                          !showLocation ? "bg-primary w-4" : "bg-white/60 hover:bg-white/80"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowLocation(false);
                        }}
                        aria-label="Show current image"
                      />
                      <button
                        className={`h-2 w-2 rounded-full transition-all ${
                          showLocation ? "bg-primary w-4" : "bg-white/60 hover:bg-white/80"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowLocation(true);
                        }}
                        aria-label="Show location photo"
                      />
                    </div>
                  </>
                )}
              </>
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
          {activeCampaign && (
            <Badge variant="secondary" className="text-xs">
              <Calendar className="w-3 h-3 mr-1" />
              {activeCampaign.campaigns.name}
            </Badge>
          )}
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
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
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
        
        {/* Quick Action Buttons */}
        {!isMultiSelectMode && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:min-w-[100px]"
              onClick={(e) => {
                e.stopPropagation();
                onQuickUpload?.();
              }}
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline sm:ml-1">Upload</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:min-w-[100px]"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails?.();
              }}
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline sm:ml-1">Details</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:min-w-[100px] border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onReportIssue?.();
              }}
            >
              <AlertCircle className="w-4 h-4" />
              <span className="hidden sm:inline sm:ml-1">Report</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
