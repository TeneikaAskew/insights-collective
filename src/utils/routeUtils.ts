
import { ReactElement } from 'react';
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

export const extractRoutes = (children: ReactElement[]): RouteInfo[] => {
  const routes: RouteInfo[] = [];

  const processRoute = (element: ReactElement) => {
    if (!element || !element.props) return;

    const { path } = element.props as RouteElement;
    
    // Skip routes without paths or dynamic segments at root level
    if (!path || path === '*' || path.includes(':')) return;
    
    routes.push({
      path,
      name: extractRouteName(path),
    });

    // Process nested routes if they exist
    if (element.props.children) {
      if (Array.isArray(element.props.children)) {
        element.props.children.forEach(child => {
          if (child) processRoute(child as ReactElement);
        });
      } else if (element.props.children.props?.path) {
        processRoute(element.props.children as ReactElement);
      }
    }
  };

  children.forEach(child => processRoute(child));
  return routes;
};

// New function to extract all routes including nested routes
export const extractAllRoutes = (rootElement: ReactElement): RouteInfo[] => {
  const routes: RouteInfo[] = [];
  
  const processAllRoutes = (element: ReactElement, parentPath: string = '') => {
    if (!element || !element.props) return;
    
    // Process current route
    const { path } = element.props as RouteElement;
    
    if (path && path !== '*') {
      // Handle absolute and relative paths
      const fullPath = path.startsWith('/') ? path : parentPath ? `${parentPath}/${path}` : `/${path}`;
      
      // Skip dynamic segments from the route list display
      if (!fullPath.includes(':')) {
        routes.push({
          path: fullPath,
          name: extractRouteName(fullPath),
        });
      }
    }
    
    // Process all children routes
    if (element.props.children) {
      const nextParentPath = path ? (path.startsWith('/') ? path : `${parentPath}/${path}`) : parentPath;
      
      if (Array.isArray(element.props.children)) {
        element.props.children.forEach(child => {
          if (child) processAllRoutes(child as ReactElement, nextParentPath);
        });
      } else if (element.props.children.props) {
        processAllRoutes(element.props.children as ReactElement, nextParentPath);
      }
    }
  };
  
  processAllRoutes(rootElement);
  return routes;
};

// Function to extract routes from sidebar/navbar configurations
export const extractConfigRoutes = (configs: any[]): RouteInfo[] => {
  const routes: RouteInfo[] = [];
  
  const extractUrlsFromConfig = (item: any) => {
    if (item.url && typeof item.url === 'string' && !item.url.startsWith('#')) {
      routes.push({
        path: item.url,
        name: item.title || extractRouteName(item.url),
      });
    }
    
    // Check for nested items/children
    if (item.items && Array.isArray(item.items)) {
      item.items.forEach(extractUrlsFromConfig);
    }
    if (item.children && Array.isArray(item.children)) {
      item.children.forEach(extractUrlsFromConfig);
    }
  };
  
  configs.forEach(config => extractUrlsFromConfig(config));
  return routes;
};
