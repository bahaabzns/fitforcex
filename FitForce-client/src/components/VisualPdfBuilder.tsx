'use client';

import { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Button,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Divider,
  Grid,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import { CloudUpload, Delete } from '@mui/icons-material';
import { ColorPicker } from './ColorPicker';
import api from '@/utils/axios';

interface VisualPdfConfig {
  introPage?: {
    enabled: boolean;
    showPlanTitle?: boolean;
    showWorkspaceName?: boolean;
    showClientName?: boolean;
    backgroundImage?: string;
    backgroundColor?: string;
    titleColor?: string;
    titleSize?: number;
  };
  endPage?: {
    enabled: boolean;
    showThankYouMessage?: boolean;
    showContactInfo?: boolean;
    backgroundImage?: string;
    backgroundColor?: string;
    customMessage?: string;
  };
  dayPages: {
    layout: 'vertical' | 'horizontal';
    daysPerPage: number;
    backgroundImage?: string;
    backgroundColor?: string;
    options: {
      showGifImage: boolean;
      showExerciseName: boolean;
      showSets: boolean;
      showReps: boolean;
      showWeight: boolean;
      showRestTime: boolean;
      showNotes: boolean;
      showLinks: boolean;
      showMuscleGroup: boolean;
      showEquipment: boolean;
    };
  };
  options: {
    pageSize: 'A4' | 'Letter';
    orientation: 'portrait' | 'landscape';
    fontFamily?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
}

interface VisualPdfBuilderProps {
  kind: 'workout' | 'nutrition';
  initialConfig?: VisualPdfConfig;
  onSave: (config: VisualPdfConfig, name: string, isGlobal: boolean, workspaceIds: string[]) => void;
  onCancel: () => void;
  workspaces?: Array<{ id: string; name: string }>;
}

export default function VisualPdfBuilder({ 
  kind, 
  initialConfig, 
  onSave, 
  onCancel,
  workspaces = []
}: VisualPdfBuilderProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [templateName, setTemplateName] = useState('');
  const [isGlobal, setIsGlobal] = useState(true);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState<string[]>([]);
  const [introImageUrl, setIntroImageUrl] = useState('');
  const [endImageUrl, setEndImageUrl] = useState('');
  const [dayImageUrl, setDayImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState<'intro' | 'end' | 'day' | null>(null);
  
  const [config, setConfig] = useState<VisualPdfConfig>(
    initialConfig || {
      introPage: {
        enabled: true,
        showPlanTitle: true,
        showWorkspaceName: true,
        showClientName: true,
        backgroundColor: '#ffffff',
        titleColor: '#000000',
        titleSize: 32,
      },
      endPage: {
        enabled: true,
        showThankYouMessage: true,
        showContactInfo: true,
        backgroundColor: '#ffffff',
        customMessage: 'Thank you for choosing us!',
      },
      dayPages: {
        layout: 'vertical',
        daysPerPage: 1,
        backgroundColor: '#ffffff',
        options: {
          showGifImage: true,
          showExerciseName: true,
          showSets: true,
          showReps: true,
          showWeight: true,
          showRestTime: true,
          showNotes: true,
          showLinks: true,
          showMuscleGroup: true,
          showEquipment: true,
        },
      },
      options: {
        pageSize: 'A4',
        orientation: 'portrait',
        primaryColor: '#3366cc',
        secondaryColor: '#333333',
      },
    }
  );

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'intro' | 'end' | 'day'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image size must be less than 10MB');
      return;
    }

    try {
      setUploadingImage(type);
      
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await api.post('/api/admin/upload-template-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const imageUrl = response.data.imageUrl;
      
      // Set the appropriate image URL
      if (type === 'intro') {
        setIntroImageUrl(imageUrl);
      } else if (type === 'end') {
        setEndImageUrl(imageUrl);
      } else {
        setDayImageUrl(imageUrl);
      }
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(null);
    }
  };

  const handleSave = () => {
    if (!templateName.trim()) {
      alert('Please enter a template name');
      return;
    }
    if (!isGlobal && selectedWorkspaceIds.length === 0) {
      alert('Please select at least one workspace or make the template global');
      return;
    }
    
    // Update config with image URLs
    const finalConfig = {
      ...config,
      introPage: config.introPage ? {
        ...config.introPage,
        backgroundImage: introImageUrl || undefined,
      } : config.introPage,
      endPage: config.endPage ? {
        ...config.endPage,
        backgroundImage: endImageUrl || undefined,
      } : config.endPage,
      dayPages: {
        ...config.dayPages,
        backgroundImage: dayImageUrl || undefined,
      },
    };
    
    onSave(finalConfig, templateName, isGlobal, selectedWorkspaceIds);
  };

  const steps = [
    'General Settings',
    'Intro Page',
    'Content Pages',
    'End Page',
    'Review & Save',
  ];

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Visual PDF Template Builder
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Create a custom PDF template for {kind === 'workout' ? 'workout' : 'nutrition'} plans
      </Typography>

      <Stepper activeStep={activeStep} orientation="vertical">
        {/* Step 1: General Settings */}
        <Step>
          <StepLabel>General Settings</StepLabel>
          <StepContent>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <TextField
                  fullWidth
                  label="Template Name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  sx={{ mb: 3 }}
                  required
                />

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Page Size</InputLabel>
                      <Select
                        value={config.options.pageSize}
                        label="Page Size"
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            options: {
                              ...config.options,
                              pageSize: e.target.value as 'A4' | 'Letter',
                            },
                          })
                        }
                      >
                        <MenuItem value="A4">A4 (210 × 297mm)</MenuItem>
                        <MenuItem value="Letter">Letter (8.5 × 11in)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Orientation</InputLabel>
                      <Select
                        value={config.options.orientation}
                        label="Orientation"
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            options: {
                              ...config.options,
                              orientation: e.target.value as 'portrait' | 'landscape',
                            },
                          })
                        }
                      >
                        <MenuItem value="portrait">Portrait</MenuItem>
                        <MenuItem value="landscape">Landscape</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                        Primary Color
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <TextField
                          type="color"
                          value={config.options.primaryColor}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              options: {
                                ...config.options,
                                primaryColor: e.target.value,
                              },
                            })
                          }
                          sx={{ 
                            width: 80,
                            '& input': { height: 50, cursor: 'pointer' }
                          }}
                        />
                        <TextField
                          value={config.options.primaryColor}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              options: {
                                ...config.options,
                                primaryColor: e.target.value,
                              },
                            })
                          }
                          placeholder="#3366cc"
                          size="small"
                          sx={{ flex: 1 }}
                        />
                      </Box>
                    </Box>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                        Secondary Color
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <TextField
                          type="color"
                          value={config.options.secondaryColor}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              options: {
                                ...config.options,
                                secondaryColor: e.target.value,
                              },
                            })
                          }
                          sx={{ 
                            width: 80,
                            '& input': { height: 50, cursor: 'pointer' }
                          }}
                        />
                        <TextField
                          value={config.options.secondaryColor}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              options: {
                                ...config.options,
                                secondaryColor: e.target.value,
                              },
                            })
                          }
                          placeholder="#333333"
                          size="small"
                          sx={{ flex: 1 }}
                        />
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Box sx={{ mb: 2 }}>
              <Button variant="contained" onClick={handleNext} sx={{ mt: 1, mr: 1 }}>
                Continue
              </Button>
              <Button onClick={onCancel} sx={{ mt: 1, mr: 1 }}>
                Cancel
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 2: Intro Page */}
        <Step>
          <StepLabel>Intro Page</StepLabel>
          <StepContent>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={config.introPage?.enabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          introPage: {
                            ...config.introPage!,
                            enabled: e.target.checked,
                          },
                        })
                      }
                    />
                  }
                  label="Include Intro Page"
                />

                {config.introPage?.enabled && (
                  <Box sx={{ mt: 2, pl: 4 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Show on intro page:
                    </Typography>

                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.introPage.showPlanTitle}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              introPage: {
                                ...config.introPage!,
                                showPlanTitle: e.target.checked,
                              },
                            })
                          }
                        />
                      }
                      label="Plan Title"
                    />

                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.introPage.showWorkspaceName}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              introPage: {
                                ...config.introPage!,
                                showWorkspaceName: e.target.checked,
                              },
                            })
                          }
                        />
                      }
                      label="Workspace Name"
                    />

                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.introPage.showClientName}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              introPage: {
                                ...config.introPage!,
                                showClientName: e.target.checked,
                              },
                            })
                          }
                        />
                      }
                      label="Client Name"
                    />

                    <Divider sx={{ my: 2 }} />

                    <Grid container spacing={3}>
                      <Grid item xs={12}>
                        <Box>
                          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                            Background Image
                          </Typography>
                          
                          {!introImageUrl ? (
                            <Button
                              variant="outlined"
                              component="label"
                              startIcon={uploadingImage === 'intro' ? <CircularProgress size={20} /> : <CloudUpload />}
                              disabled={uploadingImage === 'intro'}
                              fullWidth
                            >
                              {uploadingImage === 'intro' ? 'Uploading...' : 'Upload Image'}
                              <input
                                type="file"
                                hidden
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'intro')}
                              />
                            </Button>
                          ) : (
                            <Box>
                              <Alert 
                                severity="success" 
                                action={
                                  <IconButton
                                    size="small"
                                    onClick={() => setIntroImageUrl('')}
                                  >
                                    <Delete />
                                  </IconButton>
                                }
                              >
                                Image uploaded successfully
                              </Alert>
                              {introImageUrl.includes('http') && (
                                <Box sx={{ mt: 1 }}>
                                  <img 
                                    src={introImageUrl} 
                                    alt="Background preview" 
                                    style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '4px' }}
                                  />
                                </Box>
                              )}
                            </Box>
                          )}
                          
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            Supports JPG, PNG, GIF. Max 10MB. Image will cover the entire page.
                          </Typography>
                        </Box>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Box>
                          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                            Background Color
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <TextField
                              type="color"
                              value={config.introPage.backgroundColor}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  introPage: {
                                    ...config.introPage!,
                                    backgroundColor: e.target.value,
                                  },
                                })
                              }
                              sx={{ 
                                width: 80,
                                '& input': { height: 50, cursor: 'pointer' }
                              }}
                            />
                            <TextField
                              value={config.introPage.backgroundColor}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  introPage: {
                                    ...config.introPage!,
                                    backgroundColor: e.target.value,
                                  },
                                })
                              }
                              size="small"
                              sx={{ flex: 1 }}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            Used when no background image is set
                          </Typography>
                        </Box>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Box>
                          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                            Title Color
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <TextField
                              type="color"
                              value={config.introPage.titleColor}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  introPage: {
                                    ...config.introPage!,
                                    titleColor: e.target.value,
                                  },
                                })
                              }
                              sx={{ 
                                width: 80,
                                '& input': { height: 50, cursor: 'pointer' }
                              }}
                            />
                            <TextField
                              value={config.introPage.titleColor}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  introPage: {
                                    ...config.introPage!,
                                    titleColor: e.target.value,
                                  },
                                })
                              }
                              size="small"
                              sx={{ flex: 1 }}
                            />
                          </Box>
                        </Box>
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <Box>
                          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                            Title Font Size
                          </Typography>
                          <TextField
                            fullWidth
                            type="number"
                            value={config.introPage.titleSize}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                introPage: {
                                  ...config.introPage!,
                                  titleSize: parseInt(e.target.value) || 32,
                                },
                              })
                            }
                            InputProps={{
                              endAdornment: <Typography variant="body2" sx={{ ml: 1 }}>pt</Typography>,
                              sx: { fontSize: '16px' }
                            }}
                            helperText="Size in points (default: 32)"
                          />
                        </Box>
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </CardContent>
            </Card>

            <Box sx={{ mb: 2 }}>
              <Button variant="contained" onClick={handleNext} sx={{ mt: 1, mr: 1 }}>
                Continue
              </Button>
              <Button onClick={handleBack} sx={{ mt: 1, mr: 1 }}>
                Back
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 3: Content Pages */}
        <Step>
          <StepLabel>Content Pages</StepLabel>
          <StepContent>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  Day/Content Page Layout
                </Typography>

                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Layout</InputLabel>
                      <Select
                        value={config.dayPages.layout}
                        label="Layout"
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            dayPages: {
                              ...config.dayPages,
                              layout: e.target.value as 'vertical' | 'horizontal',
                            },
                          })
                        }
                      >
                        <MenuItem value="vertical">Vertical</MenuItem>
                        <MenuItem value="horizontal">Horizontal</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Days Per Page</InputLabel>
                      <Select
                        value={config.dayPages.daysPerPage}
                        label="Days Per Page"
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            dayPages: {
                              ...config.dayPages,
                              daysPerPage: e.target.value as number,
                            },
                          })
                        }
                      >
                        <MenuItem value={1}>1 Day</MenuItem>
                        <MenuItem value={2}>2 Days</MenuItem>
                        <MenuItem value={3}>3 Days</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                        Background Image
                      </Typography>
                      
                      {!dayImageUrl ? (
                        <Button
                          variant="outlined"
                          component="label"
                          startIcon={uploadingImage === 'day' ? <CircularProgress size={20} /> : <CloudUpload />}
                          disabled={uploadingImage === 'day'}
                          fullWidth
                        >
                          {uploadingImage === 'day' ? 'Uploading...' : 'Upload Image'}
                          <input
                            type="file"
                            hidden
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'day')}
                          />
                        </Button>
                      ) : (
                        <Box>
                          <Alert 
                            severity="success" 
                            action={
                              <IconButton
                                size="small"
                                onClick={() => setDayImageUrl('')}
                              >
                                <Delete />
                              </IconButton>
                            }
                          >
                            Image uploaded - will be used for all content pages
                          </Alert>
                          {dayImageUrl.includes('http') && (
                            <Box sx={{ mt: 1 }}>
                              <img 
                                src={dayImageUrl} 
                                alt="Background preview" 
                                style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '4px' }}
                              />
                            </Box>
                          )}
                        </Box>
                      )}
                      
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        This image will be used as background for all day/content pages
                      </Typography>
                    </Box>
                  </Grid>

                  <Grid item xs={12}>
                    <Box>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                        Background Color
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <TextField
                          type="color"
                          value={config.dayPages.backgroundColor}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                backgroundColor: e.target.value,
                              },
                            })
                          }
                          sx={{ 
                            width: 80,
                            '& input': { height: 50, cursor: 'pointer' }
                          }}
                        />
                        <TextField
                          value={config.dayPages.backgroundColor}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              dayPages: {
                                ...config.dayPages,
                                backgroundColor: e.target.value,
                              },
                            })
                          }
                          size="small"
                          sx={{ flex: 1 }}
                        />
                      </Box>
                    </Box>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>
                  Show on content pages:
                </Typography>

                <Grid container spacing={1}>
                  {kind === 'workout' && (
                    <>
                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showGifImage}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  dayPages: {
                                    ...config.dayPages,
                                    options: {
                                      ...config.dayPages.options,
                                      showGifImage: e.target.checked,
                                    },
                                  },
                                })
                              }
                            />
                          }
                          label="GIF/Image"
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showExerciseName}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  dayPages: {
                                    ...config.dayPages,
                                    options: {
                                      ...config.dayPages.options,
                                      showExerciseName: e.target.checked,
                                    },
                                  },
                                })
                              }
                            />
                          }
                          label="Exercise Name"
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showSets}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  dayPages: {
                                    ...config.dayPages,
                                    options: {
                                      ...config.dayPages.options,
                                      showSets: e.target.checked,
                                    },
                                  },
                                })
                              }
                            />
                          }
                          label="Sets"
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showReps}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  dayPages: {
                                    ...config.dayPages,
                                    options: {
                                      ...config.dayPages.options,
                                      showReps: e.target.checked,
                                    },
                                  },
                                })
                              }
                            />
                          }
                          label="Reps"
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showWeight}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  dayPages: {
                                    ...config.dayPages,
                                    options: {
                                      ...config.dayPages.options,
                                      showWeight: e.target.checked,
                                    },
                                  },
                                })
                              }
                            />
                          }
                          label="Weight"
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showRestTime}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  dayPages: {
                                    ...config.dayPages,
                                    options: {
                                      ...config.dayPages.options,
                                      showRestTime: e.target.checked,
                                    },
                                  },
                                })
                              }
                            />
                          }
                          label="Rest Time"
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showNotes}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  dayPages: {
                                    ...config.dayPages,
                                    options: {
                                      ...config.dayPages.options,
                                      showNotes: e.target.checked,
                                    },
                                  },
                                })
                              }
                            />
                          }
                          label="Notes"
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showLinks}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  dayPages: {
                                    ...config.dayPages,
                                    options: {
                                      ...config.dayPages.options,
                                      showLinks: e.target.checked,
                                    },
                                  },
                                })
                              }
                            />
                          }
                          label="Video Links"
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showMuscleGroup}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  dayPages: {
                                    ...config.dayPages,
                                    options: {
                                      ...config.dayPages.options,
                                      showMuscleGroup: e.target.checked,
                                    },
                                  },
                                })
                              }
                            />
                          }
                          label="Muscle Group"
                        />
                      </Grid>

                      <Grid item xs={12} sm={6}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={config.dayPages.options.showEquipment}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  dayPages: {
                                    ...config.dayPages,
                                    options: {
                                      ...config.dayPages.options,
                                      showEquipment: e.target.checked,
                                    },
                                  },
                                })
                              }
                            />
                          }
                          label="Equipment"
                        />
                      </Grid>
                    </>
                  )}
                </Grid>
              </CardContent>
            </Card>

            <Box sx={{ mb: 2 }}>
              <Button variant="contained" onClick={handleNext} sx={{ mt: 1, mr: 1 }}>
                Continue
              </Button>
              <Button onClick={handleBack} sx={{ mt: 1, mr: 1 }}>
                Back
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 4: End Page */}
        <Step>
          <StepLabel>End Page</StepLabel>
          <StepContent>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={config.endPage?.enabled}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          endPage: {
                            ...config.endPage!,
                            enabled: e.target.checked,
                          },
                        })
                      }
                    />
                  }
                  label="Include End Page"
                />

                {config.endPage?.enabled && (
                  <Box sx={{ mt: 2, pl: 4 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.endPage.showThankYouMessage}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              endPage: {
                                ...config.endPage!,
                                showThankYouMessage: e.target.checked,
                              },
                            })
                          }
                        />
                      }
                      label="Show Thank You Message"
                    />

                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={config.endPage.showContactInfo}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              endPage: {
                                ...config.endPage!,
                                showContactInfo: e.target.checked,
                              },
                            })
                          }
                        />
                      }
                      label="Show Contact Info"
                    />

                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                        Custom Message
                      </Typography>
                      <TextField
                        fullWidth
                        value={config.endPage.customMessage}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            endPage: {
                              ...config.endPage!,
                              customMessage: e.target.value,
                            },
                          })
                        }
                        multiline
                        rows={3}
                        placeholder="Thank you for choosing us!"
                        InputProps={{
                          sx: { fontSize: '14px' }
                        }}
                      />
                    </Box>

                    <Box sx={{ mt: 3 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
                        Background Image
                      </Typography>
                      
                      {!endImageUrl ? (
                        <Button
                          variant="outlined"
                          component="label"
                          startIcon={uploadingImage === 'end' ? <CircularProgress size={20} /> : <CloudUpload />}
                          disabled={uploadingImage === 'end'}
                          fullWidth
                        >
                          {uploadingImage === 'end' ? 'Uploading...' : 'Upload Image'}
                          <input
                            type="file"
                            hidden
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e, 'end')}
                          />
                        </Button>
                      ) : (
                        <Box>
                          <Alert 
                            severity="success" 
                            action={
                              <IconButton
                                size="small"
                                onClick={() => setEndImageUrl('')}
                              >
                                <Delete />
                              </IconButton>
                            }
                          >
                            Image uploaded successfully
                          </Alert>
                          {endImageUrl.includes('http') && (
                            <Box sx={{ mt: 1 }}>
                              <img 
                                src={endImageUrl} 
                                alt="Background preview" 
                                style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '4px' }}
                              />
                            </Box>
                          )}
                        </Box>
                      )}
                      
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Background for the final thank you page
                      </Typography>
                    </Box>

                    <Box sx={{ mt: 3 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                        Background Color
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <TextField
                          type="color"
                          value={config.endPage.backgroundColor}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              endPage: {
                                ...config.endPage!,
                                backgroundColor: e.target.value,
                              },
                            })
                          }
                          sx={{ 
                            width: 80,
                            '& input': { height: 50, cursor: 'pointer' }
                          }}
                        />
                        <TextField
                          value={config.endPage.backgroundColor}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              endPage: {
                                ...config.endPage!,
                                backgroundColor: e.target.value,
                              },
                            })
                          }
                          size="small"
                          sx={{ flex: 1 }}
                        />
                      </Box>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>

            <Box sx={{ mb: 2 }}>
              <Button variant="contained" onClick={handleNext} sx={{ mt: 1, mr: 1 }}>
                Continue
              </Button>
              <Button onClick={handleBack} sx={{ mt: 1, mr: 1 }}>
                Back
              </Button>
            </Box>
          </StepContent>
        </Step>

        {/* Step 5: Review & Save */}
        <Step>
          <StepLabel>Review & Save</StepLabel>
          <StepContent>
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Workspace Assignment
                </Typography>
                
                <Box sx={{ mb: 3 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isGlobal}
                        onChange={(e) => {
                          setIsGlobal(e.target.checked);
                          if (e.target.checked) {
                            setSelectedWorkspaceIds([]);
                          }
                        }}
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          Make this template available globally
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          All workspaces will be able to use this template
                        </Typography>
                      </Box>
                    }
                  />

                  {!isGlobal && (
                    <Box sx={{ mt: 2, ml: 4 }}>
                      <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                        Select Workspaces
                      </Typography>
                      <FormControl fullWidth>
                        <Select
                          multiple
                          value={selectedWorkspaceIds}
                          onChange={(e) => setSelectedWorkspaceIds(e.target.value as string[])}
                          renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {selected.map((id) => {
                                const ws = workspaces.find(w => w.id === id);
                                return ws ? <Chip key={id} label={ws.name} size="small" /> : null;
                              })}
                            </Box>
                          )}
                        >
                          {workspaces.map((ws) => (
                            <MenuItem key={ws.id} value={ws.id}>
                              {ws.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {selectedWorkspaceIds.length === 0 && (
                        <Alert severity="warning" sx={{ mt: 1 }}>
                          Please select at least one workspace
                        </Alert>
                      )}
                    </Box>
                  )}
                </Box>

                <Divider sx={{ my: 3 }} />

                <Typography variant="h6" gutterBottom>
                  Template Configuration Summary
                </Typography>

                <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>Template Name:</strong> {templateName || '(Not set)'}
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>Type:</strong> {kind === 'workout' ? 'Workout Plan' : 'Nutrition Plan'}
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>Assignment:</strong>{' '}
                    {isGlobal ? (
                      <Chip label="Global (All Workspaces)" color="success" size="small" />
                    ) : (
                      <Chip label={`${selectedWorkspaceIds.length} workspace(s)`} size="small" />
                    )}
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>Page Size:</strong> {config.options.pageSize} ({config.options.orientation})
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>Intro Page:</strong>{' '}
                    <Chip
                      label={config.introPage?.enabled ? 'Enabled' : 'Disabled'}
                      color={config.introPage?.enabled ? 'success' : 'default'}
                      size="small"
                    />
                    {config.introPage?.enabled && introImageUrl && (
                      <Chip label="+ Background Image" color="info" size="small" sx={{ ml: 1 }} />
                    )}
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>End Page:</strong>{' '}
                    <Chip
                      label={config.endPage?.enabled ? 'Enabled' : 'Disabled'}
                      color={config.endPage?.enabled ? 'success' : 'default'}
                      size="small"
                    />
                    {config.endPage?.enabled && endImageUrl && (
                      <Chip label="+ Background Image" color="info" size="small" sx={{ ml: 1 }} />
                    )}
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    <strong>Content Pages:</strong> {config.dayPages.daysPerPage} day(s) per page ({config.dayPages.layout})
                    {dayImageUrl && (
                      <Chip label="+ Background Image" color="info" size="small" sx={{ ml: 1 }} />
                    )}
                  </Typography>
                </Paper>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  Review your configuration and click "Save Template" to create your visual PDF template.
                </Typography>
              </CardContent>
            </Card>

            <Box sx={{ mb: 2 }}>
              <Button variant="contained" onClick={handleSave} sx={{ mt: 1, mr: 1 }}>
                Save Template
              </Button>
              <Button onClick={handleBack} sx={{ mt: 1, mr: 1 }}>
                Back
              </Button>
              <Button onClick={onCancel} sx={{ mt: 1, mr: 1 }}>
                Cancel
              </Button>
            </Box>
          </StepContent>
        </Step>
      </Stepper>
    </Box>
  );
}

