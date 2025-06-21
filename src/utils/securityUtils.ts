
/**
 * Security utilities for role checking and input validation
 */

import { supabase } from '@/integrations/supabase/client';

// Input sanitization
export const sanitizeInput = (input: string): string => {
  if (!input) return '';
  
  // Remove potential XSS patterns
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .trim();
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

// Rate limiting helper
export const createRateLimiter = (maxAttempts: number, windowMs: number) => {
  const attempts = new Map<string, { count: number; resetTime: number }>();
  
  return (identifier: string): boolean => {
    const now = Date.now();
    const record = attempts.get(identifier);
    
    if (!record || now > record.resetTime) {
      attempts.set(identifier, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (record.count >= maxAttempts) {
      return false;
    }
    
    record.count++;
    return true;
  };
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
      console.error('Error checking admin access:', error);
      await logSecurityEvent(userId, 'admin_check_failed', 'error', 'Failed to verify admin access', { error: error.message });
      return false;
    }
    
    return data || false;
  } catch (error) {
    console.error('Exception checking admin access:', error);
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
      console.error('Error checking instructor access:', error);
      await logSecurityEvent(userId, 'instructor_check_failed', 'error', 'Failed to verify instructor access', { courseId, error: error.message });
      return false;
    }
    
    return data || false;
  } catch (error) {
    console.error('Exception checking instructor access:', error);
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
      console.error('Error checking conversation access:', error);
      await logSecurityEvent(userId, 'conversation_check_failed', 'error', 'Failed to verify conversation access', { conversationId, error: error.message });
      return false;
    }
    
    return data || false;
  } catch (error) {
    console.error('Exception checking conversation access:', error);
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
    console.error('Failed to log security event:', error);
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
    console.error('Failed to log audit event:', error);
  }
};
