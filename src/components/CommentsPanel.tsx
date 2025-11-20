import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Send, Trash2, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  body: string;
  author_id: string;
  mentions: string[];
  needs_attention: boolean;
  status: 'open' | 'resolved';
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string | null;
    email: string;
  };
  resolver_profile?: {
    full_name: string | null;
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
  const [selectedMentionUserIds, setSelectedMentionUserIds] = useState<string[]>([]);

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
      .order('status', { ascending: false })
      .order('created_at', { ascending: false });

    if (commentsError) {
      console.error('Error fetching comments:', commentsError);
      return;
    }

    if (!commentsData || commentsData.length === 0) {
      setComments([]);
      return;
    }

    // Get all user IDs (authors, resolvers, AND mentioned users)
    const authorIds = commentsData.map(c => c.author_id);
    const resolverIds = commentsData.map(c => c.resolved_by).filter(Boolean) as string[];
    const mentionedIds = commentsData.flatMap(c => c.mentions || []);
    const allUserIds = [...new Set([...authorIds, ...resolverIds, ...mentionedIds])];
    
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', allUserIds);

    // Merge profiles with comments
    const commentsWithProfiles = commentsData.map(comment => ({
      ...comment,
      profiles: profilesData?.find(p => p.id === comment.author_id) || null,
      resolver_profile: comment.resolved_by 
        ? profilesData?.find(p => p.id === comment.resolved_by) || null
        : null,
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
      const mentions = selectedMentionUserIds.length > 0
        ? selectedMentionUserIds
        : extractMentions(newComment);

      const { data: comment, error: insertError } = await supabase
        .from('comments')
        .insert({
          signage_spot_id: signageSpotId,
          body: newComment.trim(),
          author_id: currentUser,
          mentions,
          needs_attention: false,
          status: 'open',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Send Slack notification if there are mentions
      if (mentions.length > 0 && comment) {
        console.log('Sending Slack notification for mentions:', mentions);
        const { error: notificationError } = await supabase.functions.invoke('send-comment-notification', {
          body: {
            comment_id: comment.id,
            signage_spot_id: signageSpotId,
            body: newComment.trim(),
            author_id: currentUser,
            mentions,
          },
        });

        if (notificationError) {
          console.error('Failed to send Slack notification:', notificationError);
          toast.warning("Comment added but Slack notification failed");
        } else {
          toast.success("Comment added and Slack notification sent");
        }
      } else {
        toast.success("Comment added");
      }

      setNewComment("");
      setSelectedMentionUserIds([]);
      fetchComments();
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast.error("Failed to add comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async (commentId: string) => {
    try {
      // Get the comment data before updating
      const comment = comments.find(c => c.id === commentId);
      if (!comment) return;

      const { error } = await supabase
        .from('comments')
        .update({
          status: 'resolved',
          resolved_by: currentUser,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', commentId);

      if (error) throw error;

      // Send Slack notification about resolution
      try {
        await supabase.functions.invoke('send-comment-notification', {
          body: {
            comment_id: commentId,
            signage_spot_id: signageSpotId,
            body: comment.body,
            author_id: comment.author_id,
            mentions: comment.mentions || [],
            resolved: true,
            resolved_by: currentUser,
          }
        });
      } catch (slackError) {
        console.error('Failed to send resolution notification:', slackError);
        // Don't fail the resolution if Slack notification fails
      }

      toast.success("Issue resolved and team notified");
      fetchComments();
    } catch (error: any) {
      console.error('Error resolving issue:', error);
      toast.error("Failed to resolve issue");
    }
  };

  const handleReopen = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from('comments')
        .update({
          status: 'open',
          resolved_by: null,
          resolved_at: null,
        })
        .eq('id', commentId);

      if (error) throw error;

      toast.success("Issue reopened");
      fetchComments();
    } catch (error: any) {
      console.error('Error reopening issue:', error);
      toast.error("Failed to reopen issue");
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this issue report?')) return;
    
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      toast.success("Issue report deleted");
      fetchComments();
    } catch (error: any) {
      console.error('Error deleting issue:', error);
      toast.error("Failed to delete issue");
    }
  };

  const handleMentionClick = (user: User) => {
    setNewComment(prev => prev + `@${user.full_name || user.email} `);
    setSelectedMentionUserIds(prev =>
      prev.includes(user.id) ? prev : [...prev, user.id]
    );
    setShowMentionPicker(false);
  };

  const openIssuesCount = comments.filter(c => c.status === 'open').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Issues & Reports ({openIssuesCount} open, {comments.length} total)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New Comment Form */}
        <div className="space-y-2">
          <Textarea
            placeholder="Report an issue or problem with this signage spot... Use @name to mention someone"
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
                    onClick={() => handleMentionClick(user)}
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
              <AlertCircle className="h-4 w-4 mr-2" />
              {isSubmitting ? "Reporting..." : "Report Issue"}
            </Button>
          </div>
        </div>

        {/* Issues List */}
        <div className="space-y-3">
          {comments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No issues reported yet</p>
            </div>
          ) : (
            comments.map((comment) => (
              <Card 
                key={comment.id} 
                className={comment.status === 'resolved' ? 'opacity-60 border-green-500/20' : 'border-destructive/20'}
              >
                <div className="p-3">
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {comment.profiles?.full_name?.[0]?.toUpperCase() || 
                         comment.profiles?.email[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {comment.profiles?.full_name || comment.profiles?.email}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </span>
                          {comment.status === 'open' ? (
                            <span className="px-2 py-0.5 text-xs font-medium bg-destructive/10 text-destructive rounded">
                              Open
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-500/10 text-green-600 rounded">
                              Resolved
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {comment.status === 'open' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResolve(comment.id)}
                              className="h-7 text-xs"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Resolve
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReopen(comment.id)}
                              className="h-7 text-xs"
                            >
                              Reopen
                            </Button>
                          )}
                          {currentUser === comment.author_id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(comment.id)}
                              className="h-7 w-7 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
                      {comment.status === 'resolved' && comment.resolved_at && (
                        <p className="text-xs text-muted-foreground">
                          Resolved by {comment.resolver_profile?.full_name || 'Unknown'} {formatDistanceToNow(new Date(comment.resolved_at), { addSuffix: true })}
                        </p>
                      )}
                      {comment.mentions.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
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
                </div>
              </Card>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
