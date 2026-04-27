'use client';

import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Joyride, { CallBackProps, STATUS, Step, TooltipRenderProps } from 'react-joyride';

type TourId = string;

export interface TourDefinition {
  steps: Step[];
  workspaceId?: string | null;
  autoStart?: boolean;
  spotlightClicks?: boolean;
  disableOverlayClose?: boolean;
  tooltipComponent?: (props: TooltipRenderProps) => JSX.Element;
  scrollToFirstStep?: boolean;
  scrollToSteps?: boolean;
  scrollOffset?: number;
  disableScrolling?: boolean;
  spotlightPadding?: number;
  onStepChange?: (stepIndex: number, step: Step) => void;
}

interface RegisteredTour extends TourDefinition {
  tourId: TourId;
}

interface ActiveTourState {
  tourId: TourId;
  steps: Step[];
  run: boolean;
  stepIndex: number;
  spotlightClicks?: boolean;
  disableOverlayClose?: boolean;
  tooltipComponent?: (props: TooltipRenderProps) => JSX.Element;
  workspaceId?: string | null;
  scrollToFirstStep?: boolean;
  scrollToSteps?: boolean;
  scrollOffset?: number;
  disableScrolling?: boolean;
  spotlightPadding?: number;
  onStepChange?: (stepIndex: number, step: Step) => void;
}

interface TourContextValue {
  registerTour: (tourId: TourId, definition: TourDefinition) => void;
  startTour: (tourId: TourId) => void;
  stopTour: () => void;
  resetTour: (tourId: TourId) => void;
  markTourComplete: (tourId: TourId, workspaceId?: string | null) => void;
  isTourCompleted: (tourId: TourId, workspaceId?: string | null) => boolean;
  goToTourStep: (tourId: TourId, stepIndex: number) => void;
  nextTourStep: (tourId: TourId) => void;
  previousTourStep: (tourId: TourId) => void;
  activeTourId: TourId | null;
  activeTourStepIndex: number;
}

const TourContext = createContext<TourContextValue | undefined>(undefined);

const getStorageKey = (tourId: TourId, workspaceId?: string | null) => {
  const suffix = workspaceId ? `_${workspaceId}` : '';
  return `ff_tour_${tourId}${suffix}`;
};

const loadCompletionState = (tourId: TourId, workspaceId?: string | null) => {
  if (typeof window === 'undefined') return false;
  const key = getStorageKey(tourId, workspaceId);
  return window.localStorage.getItem(key) === 'completed';
};

const saveCompletionState = (tourId: TourId, workspaceId?: string | null, completed: boolean) => {
  if (typeof window === 'undefined') return;
  const key = getStorageKey(tourId, workspaceId);
  if (completed) {
    window.localStorage.setItem(key, 'completed');
  } else {
    window.localStorage.removeItem(key);
  }
};

const defaultJoyrideLocale = {
  back: 'Back',
  close: 'Close',
  last: 'Finish',
  next: 'Next',
  skip: 'Skip',
};

