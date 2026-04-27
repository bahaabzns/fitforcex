'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface ClientSidebarContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

const ClientSidebarContext = createContext<ClientSidebarContextType | undefined>(undefined);

export function ClientSidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <ClientSidebarContext.Provider value={{ isOpen, setIsOpen, toggleSidebar }}>
      {children}
    </ClientSidebarContext.Provider>
  );
}

export function useClientSidebar() {
  const context = useContext(ClientSidebarContext);
  if (context === undefined) {
    throw new Error('useClientSidebar must be used within a ClientSidebarProvider');
  }
  return context;
}
