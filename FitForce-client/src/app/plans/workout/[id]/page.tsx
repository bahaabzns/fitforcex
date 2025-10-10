'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import api from '@/utils/axios';
import { Box, Typography, Stack, CircularProgress, Fab } from '@mui/material';
import GlobalStyles from '@mui/material/GlobalStyles';
import PrintIcon from '@mui/icons-material/Print';

export default function PublicWorkoutPlanPreviewPage() {
  const params = useParams();
  const id = params?.id as string;

  const { data, isLoading, error } = useSWR(() => (id ? `public-workout-plan-${id}` : null), async () => {
    // Get workspace ID from cookie (set by middleware)
    const workspaceId = document.cookie
      .split('; ')
      .find(row => row.startsWith('ff_workspace_id='))
      ?.split('=')[1];

    const headers = workspaceId ? { 'x-workspace-id': workspaceId } : {};

    try {
      // Use public workout plan endpoint (workspace-scoped, no client binding required)
      const res = await api.get(`/api/workout/plans/${id}`, { headers });
      const workoutPlan = (res.data as any)?.plan;
      return { plan: workoutPlan } as { plan: { id: string; title: string; days: Array<{ dayIndex: number; label?: string; items: Array<{ reps?: number; sets?: number; notes?: string; planSets?: any[]; exercise?: any }> }> } };
    } catch (e) {
      console.error('Failed to fetch workout plan:', e);
      throw e;
    }
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Stack alignItems="center" spacing={2}>
          <CircularProgress />
          <Typography color="text.secondary">Loading workout plan…</Typography>
        </Stack>
      </Box>
    );
  }

  if (error || !data?.plan) {
    return (
      <Box sx={{ m: { xs: 1, md: 3 }, p: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography color="error">Failed to load workout plan</Typography>
      </Box>
    );
  }

  const { plan } = data;

  // Fixed page size in inches (matching nutrition preview)
  const PAGE_W_IN = 18.5;
  const PAGE_H_IN = 10.5;
  const PAGE_RADIUS = 0;   // no rounding per request

  const coverBgUrl = 'https://fitforce.s3.eu-north-1.amazonaws.com/workspaces/cmgbk5yo40001bsed99nfm7um/template-assets/1760029402286-______________________________________________page-0001.jpg';
  const page2BgUrl = 'https://fitforce.s3.eu-north-1.amazonaws.com/workspaces/cmgbk5yo40001bsed99nfm7um/template-assets/1760029541655-______________________________________________page-0002.jpg';
  const page3BgUrl = 'https://fitforce.s3.eu-north-1.amazonaws.com/workspaces/cmgbk5yo40001bsed99nfm7um/template-assets/1760029578569-______________________________________________page-0003.jpg';
  const defaultBgUrl = 'https://fitforce.s3.eu-north-1.amazonaws.com/workspaces/cmgbk5yo40001bsed99nfm7um/template-assets/1760029635525-______________________________________________page-0005.jpg';
const page11BgUrl = 'https://fitforce.s3.eu-north-1.amazonaws.com/workspaces/cmgbk5yo40001bsed99nfm7um/template-assets/1760031811019-______________________________________________page-0011.jpg';
const page12BgUrl = 'https://fitforce.s3.eu-north-1.amazonaws.com/workspaces/cmgbk5yo40001bsed99nfm7um/template-assets/1760031850233-______________________________________________page-0012.jpg';
const page13BgUrl = 'https://fitforce.s3.eu-north-1.amazonaws.com/workspaces/cmgbk5yo40001bsed99nfm7um/template-assets/1760031870882-______________________________________________page-0013.jpg';

  const handlePrint = () => {
    window.print();
  };

  return (
    <Box sx={{ 
      width: `${PAGE_W_IN}in`, 
      minHeight: `${PAGE_H_IN}in`, 
      margin: '0 auto', 
      bgcolor: 'white',
      borderRadius: `${PAGE_RADIUS}px`,
      overflow: 'hidden',
      position: 'relative',
      '@media print': {
        margin: 0,
        width: '100%',
        minHeight: 'auto',
        borderRadius: 0,
        boxShadow: 'none',
        '@page': {
          size: '18.5in 10.5in',
          margin: '0'
        }
      }
    }}>
      <GlobalStyles styles={{
        '@media print': {
          '.layout-settings, .settings-button, [data-settings], [aria-label="settings"]': {
            display: 'none !important'
          },
          'a.print-link': {
            color: '#0000EE !important',
            textDecoration: 'underline !important'
          }
        }
      }} />
      {/* Cover Page */}
      <Box sx={{
        width: '100%',
        height: `${PAGE_H_IN}in`,
        backgroundImage: `url(${coverBgUrl})`, 
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        position: 'relative',
        '@media print': {
          height: '100vh',
          pageBreakAfter: 'always',
          pageBreakInside: 'avoid'
        }
      }}>
      </Box>

      {/* Page 2 - Background Only */}
      <Box sx={{
        width: '100%',
        height: `${PAGE_H_IN}in`,
        backgroundImage: `url(${page2BgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        position: 'relative',
        '@media print': {
          height: '100vh',
          pageBreakAfter: 'always',
          pageBreakInside: 'avoid'
        }
      }}>
      </Box>

      {/* Page 3 - Background Only */}
      <Box sx={{
        width: '100%',
        height: `${PAGE_H_IN}in`,
        backgroundImage: `url(${page3BgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        position: 'relative',
        '@media print': {
          height: '100vh',
          pageBreakAfter: 'always',
          pageBreakInside: 'avoid'
        }
      }}>
      </Box>

      {/* Day Overview Pages */}
      {(() => {
        const daysPerPage = 7;
        const totalDays = plan.days?.length || 0;
        const totalPages = Math.ceil(totalDays / daysPerPage);
        
        return Array.from({ length: totalPages }, (_, pageIndex) => {
          const startDay = pageIndex * daysPerPage;
          const endDay = Math.min(startDay + daysPerPage, totalDays);
          const pageDays = plan.days?.slice(startDay, endDay) || [];
          
          return (
            <Box key={`day-overview-${pageIndex}`} sx={{
              width: '100%',
              height: `${PAGE_H_IN}in`,
              backgroundImage: `url(${defaultBgUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              position: 'relative',
              '@media print': {
                height: '100vh',
                pageBreakAfter: 'always',
                pageBreakInside: 'avoid'
              }
            }}>
              {/* Title in top left */}
              <Box sx={{
                position: 'absolute',
                top: 40,
                left: 40,
                '@media print': {
                  top: 20,
                  left: 20
                }
              }}>
                <Typography variant="h3" sx={{ 
                  fontWeight: 700, 
                  color: 'white',
                  '@media print': {
                    fontSize: '1.5rem'
                  }
                }}>
                  Workout Overview
                </Typography>
              </Box>
              
              {/* Days row */}
              <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 2,
                width: '90%',
                '@media print': {
                  gap: 1,
                  width: '95%'
                }
              }}>
                {pageDays.map((day: any, dayIndex: number) => (
                  <Box key={day.id || dayIndex} sx={{
                    bgcolor: 'black',
                    borderRadius: 2,
                    p: 2,
                    textAlign: 'center',
                    minWidth: '100px',
                    flex: '1 1 auto',
                    '@media print': {
                      p: 1,
                      minWidth: '80px'
                    }
                  }}>
                    <Typography variant="h6" sx={{ 
                      fontWeight: 700,
                      color: 'white',
                      mb: 1,
                      '@media print': {
                        fontSize: '0.8rem',
                        mb: 0.5
                      }
                    }}>
                      Day{startDay + dayIndex + 1}
                    </Typography>
                    <Box sx={{
                      bgcolor: pageIndex === 0 ? 'red' : 'grey.600',
                      borderRadius: 1,
                      p: 1,
                      '@media print': {
                        p: 0.5
                      }
                    }}>
                      <Typography variant="body2" sx={{
                        color: 'white',
                        fontWeight: 500,
                        '@media print': {
                          fontSize: '0.6rem'
                        }
                      }}>
                        {day.label || `Day ${day.dayIndex}`}
                      </Typography>
                    </Box>
                  </Box>
                ))}
                
                {/* Fill empty slots if less than 7 days */}
                {Array.from({ length: daysPerPage - pageDays.length }, (_, emptyIndex) => (
                  <Box key={`empty-${emptyIndex}`} sx={{
                    bgcolor: 'grey.300',
                    borderRadius: 2,
                    p: 2,
                    minWidth: '100px',
                    flex: '1 1 auto',
                    '@media print': {
                      p: 1,
                      minWidth: '80px'
                    }
                  }}>
                  <Typography variant="h6" sx={{ 
                    fontWeight: 700,
                    color: 'grey.500',
                    mb: 1,
                    '@media print': {
                      fontSize: '0.8rem',
                      mb: 0.5
                    }
                  }}>
                    Day{startDay + pageDays.length + emptyIndex + 1}
                  </Typography>
                  <Box sx={{
                    bgcolor: 'grey.400',
                    borderRadius: 1,
                    p: 1,
                    '@media print': {
                      p: 0.5
                    }
                  }}>
                    <Typography variant="body2" sx={{
                      color: 'grey.600',
                      fontWeight: 500,
                      '@media print': {
                        fontSize: '0.6rem'
                      }
                    }}>
                      Empty
                    </Typography>
                  </Box>
                </Box>
                ))}
              </Box>
            </Box>
          );
        });
      })()}

      {/* Exercise Pages with optional ca_day cover before each day */}
      {plan.days?.map((day: any, dayIndex: number) => (
        <Box key={`wrap-${dayIndex}`}>
          {(day as any).caDayImageUrl || (day as any).caDayUrl ? (
            <Box sx={{
              width: '100%',
              height: `${PAGE_H_IN}in`,
              backgroundImage: `url(${(day as any).caDayImageUrl || defaultBgUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              position: 'relative',
              '@media print': { height: '100vh', pageBreakAfter: 'always', pageBreakInside: 'avoid' }
            }}>
              <Box sx={{ position: 'absolute', top: 24, left: 24, right: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h3" sx={{ fontWeight: 700, color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.6)', '@media print': { fontSize: '1.2rem' } }}>{(day as any).caDayName || ' '}</Typography>
                {(day as any).caDayUrl && (
                  <Box component="a" className="print-link" href={(day as any).caDayUrl} target="_blank" rel="noopener noreferrer" sx={{ color: 'white', cursor: 'pointer', fontSize: '1.6rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, borderRadius: 1, backgroundColor: 'rgba(0,0,0,0.35)', '@media print': { color: '#0000EE !important', fontSize: '1rem' }, '&:hover': { backgroundColor: 'rgba(0,0,0,0.5)' } }}>📺<Typography variant="body2" sx={{ color: 'white', fontWeight: 600, '@media print': { color: '#0000EE !important' } }}>Watch</Typography></Box>
                )}
              </Box>
            </Box>
          ) : null}

          <Box sx={{
            width: '100%',
            minHeight: `${PAGE_H_IN}in`,
            backgroundImage: `url(${defaultBgUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            position: 'relative',
            '@media print': { pageBreakAfter: 'always', pageBreakInside: 'avoid', minHeight: '100vh' }
          }}>
            {/* Title */}
            <Typography variant="h3" sx={{ 
              fontWeight: 700, 
              mt: 3,
              mb: 2, 
              color: 'white',
              textAlign: 'center',
              '@media print': { fontSize: '1.2rem', mt: 2, mb: 1, color: 'white' }
            }}>
              {day.label || `Day ${day.dayIndex}`}
            </Typography>

            {/* Exercise Table */}
            <Box sx={{ width: '100%', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '14%', '@media print': { flex: 1, paddingTop: '3%' } }}>
              <Box sx={{ width: '100%', height: '100%', border: '1px dashed white', borderTop: 'none', borderRadius: 1, overflow: 'hidden', '@media print': { border: '1px dashed white', borderTop: 'none' } }}>
                {/* Table Header */}
                <Box sx={{ display: 'flex', height: '10%', bgcolor: 'rgba(0, 0, 0, 0.8)', '@media print': { bgcolor: 'rgba(0, 0, 0, 0.9)' } }}>
                  <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, '@media print': { fontSize: '0.7rem' } }}>Muscle Group</Typography>
                  </Box>
                  <Box sx={{ flex: 3, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, '@media print': { fontSize: '0.7rem' } }}>Exercise Name</Typography>
                  </Box>
                  <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, '@media print': { fontSize: '0.7rem' } }}>Sets</Typography>
                  </Box>
                  <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, '@media print': { fontSize: '0.7rem' } }}>Reps</Typography>
                  </Box>
                  <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, '@media print': { fontSize: '0.7rem' } }}>Weight</Typography>
                  </Box>
                  <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, '@media print': { fontSize: '0.7rem' } }}>RIR</Typography>
                  </Box>
                  <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, '@media print': { fontSize: '0.7rem' } }}>Exercise Video</Typography>
                  </Box>
                  <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, '@media print': { fontSize: '0.7rem' } }}>Alt Exercise</Typography>
                  </Box>
                  <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, '@media print': { fontSize: '0.7rem' } }}>Alt Video</Typography>
                  </Box>
                  <Box sx={{ flex: 3, p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, '@media print': { fontSize: '0.7rem' } }}>Notes</Typography>
                  </Box>
                </Box>

                {/* Table Rows */}
                {Array.from({ length: 10 }, (_, rowIndex) => (
                  <Box key={rowIndex} sx={{ 
                    display: 'flex', 
                    height: '9%', 
                    bgcolor: ((rowIndex * 9301 + ((day as any).dayIndex || 0) * 49297) % 2 === 0)
                      ? 'rgba(255, 0, 0, 0.3)'
                      : 'rgba(128, 128, 128, 0.3)',
                    borderBottom: '3px dashed white', 
                    '@media print': { 
                      bgcolor: ((rowIndex * 9301 + ((day as any).dayIndex || 0) * 49297) % 2 === 0)
                        ? 'rgba(255, 0, 0, 0.4)'
                        : 'rgba(128, 128, 128, 0.4)'
                    } 
                  }}>
                    <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }}>{day.items?.[rowIndex]?.exercise?.muscleGroup || ''}</Typography>
                    </Box>
                    <Box sx={{ flex: 3, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }}>{day.items?.[rowIndex]?.exercise?.name || ''}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }}>{day.items?.[rowIndex]?.sets || ''}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }}>{day.items?.[rowIndex]?.reps || ''}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }}>{day.items?.[rowIndex]?.planSets?.[0]?.weight || ''}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }}>{day.items?.[rowIndex]?.rir || ''}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {day.items?.[rowIndex]?.exercise?.videoUrl ? (
                        <Box component="a" href={day.items?.[rowIndex]?.exercise?.videoUrl} target="_blank" rel="noopener noreferrer" sx={{ color: 'red', cursor: 'pointer', fontSize: '1.2rem', '@media print': { fontSize: '0.8rem', color: 'red !important' }, '&:hover': { opacity: 0.8 } }}>📺</Box>
                      ) : (
                        <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }} />
                      )}
                    </Box>
                    <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }} />
                    </Box>
                    <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }} />
                    </Box>
                    <Box sx={{ flex: 3, p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }}>{day.items?.[rowIndex]?.notes || ''}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      ))}

      {/* Page 11 - Background Only */}
      <Box sx={{
        width: '100%',
        height: `${PAGE_H_IN}in`,
        backgroundImage: `url(${page11BgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        position: 'relative',
        '@media print': {
          height: '100vh',
          pageBreakAfter: 'always',
          pageBreakInside: 'avoid'
        }
      }}>
      </Box>

      {/* Page 12 - Background Only */}
      <Box sx={{
        width: '100%',
        height: `${PAGE_H_IN}in`,
        backgroundImage: `url(${page12BgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        position: 'relative',
        '@media print': {
          height: '100vh',
          pageBreakAfter: 'always',
          pageBreakInside: 'avoid'
        }
      }}>
      </Box>

      {/* Page 13 - Background Only */}
      <Box sx={{
        width: '100%',
        height: `${PAGE_H_IN}in`,
        backgroundImage: `url(${page13BgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        position: 'relative',
        '@media print': {
          height: '100vh',
          pageBreakAfter: 'always',
          pageBreakInside: 'avoid'
        }
      }}>
      </Box>

      {/* Print Button */}
      <Fab
        color="primary"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          '@media print': {
            display: 'none'
          }
        }}
        onClick={handlePrint}
      >
        <PrintIcon />
      </Fab>
    </Box>
  );
}
