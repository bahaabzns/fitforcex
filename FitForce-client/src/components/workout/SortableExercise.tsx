'use client';

import { Card, CardContent, Box, Tooltip, Typography, Chip, IconButton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
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
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: exercise.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } as React.CSSProperties;

  const repRange = formatRepRange(exercise.reps, exercise.sets);

  return (
    <Card
      ref={setNodeRef}
      style={style}
      sx={{
        cursor: 'grab',
        transition: 'all 0.2s',
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        '&:hover': {
          boxShadow: 6,
          transform: 'translateY(-2px)'
        },
        '&:active': {
          cursor: 'grabbing'
        }
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          {/* Drag Handle */}
          <Box
            {...attributes}
            {...listeners}
            sx={{
              cursor: 'grab',
              display: 'flex',
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="body2" color="textSecondary" sx={{ mr: 1 }}>
                    {exercise.exercise.muscleGroup}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, p: 0.5, px: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Chip
                      label={repRange}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 500 }}
                    />
                    {exercise.restSeconds > 0 && (
                      <Chip
                        label={`Rest: ${exercise.restSeconds}s`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                    {exercise.tempo && (
                      <Chip
                        label={`Tempo: ${exercise.tempo}`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                    {exercise.rir > 0 && (
                      <Chip
                        label={`RIR: ${exercise.rir}`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Box>
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
                onEdit(exercise);
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
                if (window.confirm(`Remove ${exercise.exercise.name} from this day?`)) {
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
    </Card>
  );
}


