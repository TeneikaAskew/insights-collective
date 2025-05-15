
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

  const processRoute = (element: ReactElement, parentPath = '') => {
    if (!element || !element.props) return;

    const props = element.props as RouteElement;
    const path = props.path;
    
    // Skip routes without paths or with wildcard paths or direct dynamic segments at root level
    if (!path || path === '*' || (path.includes(':') && !parentPath)) {
      // If this route has children, still process them
      if (props.children) {
        const childrenArray = Array.isArray(props.children) 
          ? props.children 
          : [props.children];
          
        childrenArray.forEach(child => {
          if (React.isValidElement(child)) {
            processRoute(child as ReactElement, parentPath);
          }
        });
      }
      return;
    }
    
    // Construct full path
    const fullPath = parentPath 
      ? (path.startsWith('/') ? path : `${parentPath}/${path}`)
      : path;
    
    // Add route to list
    routes.push({
      path: fullPath,
      name: extractRouteName(fullPath),
    });
    
    // Process nested routes
    if (props.children) {
      const childrenArray = Array.isArray(props.children) 
        ? props.children 
        : [props.children];
        
      childrenArray.forEach(child => {
        if (React.isValidElement(child)) {
          processRoute(child as ReactElement, fullPath);
        }
      });
    }
  };

  children.forEach(child => {
    if (React.isValidElement(child)) {
      processRoute(child as ReactElement);
    }
  });
  
  return routes;
};
