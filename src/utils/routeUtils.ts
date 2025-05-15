
import React from 'react';

// Extract route information from the DOM
export const extractRoutes = (elements: Element[]): RouteInfo[] => {
  const routes: RouteInfo[] = [];
  
  // Process route elements and create RouteInfo objects
  elements.forEach((element) => {
    if (element.hasAttribute('path')) {
      const path = element.getAttribute('path') || '';
      const name = extractRouteName(path);
      
      routes.push({
        path,
        name
      });
    }
    
    // Check for nested routes
    if (element.children && element.children.length > 0) {
      // Process nested routes recursively
      const nestedRoutes = extractRoutes(Array.from(element.children));
      routes.push(...nestedRoutes);
    }
  });
  
  return routes;
};

// Helper to extract a readable name from route paths
export const extractRouteName = (path: string): string => {
  // Remove leading slash and any URL parameters
  let name = path.replace(/^\//, '').replace(/\/:[^/]+/g, '');
  
  // Split by remaining slashes (for nested paths)
  const parts = name.split('/');
  
  // Use last meaningful part or default to "Home" for root path
  name = parts.filter(Boolean).pop() || 'Home';
  
  // Convert kebab-case to Title Case and remove special characters
  name = name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  
  return name;
};

// Type definition for route information
export interface RouteInfo {
  path: string;
  name: string;
}

// Function to build breadcrumb data from current path
export const buildBreadcrumbs = (path: string): {path: string, label: string}[] => {
  const parts = path.split('/').filter(Boolean);
  
  // Start with Home
  const breadcrumbs = [{
    path: '/',
    label: 'Home'
  }];
  
  // Build up each level
  let currentPath = '';
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    // Skip URL parameters (starting with :)
    if (part.startsWith(':')) continue;
    
    currentPath = `${currentPath}/${part}`;
    
    // Normalize path name for display
    const label = part
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    breadcrumbs.push({
      path: currentPath, 
      label
    });
  }
  
  return breadcrumbs;
};
