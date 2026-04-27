'use client';

import { ReactNode } from 'react';
import MobileSwipeableSections from '@/components/MobileSwipeableSections';

type WorkoutMakerMobileProps = {
  sections: ReactNode[];
  activeSection: number;
  onSectionChange?: (index: number) => void;
};

export default function WorkoutMakerMobile({ sections, activeSection, onSectionChange }: WorkoutMakerMobileProps) {
  return (
    <MobileSwipeableSections
      sections={sections}
      activeSection={activeSection}
      onSectionChange={onSectionChange}
    />
  );
}


