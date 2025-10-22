'use client';

import { useEffect, useRef } from 'react';

interface MetaPixelConfig {
  pixelId: string | null;
  enabled: boolean;
}

interface MetaPixelEvent {
  eventName: string;
  parameters?: Record<string, any>;
}

declare global {
  interface Window {
    fbq: (action: string, eventName?: string, parameters?: Record<string, any>) => void;
  }
}

export function useMetaPixel() {
  const initialized = useRef(false);
  const pixelId = useRef<string | null>(null);

  useEffect(() => {
    const initializePixel = async () => {
      if (initialized.current || typeof window === 'undefined') return;

      try {
        // Fetch pixel configuration from API
        const response = await fetch('/api/meta/pixel-config');
        const config: MetaPixelConfig = await response.json();

        if (!config.enabled || !config.pixelId) {
          console.log('Meta Pixel not configured or disabled');
          return;
        }

        pixelId.current = config.pixelId;
        initialized.current = true;

        // Load Meta Pixel script
        const script = document.createElement('script');
        script.innerHTML = `
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${config.pixelId}');
          fbq('track', 'PageView');
        `;
        document.head.appendChild(script);

        // Add noscript fallback
        const noscript = document.createElement('noscript');
        const img = document.createElement('img');
        img.height = 1;
        img.width = 1;
        img.style.display = 'none';
        img.src = `https://www.facebook.com/tr?id=${config.pixelId}&ev=PageView&noscript=1`;
        noscript.appendChild(img);
        document.head.appendChild(noscript);

        console.log('Meta Pixel initialized with ID:', config.pixelId);
      } catch (error) {
        console.error('Failed to initialize Meta Pixel:', error);
      }
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
