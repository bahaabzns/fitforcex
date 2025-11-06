'use client';

import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { motion, useAnimation, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from '@/lib/config';
import useConfig from '@/hooks/useConfig';

export default function VideoShowcase() {
  const ref = useRef(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const controls = useAnimation();
  const { i18n } = useConfig();
  const [data, setData] = useState<{ title?: string; subtitle?: string; videoUrl?: string; posterUrl?: string } | null>(null);

  useEffect(() => {
    if (isInView) {
      controls.start({ opacity: 1, visibility: 'visible', maxHeight: '2000px', transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } });
    }
  }, [isInView, controls]);

  // Auto play/pause when section enters/leaves viewport
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isInView) {
      // Attempt autoplay - requires muted + playsInline
      el.play().catch(() => {
        // If autoplay fails, leave controls visible for manual play
      });
    } else {
      try { el.pause(); } catch {}
    }
  }, [isInView, data?.videoUrl]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch(`${APP_CONFIG.apiUrl}/api/meta/landing-config`, { cache: 'no-store' });
        if (!resp.ok) return;
        const json = await resp.json();
        const lang = (i18n as string) || 'en';
        const tr = json?.landing?.translations?.[lang];
        let section = tr?.sections?.video;
        if (!section?.videoUrl) {
          // Fallback to English if current language is missing video
          const en = json?.landing?.translations?.['en'];
          section = en?.sections?.video || section;
        }
        if (!mounted) return;
        setData(section || null);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [i18n]);

  if (!data?.videoUrl && !data?.posterUrl) return null;

  const toYouTubeEmbed = (url: string): string | null => {
    if (!url) return null;
    try {
      const u = new URL(url);
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const build = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0${origin ? `&origin=${encodeURIComponent(origin)}` : ''}`;
      if (u.hostname.includes('youtube.com')) {
        const v = u.searchParams.get('v');
        if (v) return build(v);
      }
      if (u.hostname.includes('youtu.be')) {
        const id = u.pathname.replace('/', '');
        if (id) return build(id);
      }
      return null;
    } catch {
      return null;
    }
  };

  const ytEmbed = data?.videoUrl ? toYouTubeEmbed(data.videoUrl) : null;

  return (
    <Box sx={{ pt: 0, pb: { xs: 8, md: 12 }, bgcolor: 'background.default', position: 'relative' }}>
      <Container sx={{ py: 0 }}>
        <motion.div 
          ref={ref} 
          initial={{ opacity: 0, visibility: 'hidden', maxHeight: 0 }} 
          animate={controls}
          style={{ willChange: 'opacity, visibility, max-height', overflow: 'hidden' }}
        >
          {data.title && (
            <Typography variant="h2" sx={{ fontWeight: 800, mb: 1, textAlign: 'center' }}>{data.title}</Typography>
          )}
          {data.subtitle && (
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 800, mx: 'auto', mb: 4, textAlign: 'center' }}>{data.subtitle}</Typography>
          )}
          <Box
            sx={{
              borderRadius: 3,
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
              position: 'relative',
              transform: 'translateZ(0)'
            }}
          >
            {ytEmbed ? (
              <>
                <motion.iframe
                  initial={{ filter: 'blur(6px) brightness(0.9)' }}
                  animate={{ filter: 'blur(0px) brightness(1)' }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                  src={ytEmbed}
                  title={data.title || 'Video'}
                  style={{ width: '100%', height: 480, display: 'block', border: 0 }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
                {/* Fallback link in case embedding is disabled by the video owner */}
                <Box sx={{ textAlign: 'center', mt: 1 }}>
                  <a href={data.videoUrl!} target="_blank" rel="noopener noreferrer" style={{ fontSize: 14 }}>
                    Open on YouTube
                  </a>
                </Box>
              </>
            ) : data.videoUrl ? (
              <motion.video
                initial={{ filter: 'blur(6px) brightness(0.9)' }}
                animate={{ filter: 'blur(0px) brightness(1)' }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                ref={videoRef}
                src={data.videoUrl}
                poster={data.posterUrl || undefined}
                style={{ width: '100%', height: 'auto', display: 'block' }}
                controls
                playsInline
                muted
                preload="metadata"
              />
            ) : (
              <motion.img
                initial={{ filter: 'blur(6px) brightness(0.95)' }}
                animate={{ filter: 'blur(0px) brightness(1)' }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                src={data.posterUrl as string}
                alt={data.title || 'Video poster'}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            )}
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
}


