'use client';
import { createContext, useContext } from 'react';

// Lets child pages push JSX into the client-layout header bar (next to the collapse button).
export const PageHeaderActionsContext = createContext(null);

export function usePageHeaderActions() {
    return useContext(PageHeaderActionsContext);
}
