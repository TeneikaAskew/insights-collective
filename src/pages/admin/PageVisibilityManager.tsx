// ABOUTME: Ledger-style Page Visibility manager: every top-level page from the
// ABOUTME: manifest as a collapsible section row with its sub-pages indented,
// ABOUTME: role switches in-row, and a stale-entry cleanup driven by sync.

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, RefreshCw, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { usePageVisibility } from '@/contexts/PageVisibilityContext';
import { PAGE_MANIFEST, getAllManifestEntries, type ManifestPage } from '@/config/pageManifest';
import { cn } from '@/lib/utils';

interface RowProps {
  page: ManifestPage;
  child?: boolean;
  /** When a parent section is hidden for a role, children inherit it */
  parentHidden?: { users: boolean; instructors: boolean };
  childCount?: number;
  open?: boolean;
  /** Render the name cell as the section's CollapsibleTrigger button */
  asTrigger?: boolean;
}

// Mobile gets narrow control columns so the page name keeps a usable share of
// the row: 90px columns for a 44px switch left the name ~84px on a 390px
// screen, which truncated every name past "Dash…". Widths here are sized to the
// small switch below plus its header label, not to the desktop switch.
const COLUMNS =
  'grid grid-cols-[minmax(0,1fr)_50px_50px_52px] items-center gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_90px_90px_70px]';

// Radix renders the thumb as Root's only child <span>, so the thumb is sized
// from here rather than through a prop. The descendant selector outranks the
// thumb's own translate class, so the checked position follows the smaller
// track instead of overshooting it.
//
// Root IS the button, so shrinking the track shrinks the tap target with it —
// 36x20 on its own, well under the ~44px minimum. The grid cell around it is a
// plain <span> and takes no clicks, so the button has to carry the target
// itself: a transparent ::before grows the hit area to 44x44 without affecting
// layout or the visual size. It is confined to mobile, where the small track
// lives; the sm: track is already the original size.
const SWITCH_SIZE =
  'relative h-5 w-9 [&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4 ' +
  "before:absolute before:-inset-y-3 before:-inset-x-1 before:content-[''] " +
  'sm:h-6 sm:w-11 sm:[&>span]:h-5 sm:[&>span]:w-5 sm:[&>span]:data-[state=checked]:translate-x-5 ' +
  'sm:before:hidden';

function useVisibilityRow(path: string) {
  const { pageVisibility, updatePageVisibility } = usePageVisibility();
  const entry = pageVisibility.find(p => p.page_path === path);
  return {
    entry,
    setFlag: (field: 'visible_to_users' | 'visible_to_instructors', value: boolean) => {
      if (entry) updatePageVisibility(entry.id, { [field]: value });
    },
  };
}

