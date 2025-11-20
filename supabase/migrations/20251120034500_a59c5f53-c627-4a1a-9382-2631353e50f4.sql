-- Create comments table
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signage_spot_id UUID NOT NULL REFERENCES public.signage_spots(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mentions UUID[] DEFAULT ARRAY[]::UUID[],
  needs_attention BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view comments
CREATE POLICY "All authenticated users can view comments"
ON public.comments
FOR SELECT
TO authenticated
USING (true);

-- All authenticated users can create comments
CREATE POLICY "All authenticated users can create comments"
ON public.comments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
ON public.comments
FOR UPDATE
TO authenticated
USING (auth.uid() = author_id);

-- Users can delete their own comments, admins can delete any
CREATE POLICY "Users can delete own comments or admins delete any"
ON public.comments
FOR DELETE
TO authenticated
USING (
  auth.uid() = author_id OR
  has_role(auth.uid(), 'admin')
);

-- Add updated_at trigger
CREATE TRIGGER update_comments_updated_at
BEFORE UPDATE ON public.comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster queries
CREATE INDEX idx_comments_signage_spot_id ON public.comments(signage_spot_id);
CREATE INDEX idx_comments_author_id ON public.comments(author_id);
CREATE INDEX idx_comments_created_at ON public.comments(created_at DESC);