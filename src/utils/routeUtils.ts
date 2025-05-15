
import React from 'react';

/**
 * Interface representing information about a route
 */
export interface RouteInfo {
  /**
   * The path of the route (e.g., "/courses/:courseId")
   */
  path: string;
  /**
   * The name of the route derived from the component name or path
   */
  name: string;
  /**
   * Optional flag indicating if the route is an admin route
   */
  isAdmin?: boolean;
}

/**
 * Extracts a route name from a component or path string
 * 
 * @param component React component or path string
 * @returns A human-readable name for the route
 */
export const extractRouteName = (component: any): string => {
  // If we have a direct path string
  if (typeof component === 'string') {
    // Remove leading/trailing slashes and convert to title case
    return component
      .replace(/^\/|\/$/g, '')
      .split('/')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
      .replace(/-/g, ' ');
  }
  
  // Try to get the displayName or name from the component
  if (component && typeof component === 'object') {
    const name = component.displayName || component.name;
    if (name) {
      // Convert CamelCase to spaces and title case
      return name.replace(/([A-Z])/g, ' $1').trim();
    }
  }
  
  return 'Unknown Route';
};

/**
 * Extracts routes from React Router DOM's structure
 * 
 * @param routes Array of route elements from React Router DOM
 * @returns Array of route info objects
 */
export const extractRoutes = (routes: HTMLCollection | Element[]): RouteInfo[] => {
  const extractedRoutes: RouteInfo[] = [];
  
  const processRouteElement = (element: Element) => {
    // Check if this is a route element
    if (element.tagName.toLowerCase() === 'route') {
      const path = element.getAttribute('path') || '';
      if (path) {
        const name = extractRouteName(element.getAttribute('element') || path);
        const isAdmin = path.startsWith('/admin') || false;
        
        extractedRoutes.push({
          path,
          name,
          isAdmin
        });
      }
    }
    
    // Process children routes recursively
    if (element.children && element.children.length > 0) {
      Array.from(element.children).forEach(processRouteElement);
    }
  };
  
  // Process all route elements
  Array.from(routes).forEach(processRouteElement);
  
  return extractedRoutes;
};
