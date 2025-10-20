import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export const ImportDataButton = () => {
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-signage-data');
      
      if (error) throw error;
      
      toast.success(data.message);
      window.location.reload();
    } catch (error: any) {
      toast.error('Failed to import data: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Button 
      onClick={handleImport} 
      disabled={isImporting}
      className="gap-2"
    >
      <Upload className="w-4 h-4" />
      {isImporting ? 'Importing...' : 'Import Spreadsheet Data'}
    </Button>
  );
};
