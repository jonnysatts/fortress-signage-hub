-- Fix ERROR level security issues

-- 1. Drop the SECURITY DEFINER view that bypasses RLS
-- The campaigns table already has proper RLS policies, so this view is redundant and risky
DROP VIEW IF EXISTS public.campaigns_public;

-- 2. Verify campaigns table RLS policies are comprehensive
-- (These already exist, just documenting for clarity)
-- Current policies:
-- - "All authenticated users can view campaigns" (SELECT with USING true)
-- - "Managers and admins can insert campaigns" (INSERT with proper role checks)
-- - "Managers and admins can update campaigns" (UPDATE with proper role checks)
-- - "Managers and admins can delete campaigns" (DELETE with proper role checks)

-- The existing RLS policies on campaigns table properly enforce:
-- - All authenticated users can view campaign data (including budget info)
-- - Only managers/admins can modify campaigns
-- This is the correct security model for the application