'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, Box, Tooltip, Typography, Chip, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Stack } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Edit, Trash, Category } from '@wandersonalwes/iconsax-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type SortableExerciseProps = {
  exercise: any;
  index: number;
  onEdit: (ex: any) => void;
  onDelete: (id: string) => void;
  formatRepRange: (reps: string, sets: number) => string;
  onPreviewGif: (src: string) => void;
};

export default function SortableExercise({
  exercise,
  index,
  onEdit,
  onDelete,
  formatRepRange,
  onPreviewGif
}: SortableExerciseProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const [isLongPressing, setIsLongPressing] = useState(false);
  const isLongPressingRef = useRef(false);
  const dragHandleRef = useRef<HTMLDivElement>(null);
  
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: exercise.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties;

  const repRange = formatRepRange(exercise.reps, exercise.sets);
  
  // Check if exercise is cardio
  const category = exercise.exercise?.category?.toLowerCase() || '';
  const muscleGroup = exercise.exercise?.muscleGroup?.toLowerCase() || '';
  const explicitCardio =
    (exercise as any).isCardio ?? exercise.exercise?.isCardio;
  
  // Prioritize category/muscleGroup for cardio detection
  const isCardio =
    category === 'cardio' ||
    muscleGroup.includes('cardio') ||
    muscleGroup.includes('cardiovascular') ||
    (explicitCardio !== undefined ? Boolean(explicitCardio) : false) ||
    !!(exercise as any).durationSeconds ||
    !!(exercise as any).durationMinutes ||
    !!exercise.exercise?.defaultDurationSeconds;

  const resolveCardioDurationSeconds = (): number => {
    if (!isCardio) return 0;
    const directSeconds = (exercise as any).durationSeconds;
    if (typeof directSeconds === 'number' && directSeconds > 0) return directSeconds;
    const durationMinutes = (exercise as any).durationMinutes;
    if (typeof durationMinutes === 'number' && durationMinutes > 0) {
      return Math.round(durationMinutes * 60);
    }
    const defaultSeconds = exercise.exercise?.defaultDurationSeconds;
    if (typeof defaultSeconds === 'number' && defaultSeconds > 0) return defaultSeconds;
    return 600; // fallback 10 minutes
  };

  const formatCardioDurationParts = (totalSeconds: number) => {
    const safeSeconds = Math.max(1, Math.round(totalSeconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
      return {
        main: `${hours}:${String(minutes).padStart(2, '0')}`,
        unit: 'hr',
        friendly: minutes ? `${hours}h ${minutes}m` : `${hours}h`,
      };
    }

    const displayMinutes = Math.floor(safeSeconds / 60);
    return {
      main: `${String(displayMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
      unit: 'min',
      friendly:
        displayMinutes > 0
          ? `${displayMinutes} min${displayMinutes === 1 ? '' : 's'}`
          : `${seconds} sec`,
    };
  };

  const cardioDurationSeconds = isCardio ? resolveCardioDurationSeconds() : 0;
  const cardioDurationParts = isCardio ? formatCardioDurationParts(cardioDurationSeconds) : null;

  // Track when dragging starts to show visual feedback
  useEffect(() => {
    if (isDragging) {
      setIsLongPressing(true);
    } else {
      // Reset after a short delay to allow smooth transition
      const timer = setTimeout(() => {
        setIsLongPressing(false);
        isLongPressingRef.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isDragging]);

  // On mobile, apply drag listeners directly to the card (TouchSensor will handle the delay)
  // On desktop, use drag handle
  const cardListeners = isMobile 
    ? { ...attributes, ...listeners }
    : {};
  const handleListeners = isMobile ? {} : { ...attributes, ...listeners };


  return (
    <Card
      ref={setNodeRef}
      style={style}
      sx={{
        cursor: isMobile && isLongPressing ? 'grabbing' : isMobile ? 'default' : 'grab',
        transition: 'all 0.2s',
        border: 1,
        borderColor: isLongPressing ? 'primary.main' : 'divider',
        bgcolor: isLongPressing ? 'action.selected' : 'background.paper',
        borderRadius: 2,
        boxShadow: isLongPressing ? 4 : 1,
        position: 'relative',
        '&:hover': {
          boxShadow: 4,
          transform: isDragging ? undefined : 'translateY(-2px)',
          borderColor: 'primary.light'
        },
        '&:active': {
          cursor: isMobile && isLongPressing ? 'grabbing' : isMobile ? 'default' : 'grabbing'
        },
        ...(isMobile && {
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none', // Prevent iOS callout menu
          touchAction: 'pan-y', // Allow vertical scrolling, TouchSensor will handle drag
          WebkitTapHighlightColor: 'transparent'
        })
      }}
      {...cardListeners}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        // On mobile, prevent click during drag, allow normal click otherwise
        if (isMobile && !isDragging && !isLongPressing) {
          onEdit(exercise);
        }
      }}
    >
      {isMobile && isLongPressing && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            fontSize: '0.75rem',
            fontWeight: 600,
            zIndex: 10,
            pointerEvents: 'none'
          }}
        >
          Drag to reorder
        </Box>
      )}
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, overflow: 'visible' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
          {/* Drag Handle - Hidden on mobile, visible on desktop */}
          <Box
            ref={dragHandleRef}
            {...handleListeners}
            sx={{
              cursor: 'grab',
              display: isMobile ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: '100%',
              '&:active': {
                cursor: 'grabbing'
              }
            }}
          >
            <Category size={20} style={{ opacity: 0.5 }} />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {exercise.exercise.gifImage && (
                isXs ? (
                  <Box
                    sx={{
                      width: 72,
                      height: 72,
                      minWidth: 72,
                      minHeight: 72,
                      borderRadius: 2,
                      overflow: 'hidden',
                      flex: '0 0 auto',
                      flexShrink: 0,
                      display: 'block',
                      cursor: 'pointer',
                      border: 1,
                      borderColor: 'divider',
                      '&:hover': { opacity: 0.9 }
                    }}
                    onClick={(e) => { e.stopPropagation(); onPreviewGif(exercise.exercise.gifImage as string); }}
                  >
                    <img
                      src={exercise.exercise.gifImage}
                      alt={exercise.exercise.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </Box>
                ) : (
                  <Tooltip title="Preview GIF" arrow>
                    <Box
                      sx={{
                        width: 72,
                        height: 72,
                        minWidth: 72,
                        minHeight: 72,
                        borderRadius: 2,
                        overflow: 'hidden',
                        flex: '0 0 auto',
                        flexShrink: 0,
                        display: { xs: 'block', sm: 'block' },
                        cursor: 'pointer',
                        border: 1,
                        borderColor: 'divider',
                        '&:hover': { opacity: 0.9 }
                      }}
                      onClick={(e) => { e.stopPropagation(); onPreviewGif(exercise.exercise.gifImage as string); }}
                    >
                      <img
                        src={exercise.exercise.gifImage}
                        alt={exercise.exercise.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </Box>
                  </Tooltip>
                )
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                  <Chip
                    label={`#${index + 1}`}
                    size="small"
                    color="primary"
                    sx={{ height: 20, fontSize: '0.75rem' }}
                  />
                  <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }} noWrap>
                    {exercise.exercise.name}
                  </Typography>
                </Box>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    {exercise.exercise.muscleGroup}
                  </Typography>
                    {!isCardio && exercise.tempo && (
                      <Chip
                        label={`Tempo: ${exercise.tempo}`}
                        size="small"
                        variant="outlined"
                    sx={{ mb: 0.5 }}
                      />
                    )}
                    {!isCardio && exercise.rir > 0 && (
                      <Chip
                        label={`RIR: ${exercise.rir}`}
                        size="small"
                        variant="outlined"
                    sx={{ mb: 0.5 }}
                      />
                    )}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 0.5, mt: 0.5 }}>
              <Chip
                label={exercise.exercise.category || ''}
                size="small"
                variant="outlined"
                sx={{ display: (exercise.exercise.category ? 'inline-flex' : 'none') }}
              />
              <Chip
                label={exercise.exercise.equipmentNeeded || ''}
                size="small"
                variant="outlined"
                sx={{ display: (exercise.exercise.equipmentNeeded ? 'inline-flex' : 'none') }}
              />
            </Box>
            {exercise.notes && (
              <Typography
                variant="body2"
                color="textSecondary"
                sx={{
                  mt: 1,
                  fontSize: '0.875rem',
                  fontStyle: 'italic',
                  pl: 1,
                  borderLeft: '3px solid',
                  borderColor: 'primary.main'
                }}
              >
                💡 {exercise.notes}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 0.5, alignItems: 'center' }}>
            <IconButton
              size="small"
              color="primary"
              onClick={(e) => {
                e.stopPropagation();
                if (!isLongPressing) {
                  onEdit(exercise);
                }
              }}
              sx={{
                bgcolor: 'primary.lighter',
                '&:hover': { bgcolor: 'primary.light' }
              }}
            >
              <Edit size={16} />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={(e) => {
                e.stopPropagation();
                if (!isLongPressing && window.confirm(`Remove ${exercise.exercise.name} from this day?`)) {
                  onDelete(exercise.id);
                }
              }}
              sx={{
                bgcolor: 'error.lighter',
                '&:hover': { bgcolor: 'error.light' }
              }}
            >
              <Trash size={16} />
            </IconButton>
          </Box>
        </Box>
      </CardContent>
      
      {/* Cardio: Show Duration/Time */}
      {isCardio ? (
        <Box sx={{ px: { xs: 1.5, sm: 2 }, pb: { xs: 1.5, sm: 2 }, width: '100%' }}>
          <Box
            sx={{
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
              background: alpha(theme.palette.primary.light, theme.palette.mode === 'dark' ? 0.1 : 0.2),
              p: { xs: 2, sm: 2.5 },
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  border: `2px solid ${theme.palette.primary.main}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: theme.palette.mode === 'dark' ? alpha('#000', 0.2) : 'white',
                  boxShadow: `0 6px 18px ${alpha(theme.palette.primary.main, 0.25)}`
                }}
              >
                <Typography variant="h5" sx={{ fontFamily: 'monospace', fontWeight: 700, color: theme.palette.primary.main }}>
                  {cardioDurationParts?.main ?? '00:00'}
                </Typography>
              </Box>
              <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
                <Typography variant="overline" sx={{ letterSpacing: 1.5, color: 'text.secondary' }}>
                  Cardio Duration
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: theme.palette.primary.dark }}>
                  {cardioDurationParts?.friendly ?? '10 mins'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                  Time-based effort — no sets required.
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Box>
      ) : (
        /* Regular Exercise: Minimized Sets Table - Outside CardContent for full width */
        (exercise as any).individualSets && Array.isArray((exercise as any).individualSets) && (exercise as any).individualSets.length > 0 ? (
        <Box sx={{ px: 2, pb: 2, width: '100%', overflow: 'hidden' }}>
          <TableContainer 
            component={Paper} 
            elevation={0} 
            sx={{ 
              bgcolor: 'transparent', 
              boxShadow: 'none',
              width: '100%',
              maxWidth: '100%',
              overflow: 'hidden'
            }}
          >
            <Table 
              size="small" 
              sx={{ 
                width: '100%',
                tableLayout: 'auto',
                border: 'none',
                '& .MuiTableCell-root': { 
                  border: 'none',
                  py: 0.35, 
                  px: 0.5, 
                  fontSize: '0.65rem',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  bgcolor: 'transparent'
                },
                '& .MuiTableHead-root .MuiTableCell-root': {
                  bgcolor: 'transparent',
                  pb: 0.5
                },
                '& .MuiTableRow-root': {
                  bgcolor: 'transparent'
                }
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.65rem', py: 0.4, width: '8%' }}>Set</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.65rem', py: 0.4 }}>Reps</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.65rem', py: 0.4 }}>Rest</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.65rem', py: 0.4 }}>Tempo</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.65rem', py: 0.4 }}>RIR</TableCell>
                  {(exercise as any).individualSets.some((set: any) => set.notes) && (
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.65rem', py: 0.4 }}>Notes</TableCell>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {(exercise as any).individualSets.map((set: any, setIndex: number) => (
                  <TableRow key={set.id || setIndex}>
                    <TableCell sx={{ fontSize: '0.65rem', py: 0.35, fontWeight: 500 }}>{setIndex + 1}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem', py: 0.35 }}>{set.reps || '-'}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem', py: 0.35 }}>{set.restSeconds ? `${set.restSeconds}s` : '-'}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem', py: 0.35 }}>{set.tempo || '-'}</TableCell>
                    <TableCell sx={{ fontSize: '0.65rem', py: 0.35 }}>{set.rir !== undefined && set.rir !== null ? set.rir : '-'}</TableCell>
                    {(exercise as any).individualSets.some((s: any) => s.notes) && (
                      <TableCell sx={{ fontSize: '0.65rem', color: 'text.secondary', py: 0.35 }}>
                        {set.notes || '-'}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ) : (
        <Box sx={{ px: 2, pb: 2, width: '100%', overflow: 'hidden' }}>
          <TableContainer 
            component={Paper} 
            elevation={0} 
            sx={{ 
              bgcolor: 'transparent', 
              boxShadow: 'none',
              width: '100%',
              maxWidth: '100%',
              overflow: 'hidden'
            }}
          >
            <Table 
              size="small" 
              sx={{ 
                width: '100%',
                tableLayout: 'auto',
                border: 'none',
                '& .MuiTableCell-root': { 
                  border: 'none',
                  py: 0.35, 
                  px: 0.5, 
                  fontSize: '0.65rem',
                  lineHeight: 1.2,
                  whiteSpace: 'nowrap',
                  bgcolor: 'transparent'
                },
                '& .MuiTableHead-root .MuiTableCell-root': {
                  bgcolor: 'transparent',
                  pb: 0.5
                },
                '& .MuiTableRow-root': {
                  bgcolor: 'transparent'
                }
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.65rem', py: 0.4 }}>Sets</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.65rem', py: 0.4 }}>Reps</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.65rem', py: 0.4 }}>Rest</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontSize: '0.65rem', py: 0.35 }}>{exercise.sets || '-'}</TableCell>
                  <TableCell sx={{ fontSize: '0.65rem', py: 0.35 }}>{repRange || '-'}</TableCell>
                  <TableCell sx={{ fontSize: '0.65rem', py: 0.35 }}>{exercise.restSeconds ? `${exercise.restSeconds}s` : '-'}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )
      )}
    </Card>
  );
}


