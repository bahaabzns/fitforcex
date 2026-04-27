// Compatibility wrapper for react-dom to support react-joyride with React 19
// Re-exports everything from react-dom and adds missing functions

import React from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot, Root } from 'react-dom/client';

// Store roots for cleanup
const roots = new Map<Element, Root>();

// Re-export everything from react-dom
export * from 'react-dom';

// Add compatibility functions for react-joyride
export function unmountComponentAtNode(container: Element | DocumentFragment | null): boolean {
  if (!container) return false;
  
  const root = roots.get(container as Element);
  if (root) {
    root.unmount();
    roots.delete(container as Element);
    return true;
  }
  
  // Fallback: try to unmount if it's a root container
  try {
    const reactRoot = (container as any)._reactRootContainer;
    if (reactRoot) {
      reactRoot.unmount();
      return true;
    }
  } catch (e) {
    // Ignore errors
  }
  
  return false;
}

export function unstable_renderSubtreeIntoContainer(
  parentComponent: any,
  element: React.ReactElement,
  container: Element | DocumentFragment,
  callback?: () => void
): any {
  // Create a root if it doesn't exist
  let root = roots.get(container as Element);
  if (!root) {
    root = createRoot(container as Element);
    roots.set(container as Element, root);
  }
  
  root.render(element);
  
  if (callback) {
    callback();
  }
  
  return {
    render: (nextElement: React.ReactElement, nextCallback?: () => void) => {
      root!.render(nextElement);
      if (nextCallback) nextCallback();
    },
    unmount: (unmountCallback?: () => void) => {
      root!.unmount();
      roots.delete(container as Element);
      if (unmountCallback) unmountCallback();
    }
  };
}

