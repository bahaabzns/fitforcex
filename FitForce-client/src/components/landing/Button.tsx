'use client';

import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  href?: string;
  onClick?: () => void;
  className?: string;
  fullWidth?: boolean;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  href,
  onClick,
  className = '',
  fullWidth = false
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-bold rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-400';

  const variantStyles = {
    primary:
      'relative overflow-hidden bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/50 hover:scale-105 active:scale-100 transition-all duration-300 focus:ring-offset-black',
    secondary:
      'bg-gray-900/80 backdrop-blur-md hover:bg-gray-900 text-white border border-cyan-500/30 hover:border-cyan-500/60 shadow-lg hover:shadow-cyan-500/30 hover:scale-105 active:scale-100 focus:ring-offset-black',
    outline:
      'bg-transparent hover:bg-white/5 text-white border-2 border-white/20 hover:border-cyan-500/60 hover:shadow-cyan-500/20 focus:ring-offset-black'
  };

  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  };

  const classes = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${fullWidth ? 'w-full' : ''} ${className}`;

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
    // Track event - check if gtag exists
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'click_cta', {
        button_text: typeof children === 'string' ? children : 'CTA'
      });
    }
  };

  if (href) {
    return (
      <a href={href} className={classes} onClick={handleClick} role="button">
        {children}
      </a>
    );
  }

  return (
    <button className={classes} onClick={handleClick}>
      {children}
    </button>
  );
}