export function TourProvider({ children }: { children: ReactNode }) {
  const [tours, setTours] = useState<Record<TourId, RegisteredTour>>({});
  const [activeTour, setActiveTour] = useState<ActiveTourState | null>(null);

  const registerTour = useCallback((tourId: TourId, definition: TourDefinition) => {
    setTours((prev) => {
      const next: RegisteredTour = { ...definition, tourId };
      return { ...prev, [tourId]: next };
    });
  }, []);

  const startTour = useCallback((tourId: TourId) => {
    const tour = tours[tourId];
    if (!tour) return;

    if (loadCompletionState(tourId, tour.workspaceId)) {
      return;
    }

    setActiveTour({
      tourId,
      steps: tour.steps,
      run: true,
      stepIndex: 0,
      spotlightClicks: tour.spotlightClicks,
      disableOverlayClose: tour.disableOverlayClose,
      tooltipComponent: tour.tooltipComponent,
      workspaceId: tour.workspaceId,
      scrollToFirstStep: tour.scrollToFirstStep ?? true,
      scrollToSteps: tour.scrollToSteps ?? true,
      scrollOffset: tour.scrollOffset ?? 80,
      disableScrolling: tour.disableScrolling ?? false,
      spotlightPadding: tour.spotlightPadding ?? 8,
      onStepChange: tour.onStepChange,
    });
  }, [tours]);

  const stopTour = useCallback(() => {
    setActiveTour((prev) => (prev ? { ...prev, run: false } : prev));
  }, []);

  const resetTour = useCallback((tourId: TourId) => {
    const tour = tours[tourId];
    if (!tour) {
      saveCompletionState(tourId, undefined, false);
      return;
    }
    saveCompletionState(tourId, tour.workspaceId, false);
    setActiveTour((prev) => (prev?.tourId === tourId ? { ...prev, stepIndex: 0, run: true } : prev));
  }, [tours]);

  const markTourComplete = useCallback((tourId: TourId, workspaceId?: string | null) => {
    saveCompletionState(tourId, workspaceId, true);
    setActiveTour((prev) => (prev?.tourId === tourId ? { ...prev, run: false } : prev));
  }, []);

  const isTourCompleted = useCallback((tourId: TourId, workspaceId?: string | null) => {
    return loadCompletionState(tourId, workspaceId);
  }, []);

  const goToTourStep = useCallback((tourId: TourId, stepIndex: number) => {
    setActiveTour((prev) => {
      if (!prev || prev.tourId !== tourId) return prev;
      const tour = tours[tourId];
      const steps = tour?.steps ?? prev.steps;
      if (!steps || steps.length === 0) return prev;
      const clamped = Math.max(0, Math.min(stepIndex, steps.length - 1));
      if (clamped === prev.stepIndex) return prev;
      const step = steps[clamped];
      if (prev.onStepChange) {
        prev.onStepChange(clamped, step);
      }
      return {
        ...prev,
        steps,
        stepIndex: clamped,
        run: true,
      };
    });
  }, [tours]);

  const nextTourStep = useCallback((tourId: TourId) => {
    setActiveTour((prev) => {
      if (!prev || prev.tourId !== tourId) return prev;
      const tour = tours[tourId];
      const steps = tour?.steps ?? prev.steps;
      if (!steps || steps.length === 0) return prev;
      const nextIndex = Math.min(prev.stepIndex + 1, steps.length - 1);
      if (nextIndex === prev.stepIndex) return prev;
      const step = steps[nextIndex];
      if (prev.onStepChange) {
        prev.onStepChange(nextIndex, step);
      }
      return {
        ...prev,
        steps,
        stepIndex: nextIndex,
        run: true,
      };
    });
  }, [tours]);

  const previousTourStep = useCallback((tourId: TourId) => {
    setActiveTour((prev) => {
      if (!prev || prev.tourId !== tourId) return prev;
      const tour = tours[tourId];
      const steps = tour?.steps ?? prev.steps;
      if (!steps || steps.length === 0) return prev;
      const nextIndex = Math.max(prev.stepIndex - 1, 0);
      if (nextIndex === prev.stepIndex) return prev;
      const step = steps[nextIndex];
      if (prev.onStepChange) {
        prev.onStepChange(nextIndex, step);
      }
      return {
        ...prev,
        steps,
        stepIndex: nextIndex,
        run: true,
      };
    });
  }, [tours]);

  useEffect(() => {
    Object.values(tours).forEach((tour) => {
      if (tour.autoStart && !loadCompletionState(tour.tourId, tour.workspaceId)) {
        setActiveTour({
          tourId: tour.tourId,
          steps: tour.steps,
          run: true,
          stepIndex: 0,
          spotlightClicks: tour.spotlightClicks,
          disableOverlayClose: tour.disableOverlayClose,
          tooltipComponent: tour.tooltipComponent,
          workspaceId: tour.workspaceId,
          scrollToFirstStep: tour.scrollToFirstStep ?? true,
          scrollToSteps: tour.scrollToSteps ?? true,
          scrollOffset: tour.scrollOffset ?? 80,
          disableScrolling: tour.disableScrolling ?? false,
          spotlightPadding: tour.spotlightPadding ?? 8,
          onStepChange: tour.onStepChange,
        });
      }
    });
  }, [tours]);

  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    if (data.type === 'step:before' && typeof data.index === 'number' && activeTour?.onStepChange) {
      activeTour.onStepChange(data.index, data.step);
    }
    const { status, index, action } = data;
    setActiveTour((prev) => {
      if (!prev) return prev;
      if (status === STATUS.SKIPPED || status === STATUS.FINISHED) {
        saveCompletionState(prev.tourId, prev.workspaceId, true);
        return { ...prev, run: false };
      }
      if (action === 'reset') {
        return { ...prev, stepIndex: 0 };
      }
      return { ...prev, stepIndex: index };
    });
  }, [activeTour]);

  const value = useMemo(() => ({
    registerTour,
    startTour,
    stopTour,
    resetTour,
    markTourComplete,
    isTourCompleted,
    goToTourStep,
    nextTourStep,
    previousTourStep,
    activeTourId: activeTour?.tourId ?? null,
    activeTourStepIndex: activeTour?.stepIndex ?? 0,
  }), [
    registerTour,
    startTour,
    stopTour,
    resetTour,
    markTourComplete,
    isTourCompleted,
    goToTourStep,
    nextTourStep,
    previousTourStep,
    activeTour?.tourId,
    activeTour?.stepIndex,
    activeTour?.run,
  ]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {activeTour && (
        <Joyride
          run={activeTour.run}
          continuous
          showProgress
          showSkipButton
          steps={activeTour.steps}
          stepIndex={activeTour.stepIndex}
          tooltipComponent={activeTour.tooltipComponent}
          spotlightClicks={activeTour.spotlightClicks}
          disableOverlayClose={activeTour.disableOverlayClose}
          callback={handleJoyrideCallback}
          scrollToFirstStep={activeTour.scrollToFirstStep}
          scrollToSteps={activeTour.scrollToSteps}
          scrollOffset={activeTour.scrollOffset}
          disableScrolling={activeTour.disableScrolling}
          spotlightPadding={activeTour.spotlightPadding}
          styles={{
            options: {
              primaryColor: '#3B82F6',
              zIndex: 20000,
            },
          }}
          locale={defaultJoyrideLocale}
        />
      )}
    </TourContext.Provider>
  );
}

export const useTour = () => {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within a TourProvider');
  return ctx;
};

