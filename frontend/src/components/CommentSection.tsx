import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  Avatar,
  Collapse,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Send as SendIcon,
  Reply as ReplyIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from '@mui/icons-material';
import { commentsAPI, Comment } from '../services/api';

interface CommentSectionProps {
  entityType: 'experiment' | 'scenario' | 'project';
  entityId: number;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
  entityType,
  entityId,
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<number>>(new Set());

  const fetchComments = useCallback(async () => {
    try {
      const response = await commentsAPI.getThreaded(entityType, entityId);
      setComments(response.data);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      await commentsAPI.create({
        entity_type: entityType,
        entity_id: entityId,
        content: newComment,
      });
      setNewComment('');
      fetchComments();
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId: number) => {
    if (!replyContent.trim()) return;
    setSubmitting(true);
    try {
      await commentsAPI.create({
        entity_type: entityType,
        entity_id: entityId,
        parent_id: parentId,
        content: replyContent,
      });
      setReplyContent('');
      setReplyingTo(null);
      fetchComments();
    } catch (err) {
      console.error('Failed to post reply:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleThread = (commentId: number) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const renderComment = (comment: Comment, depth: number = 0) => {
    const hasReplies = comment.replies && comment.replies.length > 0;
    const isExpanded = expandedThreads.has(comment.id);

    return (
      <Box key={comment.id} sx={{ ml: depth * 3 }}>
        <ListItem
          alignItems="flex-start"
          sx={{
            borderLeft: depth > 0 ? '2px solid #e0e0e0' : 'none',
            pl: depth > 0 ? 2 : 0,
            py: 1,
          }}
        >
          <Avatar sx={{ width: 32, height: 32, mr: 1.5, mt: 0.5 }}>
            {comment.username?.[0]?.toUpperCase() || '?'}
          </Avatar>
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="subtitle2">
                {comment.username || 'Unknown'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDate(comment.created_at)}
              </Typography>
            </Box>
            <Typography
              variant="body2"
              sx={{
                mt: 0.5,
                fontStyle: comment.is_deleted ? 'italic' : 'normal',
                color: comment.is_deleted ? 'text.disabled' : 'text.primary',
              }}
            >
              {comment.content}
            </Typography>
            <Box display="flex" alignItems="center" gap={1} mt={0.5}>
              {comment.thread_level < 3 && !comment.is_deleted && (
                <Button
                  size="small"
                  startIcon={<ReplyIcon />}
                  onClick={() => setReplyingTo(comment.id)}
                  sx={{ textTransform: 'none', minWidth: 'auto', p: 0.5 }}
                >
                  Reply
                </Button>
              )}
              {hasReplies && (
                <Button
                  size="small"
                  onClick={() => toggleThread(comment.id)}
                  endIcon={isExpanded ? <CollapseIcon /> : <ExpandIcon />}
                  sx={{ textTransform: 'none', minWidth: 'auto', p: 0.5 }}
                >
                  {comment.replies!.length} {comment.replies!.length === 1 ? 'reply' : 'replies'}
                </Button>
              )}
            </Box>

            {/* Reply input */}
            {replyingTo === comment.id && (
              <Box display="flex" gap={1} mt={1}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Write a reply..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitReply(comment.id);
                    }
                  }}
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleSubmitReply(comment.id)}
                  disabled={submitting || !replyContent.trim()}
                >
                  <SendIcon fontSize="small" />
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setReplyingTo(null);
                    setReplyContent('');
                  }}
                >
                  Cancel
                </Button>
              </Box>
            )}
          </Box>
        </ListItem>

        {/* Nested replies */}
        {hasReplies && (
          <Collapse in={isExpanded}>
            {comment.replies!.map((reply) => renderComment(reply, depth + 1))}
          </Collapse>
        )}
      </Box>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Comments ({comments.length})
        </Typography>

        {/* New comment input */}
        <Box display="flex" gap={1} mb={2}>
          <TextField
            fullWidth
            multiline
            rows={2}
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <Button
            variant="contained"
            onClick={handleSubmitComment}
            disabled={submitting || !newComment.trim()}
            sx={{ alignSelf: 'flex-end' }}
          >
            <SendIcon />
          </Button>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Comments list */}
        <List disablePadding>
          {comments.map((comment) => renderComment(comment))}
          {comments.length === 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              No comments yet. Be the first to comment!
            </Typography>
          )}
        </List>
      </CardContent>
    </Card>
  );
};

export default CommentSection;
