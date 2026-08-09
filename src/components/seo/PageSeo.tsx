// ABOUTME: Per-route head metadata helper built on react-helmet-async.
// ABOUTME: Emits unique title/description, a self-referencing canonical, og/twitter tags and optional JSON-LD.

import React from 'react';
import { Helmet } from 'react-helmet-async';

export const SITE_URL = 'https://insightscollective.org';
export const SITE_NAME = 'Insights Collective';
const DEFAULT_OG_IMAGE = `${SITE_URL}/lovable-uploads/49b24efc-0d49-4e68-817b-04e7b82b9254.png`;

interface PageSeoProps {
  title: string;
  description: string;
  /** Route path, e.g. "/blog/my-post". Used for canonical and og:url. */
  path: string;
  /** Absolute or root-relative image URL; resolved against the site origin. */
  image?: string;
  type?: 'website' | 'article';
  /** Any JSON-LD object(s) to attach to this route. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const absolute = (url?: string) => {
  if (!url) return DEFAULT_OG_IMAGE;
  if (/^https?:\/\//i.test(url)) return url;
  return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

const PageSeo: React.FC<PageSeoProps> = ({ title, description, path, image, type = 'website', jsonLd }) => {
  const url = `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const imageUrl = absolute(image);
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:site_name" content={SITE_NAME} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />

      {blocks.map((block, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
};

export default PageSeo;
