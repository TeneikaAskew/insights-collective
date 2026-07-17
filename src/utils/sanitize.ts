// ABOUTME: DOMPurify-based HTML sanitization utility for safe dangerouslySetInnerHTML rendering
// ABOUTME: Prevents XSS attacks by sanitizing all user-controlled HTML content before rendering

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content for safe rendering via dangerouslySetInnerHTML.
 * Allows common formatting tags while stripping dangerous content.
 */
export const sanitizeHTML = (dirty: string): string => {
  if (!dirty) return '';
  
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'del', 's',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'a', 'code', 'pre', 'blockquote',
      'span', 'div', 'img', 'hr',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'video', 'source', 'audio',
      'iframe',
    ],
    ALLOWED_ATTR: [
      'href', 'class', 'className', 'target', 'rel',
      'src', 'alt', 'width', 'height', 'style',
      'value', 'controls', 'allowfullscreen',
      'allow', 'frameborder', 'title',
      'data-youtube-video',
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ADD_ATTR: ['target'],
  });
};
