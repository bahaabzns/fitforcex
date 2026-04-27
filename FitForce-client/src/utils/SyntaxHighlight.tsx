'use client';

import { CSSProperties } from 'react';

// material-ui
import { useTheme } from '@mui/material/styles';

// third-party
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';

// project-imports
import { ThemeMode } from 'config';

// ==============================|| CODE HIGHLIGHTER ||============================== //

export default function SyntaxHighlight({ children, customStyle, ...others }: { children: string; customStyle?: CSSProperties }) {
  const theme = useTheme();

  return (
    <SyntaxHighlighter
      language="javascript"
      showLineNumbers
      style={theme.palette.mode === ThemeMode.DARK ? atomOneLight : atomOneDark}
      customStyle={customStyle}
      {...others}
    >
      {children}
    </SyntaxHighlighter>
  );
}
