-- Create comment_status enum
CREATE TYPE comment_status AS ENUM ('open', 'resolved');

-- Add status tracking fields to comments table
ALTER TABLE comments
ADD COLUMN status comment_status DEFAULT 'open' NOT NULL,
ADD COLUMN resolved_by uuid REFERENCES profiles(id),
ADD COLUMN resolved_at timestamp with time zone;

-- Create index for faster filtering by status
CREATE INDEX idx_comments_status ON comments(status);
CREATE INDEX idx_comments_signage_spot_status ON comments(signage_spot_id, status);

-- Add comment to clarify the purpose
COMMENT ON TABLE comments IS 'Issue tracking and problem reporting for signage spots';