
/**
 * Security utilities for role checking and input validation
 */

import { supabase } from '@/integrations/supabase/client';

import { createLogger } from '@/utils/logger';

const logger = createLogger('sanitizeInput');

// Enhanced input sanitization with comprehensive XSS protection
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  
  // Remove potential XSS patterns and dangerous content
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/eval\s*\(/gi, '')
    .replace(/setTimeout\s*\(/gi, '')
    .replace(/setInterval\s*\(/gi, '')
    .trim();
};

// Sanitize HTML content for rich text editor
export const sanitizeHtmlContent = (html: string): string => {
  if (!html) return '';
  
  // First, preserve safe video embeds by temporarily replacing them
  const videoEmbedPlaceholders: { placeholder: string; content: string }[] = [];
  let placeholderIndex = 0;
  
  // Preserve YouTube and Vimeo embeds
  html = html.replace(/<iframe\s+[^>]*src=["'](https:\/\/(?:www\.)?(?:youtube\.com\/embed\/|player\.vimeo\.com\/video\/)[^"']+)["'][^>]*><\/iframe>/gi, (match, src) => {
    const placeholder = `__SAFE_VIDEO_EMBED_${placeholderIndex}__`;
    videoEmbedPlaceholders.push({ placeholder, content: match });
    placeholderIndex++;
    return placeholder;
  });
  
  // Preserve video-embed divs with iframes (from our canvas editor)
  html = html.replace(/<div[^>]*class=["'][^"']*video-embed[^"']*["'][^>]*>[\s\S]*?<iframe\s+[^>]*src=["'](https:\/\/(?:www\.)?(?:youtube\.com\/embed\/|player\.vimeo\.com\/video\/)[^"']+)["'][^>]*>[\s\S]*?<\/iframe>[\s\S]*?<\/div>/gi, (match) => {
    const placeholder = `__SAFE_VIDEO_EMBED_${placeholderIndex}__`;
    videoEmbedPlaceholders.push({ placeholder, content: match });
    placeholderIndex++;
    return placeholder;
  });
  
  // Also preserve divs with data-youtube-video attribute (from our TipTap extension)
  html = html.replace(/<div[^>]*data-youtube-video[^>]*>[\s\S]*?<iframe\s+[^>]*src=["'](https:\/\/(?:www\.)?(?:youtube\.com\/embed\/|player\.vimeo\.com\/video\/)[^"']+)["'][^>]*>[\s\S]*?<\/iframe>[\s\S]*?<\/div>/gi, (match) => {
    const placeholder = `__SAFE_VIDEO_EMBED_${placeholderIndex}__`;
    videoEmbedPlaceholders.push({ placeholder, content: match });
    placeholderIndex++;
    return placeholder;
  });
  
  // Remove dangerous elements (including non-whitelisted iframes)
  html = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/vbscript:/gi, '');
  
  // Restore safe video embeds
  videoEmbedPlaceholders.forEach(({ placeholder, content }) => {
    html = html.replace(placeholder, content);
  });
  
  return html;
};

// Validate email format
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
};

// Validate URL format
export const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
};

// Validate redirect URLs for authentication
export const isValidRedirectUrl = (url: string, allowedDomains: string[]): boolean => {
  try {
    const urlObj = new URL(url);
    return allowedDomains.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    );
  } catch {
    // If it's a relative path, it's generally safe
    return url.startsWith('/') && !url.startsWith('//');
  }
};

