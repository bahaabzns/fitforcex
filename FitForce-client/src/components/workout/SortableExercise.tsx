'use client';

import { Card, CardContent, Box, Tooltip, Typography, Chip, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
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
        borderRadius: 2,
        boxShadow: 1,
        '&:hover': {
          boxShadow: 4,
          transform: 'translateY(-2px)',
          borderColor: 'primary.light'
        },
        '&:active': {
          cursor: 'grabbing'
        }
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, overflow: 'visible' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 1.5 }}>
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
                <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                    {exercise.exercise.muscleGroup}
                  </Typography>
                    {exercise.tempo && (
                      <Chip
                        label={`Tempo: ${exercise.tempo}`}
                        size="small"
                        variant="outlined"
                    sx={{ mb: 0.5 }}
                      />
                    )}
                    {exercise.rir > 0 && (
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
      
      {/* Minimized Sets Table - Outside CardContent for full width */}
      {(exercise as any).individualSets && Array.isArray((exercise as any).individualSets) && (exercise as any).individualSets.length > 0 ? (
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
      )}
    </Card>
  );
}


