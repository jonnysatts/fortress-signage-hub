import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Printer } from "lucide-react";
import { format, startOfWeek } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function UpcomingUpdates() {
  const [upcomingImages, setUpcomingImages] = useState<any[]>([]);
  const [printJobs, setPrintJobs] = useState<any[]>([]);

  useEffect(() => {
    fetchUpcomingUpdates();
    fetchPrintJobs();
  }, []);

  const fetchUpcomingUpdates = async () => {
    const { data } = await supabase
      .from("photo_history")
      .select(`
        *,
        signage_spots (
          location_name,
          venues (name)
        )
      `)
      .eq("image_type", "planned")
      .not("scheduled_date", "is", null)
      .order("scheduled_date", { ascending: true });

    setUpcomingImages(data || []);
  };

  const fetchPrintJobs = async () => {
    const { data } = await supabase
      .from("photo_history")
      .select(`
        *,
        signage_spots (
          location_name,
          venues (name)
        )
      `)
      .in("print_status", ["pending", "ordered", "in_production"])
      .not("print_due_date", "is", null)
      .order("print_due_date", { ascending: true });

    setPrintJobs(data || []);
  };

  const groupByWeek = (images: any[]) => {
    const grouped: Record<string, any[]> = {};
    images.forEach(img => {
      const week = format(startOfWeek(new Date(img.scheduled_date)), 'yyyy-MM-dd');
      if (!grouped[week]) grouped[week] = [];
      grouped[week].push(img);
    });
    return grouped;
  };

  const weeklyGroups = groupByWeek(upcomingImages);

  const getPrintStatusBadge = (status: string) => {
    const config: Record<string, { color: string; label: string }> = {
      pending: { color: 'bg-gray-500', label: 'Pending' },
      ordered: { color: 'bg-blue-500', label: 'Ordered' },
      in_production: { color: 'bg-yellow-500', label: 'In Production' },
    };
    return config[status] || config.pending;
  };

  return (
    <div className="space-y-6 p-8">
      <h1 className="font-fortress text-3xl font-bold">Upcoming Updates</h1>

      {/* Calendar View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Scheduled Updates by Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.entries(weeklyGroups).map(([week, images]) => (
            <div key={week} className="mb-6">
              <h3 className="font-semibold text-lg mb-3">
                Week of {format(new Date(week), 'MMM d, yyyy')}
              </h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {images.map((img: any) => (
                  <Card key={img.id}>
                    <div className="relative h-32 bg-muted">
                      <img
                        src={img.image_url}
                        alt={img.signage_spots?.location_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <CardContent className="p-3">
                      <p className="font-semibold text-sm">{img.signage_spots?.location_name}</p>
                      <p className="text-xs text-muted-foreground">{img.signage_spots?.venues?.name}</p>
                      <p className="text-xs text-blue-600 font-semibold mt-1">
                        {format(new Date(img.scheduled_date), 'MMM d, yyyy')}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Print Jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Active Print Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {printJobs.map((job: any) => {
              const statusConfig = getPrintStatusBadge(job.print_status);
              return (
                <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-semibold">{job.signage_spots?.location_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Vendor: {job.print_vendor} • Due: {format(new Date(job.print_due_date), 'MMM d')}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge className={`${statusConfig.color} text-white`}>
                      {statusConfig.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
