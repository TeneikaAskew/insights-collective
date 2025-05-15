
import React, { ReactElement } from 'react';

interface RouteElement {
  path?: string;
  props?: {
    children?: React.ReactNode;
    path?: string;
  };
}

/**
 * Recursively extracts routes from React Router components
 */
export const extractRoutes = (children: ReactElement[]): { path: string | undefined }[] => {
  if (!Array.isArray(children)) {
    return [];
  }

  const routes: { path: string | undefined }[] = [];

  children.forEach((child) => {
    if (!child || !React.isValidElement(child)) {
      return;
    }

    // Check if it's a route element with a path prop
    if (child.props?.path) {
      routes.push({ path: child.props.path });
    }

    // Recursively check children
    if (child.props?.children) {
      const childRoutes = extractRoutes(
        Array.isArray(child.props.children) 
          ? child.props.children.filter(c => React.isValidElement(c)) as ReactElement[] 
          : React.isValidElement(child.props.children) 
            ? [child.props.children as ReactElement] 
            : []
      );
      routes.push(...childRoutes);
    }
  });

  return routes;
};

/**
 * Extracts a human-readable page name from a route path
 */
export const extractRouteName = (path: string): string => {
  // Handle index route
  if (path === '/' || path === '*') {
    return 'Home';
  }

  // Remove leading slash and params
  let name = path
    .replace(/^\/+/, '')  // Remove leading slashes
    .replace(/\/+$/, '')  // Remove trailing slashes
    .replace(/:[^/]+/g, '') // Remove route params
    .replace(/\*$/, 'Not Found'); // Replace wildcard with "Not Found"

  // Handle empty string after replacements
  if (!name) {
    return 'Home';
  }

  // Convert to title case and replace hyphens/underscores with spaces
  return name
    .split(/[/\-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .filter(Boolean)
    .join(' ');
};
