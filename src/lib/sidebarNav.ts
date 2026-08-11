// ABOUTME: Class names for sidebar nav rows. The colours themselves live in
// ABOUTME: src/index.css (@layer components, `.ss-nav-*`) — edit them there.

// This module used to hold Tailwind colour utilities inline, which meant a nav
// colour change was a TypeScript edit that recompiled every importer. The
// declarations now live in one CSS block and this file just names them, so the
// rails share a single source of truth and CSS stays the place styling is
// changed.

/** Row shape + resting/hover colours. Always applied. */
export const SIDEBAR_NAV_ITEM = 'ss-nav-item';

/** Add alongside SIDEBAR_NAV_ITEM on the current page's row. */
export const SIDEBAR_NAV_ITEM_ACTIVE = 'ss-nav-item--active';

/** Put on the row's icon so it tracks resting/hover/active with the row. */
export const SIDEBAR_NAV_ICON = 'ss-nav-icon';

/** Background + border for the rail that holds the rows. */
export const SIDEBAR_NAV_RAIL = 'ss-nav-rail';

/**
 * Resting-state classes for rails built on the shadcn `SidebarMenuButton`,
 * which supplies its own active styling through `data-[active=true]`. Those
 * rails pass `isActive` and use this for the rest.
 */
export const SIDEBAR_NAV_INACTIVE = SIDEBAR_NAV_ITEM;

export function sidebarNavItemClass(active: boolean): string {
  return active ? `${SIDEBAR_NAV_ITEM} ${SIDEBAR_NAV_ITEM_ACTIVE}` : SIDEBAR_NAV_ITEM;
}

export function sidebarNavIconClass(_active: boolean): string {
  // The CSS descendant rules already switch the icon on hover and active, so
  // callers no longer branch — the argument stays for call-site compatibility.
  return SIDEBAR_NAV_ICON;
}
