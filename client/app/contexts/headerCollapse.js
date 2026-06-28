'use client';
import { createContext, useContext, useState } from 'react';

const HeaderCollapseContext = createContext(null);

export function HeaderCollapseProvider({ children }) {
    const [headerCollapsed, setHeaderCollapsed] = useState(false);
    return (
        <HeaderCollapseContext.Provider value={{ headerCollapsed, setHeaderCollapsed }}>
            {children}
        </HeaderCollapseContext.Provider>
    );
}

export function useHeaderCollapse() {
    return useContext(HeaderCollapseContext);
}
