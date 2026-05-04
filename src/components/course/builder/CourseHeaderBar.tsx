// ABOUTME: Top bar of the course builder. Title, back link, preview + publish toggle.
// ABOUTME: No tabs — secondary builder views live as sub-routes under /courses/:id/builder.

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ChevronLeft, Eye, Loader2 } from 'lucide-react';

export interface CourseHeaderBarProps {
  courseId: string;
  title: string;
  published: boolean;
  saving?: boolean;
  lastSavedAt?: Date | null;
  onPublishedChange: (next: boolean) => void;
  onTitleChange?: (next: string) => void;
}

export function CourseHeaderBar({
  courseId,
  title,
  published,
  saving = false,
  lastSavedAt,
  onPublishedChange,
  onTitleChange,
}: CourseHeaderBarProps) {
  return (
    <div className="flex items-center gap-4 border-b bg-background px-4 py-3">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/admin/courses">
          <ChevronLeft className="h-4 w-4 mr-1" />
          My Courses
        </Link>
      </Button>

      <div className="flex-1 min-w-0">
        {onTitleChange ? (
          <input
            className="w-full bg-transparent text-lg font-semibold outline-none focus:ring-2 focus:ring-primary rounded px-2 py-1 -mx-2"
            value={title}
            placeholder="Untitled course"
            onChange={(e) => onTitleChange(e.target.value)}
          />
        ) : (
          <h1 className="text-lg font-semibold truncate">{title || 'Untitled course'}</h1>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {saving ? (
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving…
          </span>
        ) : lastSavedAt ? (
          <span>Saved {timeAgo(lastSavedAt)}</span>
        ) : null}
      </div>

      <Button variant="outline" size="sm" asChild>
        <Link to={`/courses/${courseId}/learn`}>
          <Eye className="h-4 w-4 mr-1" />
          Preview
        </Link>
      </Button>

      <div className="flex items-center gap-2">
        <Switch
          id="publish-toggle"
          checked={published}
          onCheckedChange={onPublishedChange}
        />
        <Label htmlFor="publish-toggle" className="text-sm">
          {published ? 'Published' : 'Draft'}
        </Label>
      </div>
    </div>
  );
}

function timeAgo(date: Date): string {
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  return `${diffH}h ago`;
}

export default CourseHeaderBar;
