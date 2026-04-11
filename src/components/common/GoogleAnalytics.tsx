// ABOUTME: Google Analytics integration component for tracking site-wide analytics
// ABOUTME: Provides Google Analytics 4 (GA4) and Google Tag Manager integration

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface GoogleAnalyticsProps {
  googleAnalyticsId?: string;
  googleTagManagerId?: string;
  enabled?: boolean;
}

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

export function GoogleAnalytics({ 
  googleAnalyticsId, 
  googleTagManagerId, 
  enabled = true 
}: GoogleAnalyticsProps) {
  const location = useLocation();

  useEffect(() => {
    if (!enabled) return;

    // Load Google Analytics
    if (googleAnalyticsId) {
      // Create script for GA4
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`;
      document.head.appendChild(script);

      // Initialize dataLayer and gtag
      window.dataLayer = window.dataLayer || [];
      window.gtag = function(...args: unknown[]) {
        window.dataLayer.push(args);
      };
      
      window.gtag('js', new Date());
      window.gtag('config', googleAnalyticsId, {
        page_title: document.title,
        page_location: window.location.href,
      });
    }

    // Load Google Tag Manager
    if (googleTagManagerId) {
      // GTM script
      const gtmScript = document.createElement('script');
      gtmScript.innerHTML = `
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${googleTagManagerId}');
      `;
      document.head.appendChild(gtmScript);

      // GTM noscript fallback
      const noscript = document.createElement('noscript');
      noscript.innerHTML = `
        <iframe src="https://www.googletagmanager.com/ns.html?id=${googleTagManagerId}"
        height="0" width="0" style="display:none;visibility:hidden"></iframe>
      `;
      document.body.appendChild(noscript);
    }

    return () => {
      // Cleanup scripts on unmount
      const scripts = document.querySelectorAll(`script[src*="googletagmanager.com"]`);
      scripts.forEach(script => script.remove());
    };
  }, [googleAnalyticsId, googleTagManagerId, enabled]);

  // Track page views on route changes
  useEffect(() => {
    if (!enabled || !googleAnalyticsId || !window.gtag) return;

    window.gtag('config', googleAnalyticsId, {
      page_title: document.title,
      page_location: window.location.href,
      page_path: location.pathname + location.search,
    });
  }, [location, googleAnalyticsId, enabled]);

  return null;
}

// Custom hook for tracking events
export function useAnalytics() {
  const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
    if (window.gtag) {
      window.gtag('event', eventName, parameters);
    }
  };

  const trackPageView = (pagePath: string, pageTitle?: string, trackingId?: string) => {
    if (window.gtag && trackingId) {
      window.gtag('config', trackingId, {
        page_path: pagePath,
        page_title: pageTitle || document.title,
      });
    }
  };

  return { trackEvent, trackPageView };
}

// SEO Meta Tags Component
interface SEOMetaTagsProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
}

export function SEOMetaTags({
  title,
  description,
  keywords,
  canonicalUrl,
  ogImage,
  ogType = 'website',
  twitterCard = 'summary_large_image'
}: SEOMetaTagsProps) {
  useEffect(() => {
    // Update document title
    if (title) {
      document.title = title;
    }

    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, property?: boolean) => {
      if (!content) return;
      
      const attribute = property ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
      
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, name);
        document.head.appendChild(meta);
      }
      
      meta.content = content;
    };

    // Standard meta tags
    if (description) updateMetaTag('description', description);
    if (keywords) updateMetaTag('keywords', keywords);

    // Open Graph tags
    if (title) updateMetaTag('og:title', title, true);
    if (description) updateMetaTag('og:description', description, true);
    if (ogImage) updateMetaTag('og:image', ogImage, true);
    updateMetaTag('og:type', ogType, true);
    if (canonicalUrl) updateMetaTag('og:url', canonicalUrl, true);

    // Twitter Card tags
    updateMetaTag('twitter:card', twitterCard);
    if (title) updateMetaTag('twitter:title', title);
    if (description) updateMetaTag('twitter:description', description);
    if (ogImage) updateMetaTag('twitter:image', ogImage);

    // Canonical URL
    if (canonicalUrl) {
      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = canonicalUrl;
    }
  }, [title, description, keywords, canonicalUrl, ogImage, ogType, twitterCard]);

  return null;
}