import { useRef, useCallback, useState } from 'react';

interface UseLongPressOptions {
  onLongPress: (event: TouchEvent | MouseEvent) => void;
  onClick?: (event: TouchEvent | MouseEvent) => void;
  delay?: number;
  threshold?: number; // Maximum movement allowed during long press (in pixels)
}

export function useLongPress({
  onLongPress,
  onClick,
  delay = 500,
  threshold = 10
}: UseLongPressOptions) {
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const timeout = useRef<NodeJS.Timeout>();
  const target = useRef<EventTarget | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const start = useCallback((event: TouchEvent | MouseEvent) => {
    // Prevent context menu on touch devices
    if ('touches' in event && event.cancelable) {
      event.preventDefault();
    }

    // Get initial position
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    startPos.current = { x: clientX, y: clientY };
    target.current = event.target;

    // Set timeout for long press
    timeout.current = setTimeout(() => {
      setLongPressTriggered(true);
      onLongPress(event);
      // Add haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }, delay);
  }, [onLongPress, delay]);

  const clear = useCallback((event: TouchEvent | MouseEvent, shouldTriggerClick = true) => {
    timeout.current && clearTimeout(timeout.current);
    
    // Check if we moved too much (cancel long press)
    if (startPos.current) {
      const clientX = 'changedTouches' in event ? event.changedTouches[0].clientX : event.clientX;
      const clientY = 'changedTouches' in event ? event.changedTouches[0].clientY : event.clientY;
      const deltaX = Math.abs(clientX - startPos.current.x);
      const deltaY = Math.abs(clientY - startPos.current.y);
      
      if (deltaX > threshold || deltaY > threshold) {
        setLongPressTriggered(false);
        startPos.current = null;
        return;
      }
    }

    // If long press was triggered, don't trigger click
    if (longPressTriggered) {
      setLongPressTriggered(false);
      startPos.current = null;
      return;
    }

    // Trigger click if not long press
    if (shouldTriggerClick && onClick && !longPressTriggered) {
      onClick(event);
    }
    
    setLongPressTriggered(false);
    startPos.current = null;
  }, [onClick, longPressTriggered, threshold]);

  const move = useCallback((event: TouchEvent | MouseEvent) => {
    if (!startPos.current) return;
    
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    const deltaX = Math.abs(clientX - startPos.current.x);
    const deltaY = Math.abs(clientY - startPos.current.y);
    
    // If moved too much, cancel long press
    if (deltaX > threshold || deltaY > threshold) {
      timeout.current && clearTimeout(timeout.current);
      setLongPressTriggered(false);
    }
  }, [threshold]);

  return {
    onTouchStart: (e: React.TouchEvent) => {
      // Only prevent default if we're going to handle long press
      // This prevents context menu without breaking scrolling
      if (e.cancelable) {
        e.preventDefault();
      }
      start(e.nativeEvent);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (e.cancelable) {
        e.preventDefault();
      }
      clear(e.nativeEvent);
    },
    onTouchMove: (e: React.TouchEvent) => {
      // Only prevent default if we're in long press mode
      if (longPressTriggered && e.cancelable) {
        e.preventDefault();
      }
      move(e.nativeEvent);
    },
    onTouchCancel: (e: React.TouchEvent) => {
      if (e.cancelable) {
        e.preventDefault();
      }
      clear(e.nativeEvent, false);
    },
    onMouseDown: (e: React.MouseEvent) => start(e.nativeEvent),
    onMouseUp: (e: React.MouseEvent) => clear(e.nativeEvent, true),
    onMouseLeave: (e: React.MouseEvent) => clear(e.nativeEvent, false),
    onMouseMove: (e: React.MouseEvent) => move(e.nativeEvent),
    onContextMenu: (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault(); // Always prevent context menu
      e.stopPropagation();
      return false;
    },
  };
}

