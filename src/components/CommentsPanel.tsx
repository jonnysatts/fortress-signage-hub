import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Send, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  body: string;
  author_id: string;
  mentions: string[];
  needs_attention: boolean;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

interface User {
  id: string;
  full_name: string | null;
  email: string;
}

interface CommentsPanelProps {
  signageSpotId: string;
}

export function CommentsPanel({ signageSpotId }: CommentsPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);

  useEffect(() => {
    fetchComments();
    fetchUsers();
    getCurrentUser();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`comments:${signageSpotId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `signage_spot_id=eq.${signageSpotId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [signageSpotId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user?.id || null);
  };

  const fetchComments = async () => {
    // First get comments
    const { data: commentsData, error: commentsError } = await supabase
      .from('comments')
      .select('*')
      .eq('signage_spot_id', signageSpotId)
      .order('created_at', { ascending: false });

    if (commentsError) {
      console.error('Error fetching comments:', commentsError);
      return;
    }

    if (!commentsData || commentsData.length === 0) {
      setComments([]);
      return;
    }

    // Get author profiles separately
    const authorIds = commentsData.map(c => c.author_id);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', authorIds);

    // Merge profiles with comments
    const commentsWithProfiles = commentsData.map(comment => ({
      ...comment,
      profiles: profilesData?.find(p => p.id === comment.author_id) || null,
    }));

    setComments(commentsWithProfiles as any);
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .order('full_name');

    if (error) {
      console.error('Error fetching users:', error);
      return;
    }

    setUsers(data || []);
  };

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+(?:\s+\w+)*)/g;
    const matches = text.matchAll(mentionRegex);
    const mentionedUserIds: string[] = [];

    for (const match of matches) {
      const name = match[1];
      const user = users.find(u => 
        u.full_name?.toLowerCase().includes(name.toLowerCase())
      );
      if (user) {
        mentionedUserIds.push(user.id);
      }
    }

    return mentionedUserIds;
  };

  const handleSubmit = async () => {
    if (!newComment.trim() || !currentUser) return;

    setIsSubmitting(true);
    try {
      const mentions = extractMentions(newComment);

      const { data: comment, error: insertError } = await supabase
        .from('comments')
        .insert({
          signage_spot_id: signageSpotId,
          body: newComment.trim(),
          author_id: currentUser,
          mentions,
          needs_attention: false,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Send Slack notification if there are mentions
      if (mentions.length > 0 && comment) {
        await supabase.functions.invoke('send-comment-notification', {
          body: {
            comment_id: comment.id,
            signage_spot_id: signageSpotId,
            body: newComment.trim(),
            author_id: currentUser,
            mentions,
          },
        });
      }

      setNewComment("");
      toast.success("Comment added");
      fetchComments();
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast.error("Failed to add comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      toast.success("Comment deleted");
      fetchComments();
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      toast.error("Failed to delete comment");
    }
  };

  const handleMentionClick = (userName: string) => {
    setNewComment(prev => prev + `@${userName} `);
    setShowMentionPicker(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New Comment Form */}
        <div className="space-y-2">
          <Textarea
            placeholder="Add a comment... Use @name to mention someone"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onFocus={() => setShowMentionPicker(true)}
            rows={3}
          />
          
          {showMentionPicker && (
            <Card className="p-2">
              <p className="text-xs text-muted-foreground mb-2">Mention a user:</p>
              <div className="flex flex-wrap gap-1">
                {users.map(user => (
                  <Button
                    key={user.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleMentionClick(user.full_name || user.email)}
                    className="text-xs"
                  >
                    @{user.full_name || user.email}
                  </Button>
                ))}
              </div>
            </Card>
          )}

          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              Tip: Use @name to notify someone via Slack
            </p>
            <Button
              onClick={handleSubmit}
              disabled={!newComment.trim() || isSubmitting}
              size="sm"
            >
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>

        {/* Comments List */}
        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No comments yet. Be the first to comment!
            </p>
          ) : (
            comments.map((comment) => (
              <Card key={comment.id} className="p-3">
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {comment.profiles?.full_name?.[0]?.toUpperCase() || 
                       comment.profiles?.email[0]?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {comment.profiles?.full_name || comment.profiles?.email}
                        </span>
                        {comment.needs_attention && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                        </span>
                        {currentUser === comment.author_id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(comment.id)}
                            className="h-6 w-6 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
                    {comment.mentions.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-2">
                        {comment.mentions.map((mentionId) => {
                          const user = users.find(u => u.id === mentionId);
                          return user ? (
                            <span
                              key={mentionId}
                              className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded"
                            >
                              @{user.full_name || user.email}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
