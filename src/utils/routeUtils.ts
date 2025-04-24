
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
