import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileArchive, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { createLogger } from '@/utils/logger';
import {
  parseArchive,
  sendArchive,
  ArchiveError,
  type ParsedArchive,
  type ImportResult,
} from '@/utils/xArchiveUpload';

const logger = createLogger('TweetArchiveUploadDialog');

interface TweetArchiveUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rows are attributed to this admin in public.resources. */
  createdBy: string | null;
  /** Fired after a successful import so the page can refetch. */
  onImported?: () => void;
}

type Stage = 'choose' | 'parsing' | 'review' | 'importing' | 'done';

/**
 * Admin-only importer for the archive X emails you on request.
 *
 * The file never leaves the browser: the zip is opened locally and only the
 * mapped tweet rows are posted to the import-x-archive Edge Function. That
 * matters because an X archive also carries direct messages, contacts and every
 * image ever posted, and is usually gigabytes.
 *
 * Parsing is deliberately a separate step from writing — the admin sees the
 * counts and date range and confirms before anything is sent.
 */
export const TweetArchiveUploadDialog: React.FC<TweetArchiveUploadDialogProps> = ({
  open,
  onOpenChange,
  createdBy,
  onImported,
}) => {
  const [stage, setStage] = useState<Stage>('choose');
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedArchive | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [progress, setProgress] = useState({ sent: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = useCallback(() => {
    setStage('choose');
    setError(null);
    setParsed(null);
    setFileName('');
    setProgress({ sent: 0, total: 0 });
    setResult(null);
  }, []);

  const handleOpenChange = (next: boolean) => {
    // Never yank the dialog out from under an in-flight import; the batches are
    // upserts so the data would survive, but the admin would lose the report.
    if (!next && stage === 'importing') return;
    if (!next) reset();
    onOpenChange(next);
  };

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;

      setError(null);
      setFileName(file.name);
      setStage('parsing');

      try {
        const outcome = await parseArchive(file, createdBy);
        setParsed(outcome);
        setStage('review');
      } catch (caught) {
        logger.error('Failed to parse archive:', caught);
        setError(
          caught instanceof ArchiveError
            ? caught.message
            : `Could not read ${file.name}. Is it the archive zip or its tweets.js?`,
        );
        setStage('choose');
      }
    },
    [createdBy],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    // Browsers report .js as text/javascript or nothing at all depending on the
    // platform, so the extensions are what actually match here.
    accept: {
      'application/zip': ['.zip'],
      'application/octet-stream': ['.zip', '.js'],
      'text/javascript': ['.js'],
    },
    disabled: stage === 'parsing' || stage === 'importing',
  });

  const runImport = async () => {
    if (!parsed) return;

    setStage('importing');
    setError(null);
    setProgress({ sent: 0, total: parsed.tweetRows.length });

    try {
      const outcome = await sendArchive(parsed, setProgress);
      setResult(outcome);
      setStage('done');
      onImported?.();
    } catch (caught) {
      logger.error('Import failed:', caught);
      setError(caught instanceof Error ? caught.message : 'Import failed.');
      setStage('review');
    }
  };

  const dateRange = parsed
    ? (() => {
        const dates = parsed.tweetRows.map((row) => row.tweeted_at).sort();
        const first = dates[0];
        const last = dates[dates.length - 1];
        try {
          return `${format(parseISO(first), 'MMM d, yyyy')} – ${format(parseISO(last), 'MMM d, yyyy')}`;
        } catch {
          return null;
        }
      })()
    : null;

  const skippedTotal = parsed
    ? parsed.skipped.noId + parsed.skipped.badDate + parsed.skipped.duplicate
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="tweet-archive-upload-dialog">
        <DialogHeader>
          <DialogTitle>Import tweets from your X archive</DialogTitle>
          <DialogDescription>
            Request it at x.com → Settings → Your account → Download an archive of your data.
            Drop the zip in as-is — it is read here in your browser, not uploaded.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription data-testid="archive-upload-error">{error}</AlertDescription>
          </Alert>
        )}

        {(stage === 'choose' || stage === 'parsing') && (
          <div
            {...getRootProps()}
            className={cn(
              'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors',
              isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
              stage === 'parsing' ? 'cursor-wait opacity-70' : 'cursor-pointer hover:border-primary/50',
            )}
            data-testid="archive-dropzone"
          >
            <input {...getInputProps()} data-testid="archive-file-input" />
            {stage === 'parsing' ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Reading {fileName}…</p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="font-medium">Drop your archive here, or click to choose</p>
                  <p className="text-sm text-muted-foreground">
                    twitter-archive.zip, or a single tweets.js
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {stage === 'review' && parsed && (
          <div className="space-y-3" data-testid="archive-review">
            <div className="flex items-center gap-2 text-sm">
              <FileArchive className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">{fileName}</span>
            </div>

            <div className="rounded-lg border p-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tweets ready to import</span>
                <span className="font-semibold" data-testid="archive-ready-count">
                  {parsed.tweetRows.length.toLocaleString()}
                </span>
              </div>
              {dateRange && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date range</span>
                  <span>{dateRange}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Files read</span>
                <span className="text-right">{parsed.files.join(', ')}</span>
              </div>
              {skippedTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Skipped</span>
                  <span>
                    {skippedTotal.toLocaleString()}
                    {parsed.skipped.duplicate > 0 && ` (${parsed.skipped.duplicate} duplicate)`}
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Writes to both sections — this archive page and Resources → Top Tweets. Existing
              tweets are updated rather than duplicated, so importing again is safe.
            </p>
          </div>
        )}

        {stage === 'importing' && (
          <div className="space-y-3" data-testid="archive-importing">
            <Progress value={progress.total ? (progress.sent / progress.total) * 100 : 0} />
            <p className="text-sm text-muted-foreground text-center">
              Importing {progress.sent.toLocaleString()} of {progress.total.toLocaleString()}…
            </p>
          </div>
        )}

        {stage === 'done' && result && (
          <Alert data-testid="archive-upload-success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Imported {result.tweetsWritten.toLocaleString()} tweets into this page and{' '}
              {result.resourcesWritten.toLocaleString()} into Top Tweets.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {stage === 'review' && (
            <>
              <Button variant="outline" onClick={reset}>
                Choose a different file
              </Button>
              <Button onClick={runImport} data-testid="archive-import-confirm">
                Import {parsed?.tweetRows.length.toLocaleString()} tweets
              </Button>
            </>
          )}
          {stage === 'done' && <Button onClick={() => handleOpenChange(false)}>Done</Button>}
          {(stage === 'choose' || stage === 'parsing') && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TweetArchiveUploadDialog;
