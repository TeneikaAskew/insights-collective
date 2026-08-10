// ABOUTME: Renders a PDF blob to a canvas with pdf.js so the preview paints in any
// ABOUTME: browser engine, including headless Chromium which ships no PDF plugin.
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { createLogger } from '@/utils/logger';
// The legacy build, deliberately: pdf.js 6's default build calls
// Map.prototype.getOrInsertComputed, which current Chromium (and any slightly
// older browser a grader may use) does not implement — the preview died with
// "getOrInsertComputed is not a function". The legacy bundle ships that polyfill.
import PdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

const logger = createLogger('pdfPreview');

type PdfjsModule = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfjsModule> | null = null;

// pdfjs is loaded on demand — it is a large dependency and a grader only pays for
// it when a PDF is actually previewed. workerSrc has to be assigned as the module
// settles, since pdfjs v4+ ships the worker as an .mjs that Vite must fingerprint.
const loadPdfjs = (): Promise<PdfjsModule> => {
  if (!pdfjsPromise) {
    pdfjsPromise = (import('pdfjs-dist/legacy/build/pdf.mjs') as Promise<PdfjsModule>)
      .then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = PdfWorker;
        return pdfjs;
      })
      .catch((e) => {
        pdfjsPromise = null;
        throw e;
      });
  }
  return pdfjsPromise;
};

interface PdfPreviewProps {
  /** The already-downloaded file bytes; the bucket is private, so no URL is used. */
  blob: Blob;
  filename: string;
}

export function PdfPreview({ blob, filename }: PdfPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    setPage(1);
  }, [blob]);

  useEffect(() => {
    let cancelled = false;
    let doc: any = null;

    const render = async () => {
      setRendering(true);
      setError(null);
      try {
        const pdfjs = await loadPdfjs();
        // Blob.arrayBuffer is missing on some engines' Blob polyfills (jsdom
        // among them), so fall back to reading the blob through Response.
        const buffer =
          typeof blob.arrayBuffer === 'function'
            ? await blob.arrayBuffer()
            : await new Response(blob).arrayBuffer();
        const data = new Uint8Array(buffer);
        // standardFontDataUrl is required, not optional: PDFs that reference the
        // base-14 fonts (Helvetica et al.) without embedding them render as blank
        // pages when pdf.js cannot fetch the substitutes. The files are served
        // from public/pdfjs/standard_fonts, copied from pdfjs-dist.
        doc = await pdfjs.getDocument({
          data,
          standardFontDataUrl: '/pdfjs/standard_fonts/',
        }).promise;
        if (cancelled) return;
        setPageCount(doc.numPages);
        const target = Math.min(Math.max(page, 1), doc.numPages);
        const pdfPage = await doc.getPage(target);
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;
        // Fit the page to the pane width so the whole page is legible without
        // horizontal scrolling, then paint at the device pixel ratio.
        const base = pdfPage.getViewport({ scale: 1 });
        const paneWidth = canvas.parentElement?.clientWidth || base.width;
        const scale = Math.min(paneWidth / base.width, 2);
        const viewport = pdfPage.getViewport({ scale });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        await pdfPage.render({ canvasContext: context, viewport, canvas }).promise;
      } catch (e: any) {
        if (cancelled) return;
        logger.error('PDF preview failed to render', e);
        setError(e?.message || 'This PDF could not be rendered.');
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    void render();
    return () => {
      cancelled = true;
      void doc?.destroy?.();
    };
  }, [blob, page]);

  if (error) {
    return (
      <p className="p-3 text-sm text-destructive">
        {filename} could not be rendered: {error} Use Download to open it locally.
      </p>
    );
  }

  return (
    <div className="space-y-2 p-2" data-testid="pdf-preview">
      <div className="max-h-[520px] overflow-auto rounded bg-background">
        <canvas
          ref={canvasRef}
          aria-label={`Preview of ${filename}`}
          role="img"
          className="mx-auto block"
        />
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || rendering}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount || rendering}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default PdfPreview;
