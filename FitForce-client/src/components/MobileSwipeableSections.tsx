'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { Box, IconButton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ArrowLeft2, ArrowRight2 } from '@wandersonalwes/iconsax-react';

interface MobileSwipeableSectionsProps {
  sections: ReactNode[];
  activeSection: number;
  onSectionChange?: (index: number) => void;
  showNavigation?: boolean;
}

export default function MobileSwipeableSections({
  sections,
  activeSection,
  onSectionChange,
  showNavigation = true
}: MobileSwipeableSectionsProps) {
  const theme = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentSection, setCurrentSection] = useState(activeSection);
  const isScrollingProgrammatically = useRef(false);

  useEffect(() => {
    setCurrentSection(activeSection);
    // Scroll to the active section when it changes from parent
    if (containerRef.current && activeSection !== currentSection) {
      isScrollingProgrammatically.current = true;
      const sectionWidth = containerRef.current.offsetWidth;
      containerRef.current.scrollTo({
        left: sectionWidth * activeSection,
        behavior: 'smooth'
      });
      
      // Reset flag after scroll animation completes
      setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 500);
    }
  }, [activeSection]);

  // Listen to scroll events to update current section
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Don't update if we're scrolling programmatically
      if (isScrollingProgrammatically.current) return;
      
      const scrollLeft = container.scrollLeft;
      const sectionWidth = container.offsetWidth;
      const newSection = Math.round(scrollLeft / sectionWidth);
      
      if (newSection !== currentSection && newSection >= 0 && newSection < sections.length) {
        setCurrentSection(newSection);
        onSectionChange?.(newSection);
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [currentSection, sections.length, onSectionChange]);


  const goToSection = (index: number) => {
    if (index >= 0 && index < sections.length && index !== currentSection) {
      setCurrentSection(index);
      onSectionChange?.(index);
      
      // Smooth scroll to section
      if (containerRef.current) {
        const sectionWidth = containerRef.current.offsetWidth;
        containerRef.current.scrollTo({
          left: sectionWidth * index,
          behavior: 'smooth'
        });
      }
    }
  };

  const handlePrevious = () => {
    if (currentSection > 0) {
      goToSection(currentSection - 1);
    }
  };

  const handleNext = () => {
    if (currentSection < sections.length - 1) {
      goToSection(currentSection + 1);
    }
  };

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
        bgcolor: 'background.default'
      }}
    >
      {/* Sections Container */}
      <Box
        ref={containerRef}
        sx={{
          display: 'flex',
          width: '100%',
          height: '100%',
          overflowX: 'scroll',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          scrollBehavior: 'smooth',
          '&::-webkit-scrollbar': {
            display: 'none'
          },
          msOverflowStyle: 'none',
          scrollbarWidth: 'none'
        }}
      >
        {sections.map((section, index) => (
          <Box
            key={index}
            sx={{
              flex: '0 0 100%',
              width: '100%',
              height: '100%',
              scrollSnapAlign: 'start',
              overflowY: 'auto',
              px: 2,
              py: 2,
              '&::-webkit-scrollbar': {
                width: '4px'
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(0,0,0,0.2)',
                borderRadius: '4px'
              }
            }}
          >
            {section}
          </Box>
        ))}
      </Box>

      {/* Progress Indicators */}
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          left: 0,
          right: 0,
          display: 'flex',
          gap: 0.5,
          px: 2,
          zIndex: 10
        }}
      >
        {sections.map((_, index) => (
          <Box
            key={index}
            sx={{
              flex: 1,
              height: 3,
              bgcolor: index === currentSection ? 'primary.main' : 'rgba(255,255,255,0.3)',
              borderRadius: 1.5,
              transition: 'background-color 0.3s ease'
            }}
          />
        ))}
      </Box>

      {/* Navigation Buttons */}
      {showNavigation && (
        <>
          {currentSection > 0 && (
            <IconButton
              onClick={handlePrevious}
              sx={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                bgcolor: 'background.paper',
                boxShadow: 2,
                zIndex: 10,
                '&:hover': {
                  bgcolor: 'background.paper',
                  boxShadow: 4
                }
              }}
            >
              <ArrowLeft2 size={24} />
            </IconButton>
          )}

          {currentSection < sections.length - 1 && (
            <IconButton
              onClick={handleNext}
              sx={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                bgcolor: 'background.paper',
                boxShadow: 2,
                zIndex: 10,
                '&:hover': {
                  bgcolor: 'background.paper',
                  boxShadow: 4
                }
              }}
            >
              <ArrowRight2 size={24} />
            </IconButton>
          )}
        </>
      )}

      {/* Section Labels */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          bgcolor: 'rgba(0,0,0,0.6)',
          color: 'white',
          px: 2,
          py: 1,
          borderRadius: 2,
          zIndex: 10,
          backdropFilter: 'blur(10px)'
        }}
      >
        {currentSection + 1} / {sections.length}
      </Box>
    </Box>
  );
}
