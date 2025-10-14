'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import api from '@/utils/axios';
import { 
  Box, 
  Typography, 
  Stack, 
  CircularProgress, 
  Fab, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField
} from '@mui/material';
import GlobalStyles from '@mui/material/GlobalStyles';
import PrintIcon from '@mui/icons-material/Print';

export default function PublicWorkoutPlanPreviewPage() {
  const params = useParams();
  const id = params?.id as string;
  
  // Dialog state for old, rate, min, hit values
  const [showOptionsDialog, setShowOptionsDialog] = useState(false);
  
  // Initialize options with URL params to avoid controlled/uncontrolled input issue
  const getInitialOptions = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return {
        old: urlParams.get('old') ?? '',
        rate: urlParams.get('rate') ?? '',
        min: urlParams.get('min') ?? '',
        startCardio: urlParams.get('startCardio') ?? '',
        hit: urlParams.get('hit') ?? ''
      };
    }
    return {
      old: '',
      rate: '',
      min: '',
      startCardio: '',
      hit: ''
    };
  };
  
  const [options, setOptions] = useState(getInitialOptions);

  const { data, isLoading, error } = useSWR(() => (id ? `public-workout-plan-${id}` : null), async () => {
    // Try to get workspace ID from URL params or cookies
    const urlParams = new URLSearchParams(window.location.search);
    const workspaceId = urlParams.get('workspaceId') || 
      document.cookie.split('; ').find(row => row.startsWith('ff_workspace_id='))?.split('=')[1];

    try {
      // Use public workspace-scoped endpoint (no auth required)
      const res = await api.get(`/api/workout/plans/${id}/public?workspaceId=${workspaceId}`);
      const workoutPlan = (res.data as any)?.plan;
      return { plan: workoutPlan } as { plan: { 
        id: string; 
        title: string; 
        yearsOld?: number;
        heartRateMax?: number;
        heartRateTarget?: number;
        startCardio?: number;
        startHit?: number;
        days: Array<{ dayIndex: number; label?: string; items: Array<{ reps?: number; sets?: number; notes?: string; planSets?: any[]; exercise?: any }> }> 
      } };
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
  const defaultBgUrl = 'https://fitforce.s3.eu-north-1.amazonaws.com/workspaces/cmgnyvmff0002bsvhvv6hb607/template-assets/1760461859261-b2.jpeg';
const page11BgUrl = 'https://fitforce.s3.eu-north-1.amazonaws.com/workspaces/cmgnyvmff0002bsvhvv6hb607/template-assets/1760461815020-b1.jpeg';
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

      {/* Page 2 - With Clickable Links */}
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
        {/* Link 1 - Positionable */}
        <Box
          component="a"
          href="https://www.youtube.com/watch?v=G5c4RhFti5M"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            position: 'absolute',
            top: '31%',
            left: '5%',
            width: '500px',
            height: '100px',
            backgroundColor: 'rgba(255, 0, 0, 0)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',

          }}
        >

        </Box>

        {/* Link 2 - Positionable */}
        <Box
          component="a"
          href="https://www.youtube.com/watch?v=-twdgR_Eh9U"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            position: 'absolute',
            top: '31%',
            right: '5%',
            width: '500px',
            height: '100px',
            backgroundColor: 'rgba(0, 255, 0, 0)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',

          }}
        >

        </Box>

        {/* Link 3 - Positionable */}
        <Box
          component="a"
          href="https://www.youtube.com/watch?v=4OOB5Aqe75M"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            position: 'absolute',
            top: '45%',
            left: '2%',
            width: '500px',
            height: '100px',
            backgroundColor: 'rgba(0, 0, 255, 0)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',

          }}
        >

        </Box>

        {/* Link 4 - Positionable */}
        <Box
          component="a"
          href="https://www.youtube.com/watch?v=yvVzM9_nrH8"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            position: 'absolute',
            top: '45%',
            right: '2%',
            width: '500px',
            height: '100px',
            backgroundColor: 'rgba(255, 255, 0, 0.0)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',

          }}
        >

        </Box>

        {/* Link 5 - Positionable */}
        <Box
          component="a"
          href="https://www.youtube.com/watch?v=ofQ9aAl00CU"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            position: 'absolute',
            top: '57%',
            left: '2%',
            width: '500px',
            height: '100px',
            backgroundColor: 'rgba(255, 0, 255, 0.0)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
   
          }}
        >

        </Box>

        {/* Link 6 - Positionable */}
        <Box
          component="a"
          href="https://www.youtube.com/watch?v=BwX2AE12y9Q"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            position: 'absolute',
            top: '57%',
            right: '2%',
            width: '500px',
            height: '100px',
            backgroundColor: 'rgba(0, 255, 255, 0.0)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
    
          }}
        >
 
        </Box>

        {/* Link 7 - Positionable */}
        <Box
          component="a"
          href="https://www.youtube.com/shorts/_HUiSjZfY1E"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            position: 'absolute',
            top: '70%',
            left: '3%',
            width: '500px',
            height: '100px',
            backgroundColor: 'rgba(255, 165, 0, 0.0)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',

          }}
        >

        </Box>

        {/* Link 8 - Positionable */}
        <Box
          component="a"
          href="https://www.youtube.com/watch?v=qpEzRunSS3A"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            position: 'absolute',
            top: '70%',
            right: '3%',
            width: '500px',
            height: '100px',
            backgroundColor: 'rgba(128, 0, 128, 0.0)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
    
          }}
        >

        </Box>
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
          {(day as any).caDayImageUrl || (day as any).caDayUrl || ((day as any).caDayUrls && (day as any).caDayUrls.length > 0) ? (
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
              {/* Collect all URLs */}
              {(() => {
                const urls: string[] = [];
                if ((day as any).caDayUrl) urls.push((day as any).caDayUrl);
                if ((day as any).caDayUrls) urls.push(...(day as any).caDayUrls);

                if (urls.length === 0) return null;

                if (urls.length === 1) {
                  // Single URL - entire page is clickable
                  return (
                    <Box
                      component="a"
                      href={urls[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        cursor: 'pointer',
                        textDecoration: 'none',
                        '&:hover': {
                          backgroundColor: 'rgba(0,0,0,0.1)'
                        }
                      }}
                    >
                      <Box sx={{ position: 'absolute', top: 24, left: 24, right: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="h3" sx={{ fontWeight: 700, color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.6)', '@media print': { fontSize: '1.2rem' } }}>{(day as any).caDayName || ' '}</Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Box sx={{ color: 'white', cursor: 'pointer', fontSize: '1.6rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, borderRadius: 1, backgroundColor: 'rgba(0,0,0,0.35)', '@media print': { color: '#0000EE !important', fontSize: '1rem' }, '&:hover': { backgroundColor: 'rgba(0,0,0,0.5)' } }}>
                            📺<Typography variant="body2" sx={{ color: 'white', fontWeight: 600, '@media print': { color: '#0000EE !important' } }}>Click to Watch</Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  );
                } else {
                  // Multiple URLs - divide page into clickable sections
                  return (
                    <>
                      <Box sx={{ position: 'absolute', top: 24, left: 24, right: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
                        <Typography variant="h3" sx={{ fontWeight: 700, color: 'white', textShadow: '0 1px 3px rgba(0,0,0,0.6)', '@media print': { fontSize: '1.2rem' } }}>{(day as any).caDayName || ' '}</Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {urls.map((url: string, urlIndex: number) => (
                            <Box key={urlIndex} sx={{ color: 'white', fontSize: '1.6rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, borderRadius: 1, backgroundColor: 'rgba(0,0,0,0.35)', '@media print': { color: '#0000EE !important', fontSize: '1rem' } }}>
                              📺<Typography variant="body2" sx={{ color: 'white', fontWeight: 600, '@media print': { color: '#0000EE !important' } }}>Video {urlIndex + 1}</Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                      {urls.map((url: string, urlIndex: number) => (
                        <Box
                          key={urlIndex}
                          component="a"
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: `${(urlIndex / urls.length) * 100}%`,
                            width: `${100 / urls.length}%`,
                            height: '100%',
                            cursor: 'pointer',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            '&:hover': {
                              backgroundColor: 'rgba(0,0,0,0.1)'
                            },
                            '&:before': {
                              content: `"Click for Video ${urlIndex + 1}"`,
                              position: 'absolute',
                              bottom: '20px',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              color: 'white',
                              fontSize: '1.2rem',
                              fontWeight: 600,
                              textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                              backgroundColor: 'rgba(0,0,0,0.5)',
                              padding: '8px 16px',
                              borderRadius: '4px',
                              opacity: 0,
                              transition: 'opacity 0.3s ease'
                            },
                            '&:hover:before': {
                              opacity: 1
                            }
                          }} />
                      ))}
                    </>
                  );
                }
              })()}
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

            <Box
              component="a"
              href="https://www.youtube.com/watch?v=_otmJsf8AkM"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                position: 'absolute',
                top: '10%',
                right: '30%',
                width: '700px',
                height: '40px',
                backgroundColor: 'rgba(128, 1, 128, 0.0)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
              }}
            >

            </Box>
            <Box
              component="a"
              href="https://www.youtube.com/shorts/wiBoxml4riU"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                position: 'absolute',
                top: '16%',
                right: '30%',
                width: '700px',
                height: '40px',
                backgroundColor: 'rgba(128, 1, 128, 0.0)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
              }}
            >

            </Box>
          
            <Box
              component="a"
              href="https://www.youtube.com/watch?v=q9VvlLWcHZY"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                position: 'absolute',
                bottom: '16%',
                right: '30%',
                width: '700px',
                height: '40px',
                backgroundColor: 'rgba(128, 1, 128, 0.0)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
              }}
            >

            </Box>
            <Box
              component="a"
              href="https://www.youtube.com/watch?v=5NWWZMCJkic"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                position: 'absolute',
                bottom: '11%',
                right: '30%',
                width: '700px',
                height: '40px',
                backgroundColor: 'rgba(128, 1, 128, 0.0)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
              }}
            >

            </Box>
            <Box
              component="a"
              href="https://www.youtube.com/watch?v=qUh2eie2cfU"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                position: 'absolute',
                bottom: '6%',
                right: '30%',
                width: '700px',
                height: '40px',
                backgroundColor: 'rgba(128, 1, 128, 0.0)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
              }}
            >

            </Box>

            {/* Exercise Table */}
            <Box sx={{ width: '100%', flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '10%', '@media print': { flex: 1, paddingTop: '2%' } }}>
              <Box sx={{ width: '100%', height: '100%', border: '1px dashed white', borderTop: 'none', borderRadius: 1, overflow: 'hidden', '@media print': { border: '1px dashed white', borderTop: 'none' } }}>
                {/* Table Header */}
                <Box sx={{ display: 'flex', height: '50px', minHeight: '50px', bgcolor: 'rgba(0, 0, 0, 0.8)', '@media print': { height: '40px', minHeight: '40px', bgcolor: 'rgba(0, 0, 0, 0.9)' } }}>
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
                    height: '50px', // Fixed height instead of percentage
                    minHeight: '50px', // Ensure minimum height
                    bgcolor: ((rowIndex * 9301 + ((day as any).dayIndex || 0) * 49297) % 2 === 0)
                      ? 'rgba(255, 0, 0, 0.3)'
                      : 'rgba(128, 128, 128, 0.3)',
                    borderBottom: '3px dashed white',
                    '@media print': {
                      height: '40px', // Slightly smaller for print
                      minHeight: '40px',
                      bgcolor: ((rowIndex * 9301 + ((day as any).dayIndex || 0) * 49297) % 2 === 0)
                        ? 'rgba(255, 0, 0, 0.4)'
                        : 'rgba(128, 128, 128, 0.4)'
                    }
                  }}>
                    <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }}>{day.items?.[rowIndex]?.exercise?.muscleGroup || ''}</Typography>
                    </Box>
                    <Box sx={{ flex: 3, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }}>{day.items?.[rowIndex]?.exercise?.name || ''}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }}>{day.items?.[rowIndex]?.sets || ''}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }}>{day.items?.[rowIndex]?.reps || ''}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }}>{day.items?.[rowIndex]?.planSets?.[0]?.weight || ''}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }}>{day.items?.[rowIndex]?.rir !== undefined ? day.items?.[rowIndex]?.rir : ''}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
                      {day.items?.[rowIndex]?.exercise?.videoUrl ? (
                        <Box component="a" href={day.items?.[rowIndex]?.exercise?.videoUrl} target="_blank" rel="noopener noreferrer" sx={{ color: 'red', cursor: 'pointer', fontSize: '1.2rem', '@media print': { fontSize: '0.8rem', color: 'red !important' }, '&:hover': { opacity: 0.8 } }}>📺</Box>
                      ) : (
                        <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }} />
                      )}
                    </Box>
                    <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }} />
                    </Box>
                    <Box sx={{ flex: 1, borderRight: '3px dashed white', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }} />
                    </Box>
                    <Box sx={{ flex: 3, p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 500, '@media print': { fontSize: '0.6rem' } }}>{day.items?.[rowIndex]?.notes || ''}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>
      ))}

      {/* Page 11 - Test Answers */}
      <Box sx={{
        width: '100%',
        height: `${PAGE_H_IN}in`,
        backgroundImage: `url(${page11BgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        '@media print': {
          height: '100vh',
          pageBreakAfter: 'always',
          pageBreakInside: 'avoid'
        }
      }}>
        {/* Old Value - Positionable */}
        <Box sx={{
          position: 'absolute',
          top: '52%',
          right: '34%',
          backgroundColor: 'rgba(255, 255, 255, 0)',
          padding: 2,
          borderRadius: 1, 
        }}>
          <Typography variant="h3" sx={{ fontWeight: 'bold', color: 'white' }}>
            {(plan as any).yearsOld || 'Not set'}
          </Typography>
        </Box>
        
        {/* Rate Value - Positionable */}
        <Box sx={{
          position: 'absolute',
          top: '58%',
          right: '43%',
          backgroundColor: 'rgba(255, 255, 255, 0)',
          padding: 2,
          borderRadius: 1,
        }}>
          <Typography variant="h3" sx={{ fontWeight: 'bold', color: 'white' }}>
            {(plan as any).heartRateMax || 'Not set'}
          </Typography>
        </Box>
        
        {/* Min Value - Positionable */}
        <Box sx={{
          position: 'absolute',
          top: '64%',
          right: '34%',
          backgroundColor: 'rgba(255, 255, 255, 0.0)',
          padding: 2,
          borderRadius: 1,
        }}>
          <Typography variant="h3" sx={{ fontWeight: 'bold', color: 'white' }}>
            {(plan as any).heartRateTarget || 'Not set'}
          </Typography>
        </Box>
        
        {/* Start Cardio Value - Positionable */}
        <Box sx={{
          position: 'absolute',
          top: '69%',
          right: '16%',
          backgroundColor: 'rgba(255, 255, 255, 0.0)',
          padding: 2,
          borderRadius: 1,
        }}>
          <Typography variant="h3" sx={{ fontWeight: 'bold', color: 'white' }}>
            {(plan as any).startCardio || 'Not set'}
          </Typography>
        </Box>
      </Box>

      {/* Page 12 - Hit Value */}
      <Box sx={{
        width: '100%',
        height: `${PAGE_H_IN}in`,
        backgroundImage: `url(${page12BgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        '@media print': {
          height: '100vh',
          pageBreakAfter: 'always',
          pageBreakInside: 'avoid'
        }
      }}>
        {/* Hit Value - Positionable */}
        <Box sx={{
          position: 'absolute',
          top: '65%',
          right: '11.5%',
          backgroundColor: 'rgba(255, 255, 255, 0)',
          padding: 2,
          borderRadius: 1,
        }}>
          <Typography variant="h3" sx={{ fontWeight: 'bold', color: 'white' }}>
            {(plan as any).startHit || 'Not set'}
          </Typography>
        </Box>
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
      
      {/* Options Button */}
      <Button
        variant="outlined"
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 80,
          '@media print': {
            display: 'none'
          }
        }}
        onClick={() => setShowOptionsDialog(true)}
      >
        Options
      </Button>
      
      {/* Options Dialog */}
      <Dialog open={showOptionsDialog} onClose={() => setShowOptionsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Preview Options</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="Years Old"
              value={options.old}
              onChange={(e) => setOptions(prev => ({ ...prev, old: e.target.value }))}
            />
            <TextField
              fullWidth
              size="small"
              label="Heart Rate Max"
              value={options.rate}
              onChange={(e) => setOptions(prev => ({ ...prev, rate: e.target.value }))}
            />
            <TextField
              fullWidth
              size="small"
              label="Heart Rate Target"
              value={options.min}
              onChange={(e) => setOptions(prev => ({ ...prev, min: e.target.value }))}
            />
            <TextField
              fullWidth
              size="small"
              label="Start Cardio"
              value={options.startCardio}
              onChange={(e) => setOptions(prev => ({ ...prev, startCardio: e.target.value }))}
            />
            <TextField
              fullWidth
              size="small"
              label="Start Hit"
              value={options.hit}
              onChange={(e) => setOptions(prev => ({ ...prev, hit: e.target.value }))}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowOptionsDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              // Update URL with new parameters
              const urlParams = new URLSearchParams(window.location.search);
              if (options.old) urlParams.set('old', options.old);
              if (options.rate) urlParams.set('rate', options.rate);
              if (options.min) urlParams.set('min', options.min);
              if (options.startCardio) urlParams.set('startCardio', options.startCardio);
              if (options.hit) urlParams.set('hit', options.hit);
              
              const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
              window.history.pushState({}, '', newUrl);
              setShowOptionsDialog(false);
            }}
          >
            Apply Options
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
