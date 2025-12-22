import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Paper, Box, Typography, Chip, FormControl, Select, MenuItem, IconButton, Tooltip } from '@mui/material';
import { DragIndicator, QuestionAnswer, Gavel, Article, Preview, Edit, Delete } from '@mui/icons-material';
import { CustomPageConfig } from '../VisualPdfBuilder';

interface SortableCustomPageProps {
  page: CustomPageConfig;
  index: number;
  totalInPosition: number;
  onPositionChange: (pageId: string, newPosition: CustomPageConfig['position']) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPreview: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function SortableCustomPage({
  page,
  index,
  totalInPosition,
  onPositionChange,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  onPreview,
  canMoveUp,
  canMoveDown,
}: SortableCustomPageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const positionLabels = {
    beforeContent: 'Before Content Pages',
    afterContent: 'After Content Pages',
    atEnd: 'At End (Before End Page)',
    afterEnd: 'After End Page',
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      elevation={isDragging ? 8 : 2}
      sx={{
        p: 2,
        mb: 1.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: isDragging ? 'primary.main' : 'divider',
        '&:hover': {
          boxShadow: 4
        }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          {...attributes}
          {...listeners}
          sx={{
            cursor: isDragging ? 'grabbing' : 'grab',
            display: 'flex',
            alignItems: 'center',
            color: 'text.secondary',
            '&:hover': {
              color: 'primary.main'
            }
          }}
        >
          <DragIndicator />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
            {page.type === 'qa' && <QuestionAnswer color="primary" fontSize="small" />}
            {page.type === 'disclaimer' && <Gavel color="primary" fontSize="small" />}
            {page.type === 'custom' && <Article color="primary" fontSize="small" />}
            {page.type === 'terms' && <Gavel color="primary" fontSize="small" />}
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {page.title || `${page.type.charAt(0).toUpperCase() + page.type.slice(1)} Page`}
            </Typography>
            <Chip 
              label={page.type.toUpperCase()} 
              size="small" 
              color="primary"
              variant="outlined"
            />
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <Select
                value={page.position}
                onChange={(e) => onPositionChange(page.id, e.target.value as CustomPageConfig['position'])}
              >
                <MenuItem value="beforeContent">Before Content Pages</MenuItem>
                <MenuItem value="afterContent">After Content Pages</MenuItem>
                <MenuItem value="atEnd">At End (Before End Page)</MenuItem>
                <MenuItem value="afterEnd">After End Page</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Order: {index + 1} of {totalInPosition} in this position
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Preview this page">
            <IconButton size="small" color="info" onClick={onPreview}>
              <Preview fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit page">
            <IconButton size="small" color="primary" onClick={onEdit}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete page">
            <IconButton size="small" color="error" onClick={onDelete}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Paper>
  );
}

