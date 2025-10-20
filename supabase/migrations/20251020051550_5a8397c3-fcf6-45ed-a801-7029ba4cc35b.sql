-- Create campaign templates table
CREATE TABLE public.campaign_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Template configuration
  template_config JSONB NOT NULL, -- Stores groups, tags, and other settings
  is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.campaign_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaign_templates
CREATE POLICY "All authenticated users can view templates"
  ON public.campaign_templates FOR SELECT
  USING (true);

CREATE POLICY "Managers and admins can create templates"
  ON public.campaign_templates FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers and admins can update templates"
  ON public.campaign_templates FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers and admins can delete templates"
  ON public.campaign_templates FOR DELETE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Create approval status enum
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Create approval_history table
CREATE TABLE public.approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signage_spot_id UUID REFERENCES public.signage_spots(id) ON DELETE CASCADE,
  photo_id UUID REFERENCES public.photo_history(id) ON DELETE CASCADE,
  
  status public.approval_status NOT NULL,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  comments TEXT,
  previous_status public.approval_status,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.approval_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for approval_history
CREATE POLICY "All authenticated users can view approval history"
  ON public.approval_history FOR SELECT
  USING (true);

CREATE POLICY "All authenticated users can create approval records"
  ON public.approval_history FOR INSERT
  WITH CHECK (true);

-- Add approval_status to photo_history
ALTER TABLE public.photo_history
ADD COLUMN approval_status public.approval_status DEFAULT 'pending';

-- Create indexes for performance
CREATE INDEX idx_campaign_templates_created_by ON public.campaign_templates(created_by);
CREATE INDEX idx_approval_history_signage_spot ON public.approval_history(signage_spot_id);
CREATE INDEX idx_approval_history_photo ON public.approval_history(photo_id);
CREATE INDEX idx_approval_history_status ON public.approval_history(status);
CREATE INDEX idx_photo_history_approval_status ON public.photo_history(approval_status);

-- Add trigger for updated_at on campaign_templates
CREATE TRIGGER update_campaign_templates_updated_at
  BEFORE UPDATE ON public.campaign_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();