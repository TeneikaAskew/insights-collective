
import { ReactElement } from 'react';

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

// Enhanced route extraction logic to better capture all routes
export const extractRoutes = (children: ReactElement[]): RouteInfo[] => {
  const routes: RouteInfo[] = [];
  const visitedPaths = new Set<string>();

  // Helper function to process route elements recursively
  const processRoute = (element: ReactElement, parentPath: string = '') => {
    if (!element || !element.props) return;

    // Get the current route's path
    const currentPath = element.props.path;
    
    if (currentPath) {
      // Construct the full path by combining parent and current paths
      const fullPath = currentPath.startsWith('/')
        ? currentPath
        : `${parentPath}/${currentPath}`.replace(/\/+/g, '/');
      
      // Process non-dynamic routes at this level
      if (!fullPath.includes('*') && !visitedPaths.has(fullPath)) {
        visitedPaths.add(fullPath);
        routes.push({
          path: fullPath,
          name: extractRouteName(fullPath),
        });
      }
    }

    // Process children
    const children = element.props.children;
    if (children) {
      const nextParentPath = currentPath 
        ? (currentPath.startsWith('/') ? currentPath : `${parentPath}/${currentPath}`.replace(/\/+/g, '/'))
        : parentPath;
        
      if (Array.isArray(children)) {
        children.forEach(child => {
          if (child) processRoute(child as ReactElement, nextParentPath);
        });
      } else if (React.isValidElement(children)) {
        processRoute(children, nextParentPath);
      }
    }
  };

  // Process all routes
  children.forEach(child => processRoute(child));
  
  return routes;
};

// New function to extract routes from sidebar navigation
export const extractSidebarRoutes = (navItems: any[]): RouteInfo[] => {
  const routes: RouteInfo[] = [];
  const visitedPaths = new Set<string>();
  
  const processNavItem = (item: any) => {
    // Process current item
    if (item.url || item.path) {
      const path = item.url || item.path;
      if (!visitedPaths.has(path)) {
        visitedPaths.add(path);
        routes.push({
          path,
          name: item.title || extractRouteName(path),
        });
      }
    }
    
    // Process children if any
    if (item.children && Array.isArray(item.children)) {
      item.children.forEach(processNavItem);
    }
  };
  
  navItems.forEach(processNavItem);
  return routes;
};
