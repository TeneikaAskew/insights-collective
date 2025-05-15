
import React, { ReactElement } from 'react';
import { Route } from 'react-router-dom';

interface RouteElement {
  path?: string;
  element?: ReactElement;
  children?: RouteElement[];
}

export interface RouteInfo {
  path: string;
  name: string;
}

export const extractRouteName = (path: string): string => {
  // Remove leading slash and parameters
  const cleanPath = path.replace(/^\//, '').split(':')[0].replace(/\/$/, '');
  
  // Handle empty path (root)
  if (!cleanPath) return 'Home';
  
  // Convert kebab-case to Title Case
  return cleanPath
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Improved route extraction function to handle all route patterns
export const extractRoutes = (children: ReactElement[]): RouteInfo[] => {
  const routes: RouteInfo[] = [];
  const processedPaths = new Set<string>();

  // Recursively process routes including nested routes
  const processRoute = (element: ReactElement, parentPath: string = '') => {
    if (!element || !element.props) return;

    // Get path from props
    const { path, children } = element.props as RouteElement;
    
    // Skip routes without paths or dynamic index paths
    if (path === undefined || path === '*') return;

    // Create full path by combining parent path and current path
    const fullPath = path.startsWith('/') 
      ? path 
      : parentPath 
        ? `${parentPath}/${path}`.replace(/\/+/g, '/') 
        : path;
        
    // Add route if we haven't processed this path yet and it's not a parameter route
    if (!processedPaths.has(fullPath) && !fullPath.includes('*')) {
      processedPaths.add(fullPath);
      
      // Only add routes that don't start with parameters at the root level
      if (!fullPath.startsWith('/:')) {
        routes.push({
          path: fullPath,
          name: extractRouteName(fullPath),
        });
      }
    }

    // Process nested routes
    if (children) {
      if (Array.isArray(children)) {
        children.forEach(child => {
          if (child) processRoute(child as ReactElement, fullPath);
        });
      } else if (React.isValidElement(children)) {
        processRoute(children as ReactElement, fullPath);
      }
    }
  };

  // Process all route elements at the root level
  children.forEach(child => processRoute(child));
  
  console.log('Extracted routes:', routes);
  return routes;
};
