import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Group {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface GroupSelectorProps {
  signageSpotId: string;
  selectedGroups: Group[];
  onChange: () => void;
  disabled?: boolean;
}

export function GroupSelector({ 
  signageSpotId, 
  selectedGroups = [], 
  onChange, 
  disabled = false 
}: GroupSelectorProps) {
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('signage_groups')
        .select('*')
        .order('name');

      if (error) throw error;
      setAllGroups(data || []);
    } catch (error: any) {
      toast.error("Failed to load groups");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddGroup = async (groupId: string) => {
    try {
      const { error } = await supabase
        .from('signage_spot_groups')
        .insert({
          signage_spot_id: signageSpotId,
          group_id: groupId,
        });

      if (error) throw error;
      toast.success("Group added");
      onChange();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error("This group is already assigned");
      } else {
        toast.error("Failed to add group");
      }
      console.error(error);
    }
  };

  const handleRemoveGroup = async (groupId: string) => {
    try {
      const { error } = await supabase
        .from('signage_spot_groups')
        .delete()
        .eq('signage_spot_id', signageSpotId)
        .eq('group_id', groupId);

      if (error) throw error;
      toast.success("Group removed");
      onChange();
    } catch (error: any) {
      toast.error("Failed to remove group");
      console.error(error);
    }
  };

  const availableGroups = allGroups.filter(
    g => !selectedGroups.find(sg => sg.id === g.id)
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {selectedGroups.map((group) => (
          <Badge
            key={group.id}
            variant="secondary"
            className="gap-1"
            style={{ backgroundColor: group.color + '20', borderColor: group.color }}
          >
            {group.name}
            {!disabled && (
              <button
                onClick={() => handleRemoveGroup(group.id)}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </Badge>
        ))}
        {!disabled && availableGroups.length > 0 && (
          <Select onValueChange={handleAddGroup} disabled={isLoading}>
            <SelectTrigger className="w-[180px] h-6">
              <SelectValue placeholder="Add to group" />
            </SelectTrigger>
            <SelectContent>
              {availableGroups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    {group.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
