// ABOUTME: Single source of truth for sidebar nav-item colours across the app.
// ABOUTME: AppSidebar sets the house style; the course rail and the builder rail import it.

// The three sidebars in this app were each styled by hand and drifted apart:
// the course rail painted its active item with `bg-primary/10 / border-r-2`,
// and the builder rail painted *every* item in `text-primary`, so moving from
// /dashboard into a course looked like moving into a different product.
// Everything below is expressed in `--sidebar-*` tokens, which are the tokens
// the shadcn Sidebar primitive already uses, so light and dark both follow.

/** Resting state for a nav item that is not the current page. */
export const SIDEBAR_NAV_INACTIVE =
  'text-sidebar-foreground/80 hover:text-sidebar-accent hover:bg-sidebar-accent/10';

/**
 * Current-page state. The shadcn `SidebarMenuButton` applies the equivalent of
 * this itself via `data-[active=true]`, so rails built on that primitive should
 * pass `isActive` instead of this class; it exists for the hand-rolled builder rail.
 */
export const SIDEBAR_NAV_ACTIVE =
  'bg-sidebar-accent text-sidebar-accent-foreground font-medium';

/** Icon tint. Inactive icons stay muted; active icons ride the accent pill. */
export const SIDEBAR_NAV_ICON_INACTIVE = 'text-muted-foreground';
export const SIDEBAR_NAV_ICON_ACTIVE = 'text-sidebar-accent-foreground';

/** Shape shared by every nav item, independent of state. */
export const SIDEBAR_NAV_ITEM_BASE =
  'flex items-center rounded-md transition-colors duration-200';

export function sidebarNavItemClass(active: boolean): string {
  return `${SIDEBAR_NAV_ITEM_BASE} ${active ? SIDEBAR_NAV_ACTIVE : SIDEBAR_NAV_INACTIVE}`;
}

export function sidebarNavIconClass(active: boolean): string {
  return active ? SIDEBAR_NAV_ICON_ACTIVE : SIDEBAR_NAV_ICON_INACTIVE;
}
