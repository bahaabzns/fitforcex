'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    fbq: (action: string, eventName?: string, parameters?: Record<string, any>) => void;
  }
}

// Hardcoded Pixel ID
const HARDCODED_PIXEL_ID = '748502508209787';

export function useMetaPixel() {
  const initialized = useRef(false);
  const pixelId = useRef<string | null>(null);

  useEffect(() => {
    const initializePixel = async () => {
      // Prevent duplicate initialization
      if (initialized.current || typeof window === 'undefined') return;
      
      // Check if fbq already exists (from another initialization)
      if ((window as any).fbq) {
        console.log('Meta Pixel already initialized, skipping');
        initialized.current = true;
        return;
      }

      // Use hardcoded Pixel ID
      const pixelIdValue = HARDCODED_PIXEL_ID;
      
      if (!pixelIdValue || !/^\d{15,16}$/.test(pixelIdValue)) {
        console.error('Invalid Pixel ID format:', pixelIdValue);
        return;
      }

      pixelId.current = pixelIdValue;
      initialized.current = true;

      // Escape pixel ID to prevent injection issues
      const escapedPixelId = pixelIdValue.replace(/'/g, "\\'").replace(/"/g, '\\"');
      
      console.log('Initializing Meta Pixel with hardcoded ID:', pixelIdValue);

      // Load Meta Pixel script
      const script = document.createElement('script');
      script.id = 'meta-pixel-script';
      script.type = 'text/javascript';
      script.innerHTML = `
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${escapedPixelId}');
        fbq('track', 'PageView');
      `;
      document.head.appendChild(script);
      
      console.log('Meta Pixel script injected with Pixel ID:', pixelIdValue);

      // Add noscript fallback only if it doesn't exist
      if (!document.querySelector('noscript[data-meta-pixel]')) {
        const noscript = document.createElement('noscript');
        noscript.setAttribute('data-meta-pixel', 'true');
        const img = document.createElement('img');
        img.height = 1;
        img.width = 1;
        img.style.display = 'none';
        img.src = `https://www.facebook.com/tr?id=${pixelIdValue}&ev=PageView&noscript=1`;
        noscript.appendChild(img);
        document.head.appendChild(noscript);
      }

      console.log('Meta Pixel initialized with ID:', pixelIdValue);
      
      // Wait for fbq to be available and ensure PageView fires
      const checkFbq = setInterval(() => {
        if (window.fbq) {
          clearInterval(checkFbq);
          // Ensure PageView is tracked
          try {
            window.fbq('track', 'PageView');
          } catch (e) {
            console.error('Error tracking PageView:', e);
          }
        }
      }, 100);
      
      // Clear interval after 5 seconds
      setTimeout(() => clearInterval(checkFbq), 5000);
    };

    initializePixel();
  }, []);

  const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
    if (!initialized.current || !window.fbq) {
      console.warn('Meta Pixel not initialized');
      return;
    }

    try {
      window.fbq('track', eventName, parameters);
      console.log('Meta Pixel event tracked:', eventName, parameters);
    } catch (error) {
      console.error('Failed to track Meta Pixel event:', error);
    }
  };

  const trackPurchase = (value: number, currency: string = 'EGP', contents?: Array<{id: string, quantity: number}>) => {
    trackEvent('Purchase', {
      value,
      currency,
      content_type: 'product',
      ...(contents && { contents })
    });
  };

  const trackLead = (value?: number, currency: string = 'EGP') => {
    trackEvent('Lead', {
      ...(value && { value }),
      currency
    });
  };

  const trackViewContent = (contentIds: string[], value?: number, currency: string = 'EGP') => {
    trackEvent('ViewContent', {
      content_type: 'product',
      content_ids: contentIds,
      ...(value && { value }),
      currency
    });
  };

  const trackAddToCart = (contents: Array<{id: string, quantity: number}>, value: number, currency: string = 'EGP') => {
    trackEvent('AddToCart', {
      content_type: 'product',
      contents,
      value,
      currency
    });
  };

  const trackInitiateCheckout = (value: number, currency: string = 'EGP', numItems?: number) => {
    trackEvent('InitiateCheckout', {
      value,
      currency,
      ...(numItems && { num_items: numItems })
    });
  };

  const trackCompleteRegistration = (status?: boolean) => {
    trackEvent('CompleteRegistration', {
      ...(status !== undefined && { status })
    });
  };

  return {
    trackEvent,
    trackPurchase,
    trackLead,
    trackViewContent,
    trackAddToCart,
    trackInitiateCheckout,
    trackCompleteRegistration,
    isInitialized: initialized.current,
    pixelId: pixelId.current
  };
}