function PageRow({ page, child, parentHidden, childCount, open, asTrigger }: RowProps) {
  const { entry, setFlag } = useVisibilityRow(page.path);
  const users = entry?.visible_to_users ?? true;
  const instructors = entry?.visible_to_instructors ?? true;

  const nameCellContent = (
    <>
      {!child && (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-ss-lav-chip text-ss-lav-deep">
          {childCount ? (
            open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3 opacity-30" />
          )}
        </span>
      )}
      <span className="truncate">{page.name}</span>
      {!child && childCount ? (
        <span className="shrink-0 text-xs font-normal text-muted-foreground">
          {childCount} sub-pages
        </span>
      ) : null}
      {!child && !childCount && page.path !== '/' ? (
        <span className="hidden shrink-0 text-xs font-normal text-muted-foreground lg:inline">
          governs {page.path}/*
        </span>
      ) : null}
    </>
  );

  return (
    <div
      className={cn(
        COLUMNS,
        'border-b border-border px-4 py-3 text-sm last:border-b-0 sm:px-6',
        child ? 'pl-10 sm:pl-14' : 'bg-ss-lav-chip/40',
      )}
      data-testid={`visibility-row-${page.path}`}
    >
      {asTrigger ? (
        // Only the name cell toggles the section — switches stay outside the
        // trigger so flipping one never collapses/expands the row, and the
        // real <button> keeps the toggle keyboard-accessible.
        <CollapsibleTrigger asChild>
          <button type="button" className="flex min-w-0 items-center gap-2 text-left font-semibold">
            {nameCellContent}
          </button>
        </CollapsibleTrigger>
      ) : (
        <span className={cn('flex min-w-0 items-center gap-2', !child && 'font-semibold')}>
          {nameCellContent}
        </span>
      )}
      <span className="hidden truncate font-mono text-xs text-muted-foreground sm:block">
        {page.path}
      </span>
      <span>
        <Switch
          className={SWITCH_SIZE}
          checked={users}
          disabled={!entry || parentHidden?.users}
          onCheckedChange={v => setFlag('visible_to_users', v)}
          aria-label={`${page.name} visible to all users`}
        />
        {parentHidden?.users && (
          <span className="mt-0.5 block text-[10px] text-muted-foreground">parent hidden</span>
        )}
      </span>
      <span>
        <Switch
          className={SWITCH_SIZE}
          checked={instructors}
          disabled={!entry || parentHidden?.instructors}
          onCheckedChange={v => setFlag('visible_to_instructors', v)}
          aria-label={`${page.name} visible to instructors`}
        />
        {parentHidden?.instructors && (
          <span className="mt-0.5 block text-[10px] text-muted-foreground">parent hidden</span>
        )}
      </span>
      <span className="text-xs text-muted-foreground">Always</span>
    </div>
  );
}

function SectionRows({ section, filter }: { section: ManifestPage; filter: string }) {
  const [open, setOpen] = useState(false);
  const { entry } = useVisibilityRow(section.path);

  const q = filter.trim().toLowerCase();
  const selfMatch =
    !q || section.name.toLowerCase().includes(q) || section.path.toLowerCase().includes(q);
  const matchingChildren = (section.children ?? []).filter(
    c => !q || c.name.toLowerCase().includes(q) || c.path.toLowerCase().includes(q),
  );
  if (!selfMatch && matchingChildren.length === 0) return null;

  const parentHidden = {
    users: entry ? !entry.visible_to_users : false,
    instructors: entry ? !(entry.visible_to_users || entry.visible_to_instructors) : false,
  };
  const children = q && !selfMatch ? matchingChildren : section.children ?? [];
  const forcedOpen = Boolean(q) && matchingChildren.length > 0;

  return (
    <Collapsible open={open || forcedOpen} onOpenChange={setOpen}>
      <PageRow
        page={section}
        childCount={section.children?.length}
        open={open || forcedOpen}
        asTrigger={Boolean(section.children?.length)}
      />
      <CollapsibleContent>
        {children.map(childPage => (
          <PageRow key={childPage.path} page={childPage} child parentHidden={parentHidden} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function PageVisibilityManager() {
  const { pageVisibility, syncAvailablePages, isSyncing, isLoading, loadError } = usePageVisibility();
  const [filter, setFilter] = useState('');

  const manifestPaths = useMemo(
    () => new Set(getAllManifestEntries().map(e => e.page_path)),
    [],
  );
  const staleRows = pageVisibility.filter(row => !manifestPaths.has(row.page_path));
  // Effectively hidden = hidden to students. users:true + instructors:false
  // blocks nobody (instructors see users OR instructors), so it must not count.
  const hiddenCount = pageVisibility.filter(
    row => manifestPaths.has(row.page_path) && !row.visible_to_users,
  ).length;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs text-muted-foreground">Admin / Platform</p>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="text-2xl font-semibold tracking-tight">Page visibility</h1>
          <span className="ss-serif text-sm text-ss-peach-deep">every page, one ledger</span>
        </div>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Hide a section and its whole subtree goes with it — a hidden page never loads for the
          roles you switch off; visitors see Coming Soon instead. Admins always see everything.
        </p>
      </div>

      {loadError && (
        <Card className="border-ss-bad bg-ss-bad-chip">
          <CardContent className="py-3 text-sm text-ss-bad">
            Visibility settings failed to load — gated pages are hidden for non-admins until this
            resolves.
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter pages or paths…"
            className="rounded-full pl-9"
          />
        </div>
        <span className="ss-chip">{manifestPaths.size} pages</span>
        {hiddenCount > 0 && (
          <span className="inline-flex items-center rounded-full bg-ss-warn-chip px-3 py-1 text-xs font-medium text-ss-warn sm:text-sm">
            {hiddenCount} hidden
          </span>
        )}
        <Button
          variant="outline"
          className="rounded-full"
          onClick={syncAvailablePages}
          disabled={isSyncing}
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', isSyncing && 'animate-spin')} />
          {isSyncing ? 'Syncing…' : 'Sync from manifest'}
        </Button>
      </div>

      <Card className="ss-card overflow-hidden bg-card p-0">
        <div
          className={cn(
            COLUMNS,
            'border-b border-border bg-ss-card-warm px-4 py-2.5 text-[11px] uppercase tracking-[0.08em] text-muted-foreground sm:px-6',
          )}
        >
          <span>Page</span>
          <span className="hidden sm:block">Path</span>
          {/* Short forms on mobile so an 11px uppercase label fits its column
              without wrapping. Each switch carries the full wording in its
              aria-label, so nothing is lost to a screen reader. */}
          <span>
            <span className="sm:hidden">Users</span>
            <span className="hidden sm:inline">All users</span>
          </span>
          <span>
            <span className="sm:hidden">Instr</span>
            <span className="hidden sm:inline">Instructors</span>
          </span>
          <span>Admins</span>
        </div>
        {isLoading ? (
          // Don't render switches while settings load — checked-but-disabled
          // toggles read as a broken state, not a pending one.
          <div
            className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground"
            data-testid="visibility-loading"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading visibility settings…
          </div>
        ) : (
          PAGE_MANIFEST.map(section => (
            <SectionRows key={section.path} section={section} filter={filter} />
          ))
        )}
      </Card>

      {staleRows.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="space-y-2 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">
                  Stale entries{' '}
                  <span className="ml-1 inline-flex items-center rounded-full bg-ss-bad-chip px-2 py-0.5 text-xs font-semibold text-ss-bad">
                    {staleRows.length}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Rows for paths the app no longer manages — their toggles do nothing. Sync removes
                  them.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-ss-bad"
                onClick={syncAvailablePages}
                disabled={isSyncing}
              >
                Clean up
              </Button>
            </div>
            <ul className="space-y-1">
              {staleRows.map(row => (
                <li key={row.id} className="font-mono text-xs text-muted-foreground">
                  {row.page_path}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        A sub-page can be visible only while its section is — switches show "parent hidden" when
        inherited. Pages without a database row yet need a sync before they can be toggled.
      </p>
    </div>
  );
}
