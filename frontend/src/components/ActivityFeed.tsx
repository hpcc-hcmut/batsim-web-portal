import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Person as PersonIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  Add as CreateIcon,
  Edit as UpdateIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Pause as PauseIcon,
  PlayCircle as ResumeIcon,
} from '@mui/icons-material';
import { auditAPI, AuditLog } from '../services/api';

interface ActivityFeedProps {
  entityType?: string;
  entityId?: number;
  projectId?: number;
  limit?: number;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  create: <CreateIcon fontSize="small" />,
  update: <UpdateIcon fontSize="small" />,
  delete: <DeleteIcon fontSize="small" />,
  start: <StartIcon fontSize="small" />,
  stop: <StopIcon fontSize="small" />,
  pause: <PauseIcon fontSize="small" />,
  resume: <ResumeIcon fontSize="small" />,
};

const ACTION_COLORS: Record<string, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  create: 'success',
  update: 'info',
  delete: 'error',
  start: 'success',
  stop: 'warning',
  pause: 'warning',
  resume: 'info',
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  entityType,
  entityId,
  projectId,
  limit = 20,
}) => {
  const [activities, setActivities] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit };
      if (entityType) params.entity_type = entityType;
      if (entityId) params.entity_id = entityId;
      if (projectId) params.project_id = projectId;

      const response = await auditAPI.getLogs(params);
      setActivities(response.data.items);
      setError(null);
    } catch (err) {
      setError('Failed to load activity feed');
      console.error('Error fetching activities:', err);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, projectId, limit]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getActionText = (activity: AuditLog) => {
    const entityLabel = activity.entity_name || `${activity.entity_type} #${activity.entity_id}`;
    const actionVerb: Record<string, string> = {
      create: 'created',
      update: 'updated',
      delete: 'deleted',
      start: 'started',
      stop: 'stopped',
      pause: 'paused',
      resume: 'resumed',
    };

    return `${actionVerb[activity.action] || activity.action} ${activity.entity_type} "${entityLabel}"`;
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
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Activity Feed</Typography>
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={fetchActivities}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {error && (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        <List dense>
          {activities.map((activity) => (
            <ListItem key={activity.id} alignItems="flex-start">
              <ListItemAvatar>
                <Avatar sx={{ width: 32, height: 32 }}>
                  <PersonIcon fontSize="small" />
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="body2" fontWeight="medium">
                      {activity.username || 'Unknown'}
                    </Typography>
                    <Chip
                      size="small"
                      icon={ACTION_ICONS[activity.action] as React.ReactElement}
                      label={activity.action}
                      color={ACTION_COLORS[activity.action] || 'default'}
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {getActionText(activity)}
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      {formatTime(activity.created_at)}
                    </Typography>
                  </Box>
                }
              />
            </ListItem>
          ))}
          {activities.length === 0 && (
            <ListItem>
              <ListItemText
                secondary="No activity yet"
                sx={{ textAlign: 'center' }}
              />
            </ListItem>
          )}
        </List>
      </CardContent>
    </Card>
  );
};

export default ActivityFeed;