// Enhanced rate limiting with IP tracking
export const createRateLimiter = (maxAttempts: number, windowMs: number) => {
  const attempts = new Map<string, { count: number; resetTime: number; lastAttempt: number }>();
  
  return (identifier: string): { allowed: boolean; resetTime?: number } => {
    const now = Date.now();
    const record = attempts.get(identifier);
    
    if (!record || now > record.resetTime) {
      attempts.set(identifier, { count: 1, resetTime: now + windowMs, lastAttempt: now });
      return { allowed: true };
    }
    
    // Progressive backoff for repeated attempts
    const timeSinceLastAttempt = now - record.lastAttempt;
    const minInterval = Math.min(1000 * Math.pow(2, record.count - 1), 30000); // Max 30 seconds
    
    if (timeSinceLastAttempt < minInterval) {
      return { allowed: false, resetTime: record.lastAttempt + minInterval };
    }
    
    if (record.count >= maxAttempts) {
      return { allowed: false, resetTime: record.resetTime };
    }
    
    record.count++;
    record.lastAttempt = now;
    return { allowed: true };
  };
};

// Validate form field configurations to prevent injection
export const validateFormFieldConfig = (fieldConfig: any): boolean => {
  if (!fieldConfig || typeof fieldConfig !== 'object') return false;
  
  // Check for dangerous field types or configurations
  const dangerousPatterns = [
    /script/i,
    /javascript/i,
    /eval/i,
    /expression/i,
    /vbscript/i,
    /data:text\/html/i
  ];
  
  const configString = JSON.stringify(fieldConfig);
  return !dangerousPatterns.some(pattern => pattern.test(configString));
};

// Session integrity validation
export const validateSessionIntegrity = (session: any): boolean => {
  if (!session?.user?.id || !session?.access_token) {
    return false;
  }
  
  // Check if session is expired
  const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
  if (expiresAt && expiresAt < new Date()) {
    return false;
  }
  
  return true;
};

// Enhanced security functions using new database functions
export const checkAdminAccess = async (userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .rpc('has_admin_access', { user_id_param: userId });
    
    if (error) {
      logger.error('Error checking admin access:', error);
      await logSecurityEvent(userId, 'admin_check_failed', 'error', 'Failed to verify admin access', { error: error.message });
      return false;
    }
    
    return data || false;
  } catch (error) {
    logger.error('Exception checking admin access:', error);
    return false;
  }
};

export const checkCourseInstructorAccess = async (userId: string, courseId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .rpc('is_course_instructor', { 
        user_id_param: userId, 
        course_id_param: courseId 
      });
    
    if (error) {
      logger.error('Error checking instructor access:', error);
      await logSecurityEvent(userId, 'instructor_check_failed', 'error', 'Failed to verify instructor access', { courseId, error: error.message });
      return false;
    }
    
    return data || false;
  } catch (error) {
    logger.error('Exception checking instructor access:', error);
    return false;
  }
};

export const checkConversationAccess = async (userId: string, conversationId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .rpc('is_conversation_participant', { 
        user_id_param: userId, 
        conversation_id_param: conversationId 
      });
    
    if (error) {
      logger.error('Error checking conversation access:', error);
      await logSecurityEvent(userId, 'conversation_check_failed', 'error', 'Failed to verify conversation access', { conversationId, error: error.message });
      return false;
    }
    
    return data || false;
  } catch (error) {
    logger.error('Exception checking conversation access:', error);
    return false;
  }
};

// Security event logging
export const logSecurityEvent = async (
  userId: string, 
  eventType: string, 
  severity: 'info' | 'warning' | 'error', 
  description: string, 
  metadata?: any
): Promise<void> => {
  try {
    await supabase.rpc('log_security_event', {
      p_user_id: userId,
      p_event_type: eventType,
      p_severity: severity,
      p_description: description,
      p_metadata: metadata || null
    });
  } catch (error) {
    logger.error('Failed to log security event:', error);
  }
};

// Audit logging
export const logAuditEvent = async (
  userId: string,
  action: string,
  tableName: string,
  recordId?: string,
  oldValues?: any,
  newValues?: any
): Promise<void> => {
  try {
    await supabase.rpc('log_audit_event', {
      p_user_id: userId,
      p_action: action,
      p_table_name: tableName,
      p_record_id: recordId || null,
      p_old_values: oldValues || null,
      p_new_values: newValues || null
    });
  } catch (error) {
    logger.error('Failed to log audit event:', error);
  }
};
