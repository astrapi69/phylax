import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ImageViewerProps {
  url: string;
  filename: string;
}

/**
 * Zoom state.
 *
 * - `'fit'`: image rendered via `max-width: 100%; max-height: 100%`
 *   so it scales down to the container, scales up to no more than
 *   its natural size. Container-adaptive.
 * - `number`: pixel-accurate scale factor, 1.0 = image's natural
 *   dimensions. Range `[MIN_SCALE, MAX_SCALE]`, clamped.
 *
 * `'fit'` is intentionally separate from `1.0`. A 3000x2000 scan
 * shrunk to fit a 800px-wide viewport is displayed at effective
 * scale ~0.27; an explicit `1.0` shows it at pixel-accurate size and
 * relies on scrollbars for pan. The user needs both.
 */
type ZoomState = 'fit' | number;

/** Minimum explicit zoom level - 25% of natural image size. */
const MIN_SCALE = 0.25;
/** Maximum explicit zoom level - 500% of natural image size. */
const MAX_SCALE = 5;
/** Multiplier applied per zoom-in step; 1/STEP per zoom-out. */
const ZOOM_STEP = 1.25;
/** Snap-in target when zooming up out of `'fit'` - pixel accurate. */
const ZOOM_IN_FROM_FIT = 1;
/** Snap-out target when zooming down out of `'fit'`. */
const ZOOM_OUT_FROM_FIT = 0.5;

function nextZoomIn(z: ZoomState): ZoomState {
  if (z === 'fit') return ZOOM_IN_FROM_FIT;
  const next = z * ZOOM_STEP;
  return next >= MAX_SCALE ? MAX_SCALE : next;
}

function nextZoomOut(z: ZoomState): ZoomState {
  if (z === 'fit') return ZOOM_OUT_FROM_FIT;
  const next = z / ZOOM_STEP;
  return next <= MIN_SCALE ? MIN_SCALE : next;
}

function isAtMax(z: ZoomState): boolean {
  return z !== 'fit' && z >= MAX_SCALE;
}

function isAtMin(z: ZoomState): boolean {
  return z !== 'fit' && z <= MIN_SCALE;
}

/**
 * Image viewer with explicit zoom controls, keyboard shortcuts, and
 * Ctrl+wheel zoom. Pan is delegated to the container's native
 * `overflow: auto` scrollbars (works with mouse drag, touch swipe,
 * keyboard arrows out of the box). Pinch gesture is deferred to a
 * future polish task; mobile users get the +/- buttons + scrollbars.
 *
 * Accessibility:
 * - Image carries the filename as `alt` (content image, not decorative).
 * - Zoom buttons have localized `aria-label`s and disabled states.
 * - Current zoom level is announced via `aria-live="polite"`.
 * - Container is `tabIndex={0}` so keyboard shortcuts fire only when
 *   the viewer holds focus; no global `window` listener is installed.
 */
export function ImageViewer({ url, filename }: ImageViewerProps) {
  const { t } = useTranslation('documents');
  const [zoom, setZoom] = useState<ZoomState>('fit');
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const zoomIn = useCallback(() => setZoom((z) => nextZoomIn(z)), []);
  const zoomOut = useCallback(() => setZoom((z) => nextZoomOut(z)), []);
  const reset = useCallback(() => setZoom('fit'), []);

  // Ctrl+wheel zoom. React's synthetic wheel listener is passive
  // since React 17, so `preventDefault` is a no-op there. A native
  // `{ passive: false }` listener is required to suppress the
  // default browser zoom behavior.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom((z) => (e.deltaY < 0 ? nextZoomIn(z) : nextZoomOut(z)));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomIn();
    } else if (e.key === '-') {
      e.preventDefault();
      zoomOut();
    } else if (e.key === '0') {
      e.preventDefault();
      reset();
    }
  };

  const zoomLabel = zoom === 'fit' ? t('viewer.image.fit') : `${Math.round(zoom * 100)}%`;

  const imgSizeProps =
    zoom === 'fit' || !natural
      ? undefined
      : { width: Math.round(natural.w * zoom), height: Math.round(natural.h * zoom) };

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-2 text-sm dark:border-gray-700 dark:bg-gray-800"
        data-testid="image-viewer-toolbar"
      >
        <button
          type="button"
          onClick={zoomOut}
          disabled={isAtMin(zoom)}
          aria-label={t('viewer.image.zoom-out')}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-900 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          data-testid="zoom-out-btn"
        >
          −
        </button>
        <button
          type="button"
          onClick={zoomIn}
          disabled={isAtMax(zoom)}
          aria-label={t('viewer.image.zoom-in')}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-900 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          data-testid="zoom-in-btn"
        >
          +
        </button>
        <button
          type="button"
          onClick={reset}
          aria-label={t('viewer.image.reset')}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          data-testid="zoom-reset-btn"
        >
          {t('viewer.image.reset')}
        </button>
        <span
          role="status"
          aria-live="polite"
          className="ml-auto text-gray-700 dark:text-gray-300"
          data-testid="zoom-level"
        >
          {zoomLabel}
        </span>
      </div>
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="flex h-[75vh] w-full items-center justify-center overflow-auto rounded-md border border-gray-200 bg-gray-100 focus:outline-2 focus:outline-blue-500 dark:border-gray-700 dark:bg-gray-800"
        data-testid="image-viewer"
      >
        <img
          src={url}
          alt={filename}
          onLoad={(e) =>
            setNatural({
              w: e.currentTarget.naturalWidth,
              h: e.currentTarget.naturalHeight,
            })
          }
          className={
            zoom === 'fit' ? 'max-h-full max-w-full object-contain' : 'max-h-none max-w-none'
          }
          data-testid="image-viewer-img"
          {...imgSizeProps}
        />
      </div>
    </div>
  );
}
