import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Hosts the sandboxed module iframe. Passes source via postMessage; listens
 * for ready/error/resize events. The frame URL is a dedicated Vite entry so
 * the sandbox bundle is independent of the main app.
 */
export function ModuleFrameHost({ slug, version, source }) {
  const iframeRef = useRef(null);
  const [frameReady, setFrameReady] = useState(false);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [height, setHeight] = useState(720);

  // New source or new frame → reset
  useEffect(() => {
    setFrameReady(false);
    setStatus('loading');
    setError('');
  }, [source, version]);

  // Listen for messages from the frame
  useEffect(() => {
    function onMessage(event) {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (event.source !== iframeRef.current?.contentWindow) return;

      switch (data.type) {
        case 'kc:frame-ready':
          // Frame may (re)announce before/after we have source; reply with
          // source whenever we have it so no handshake is ever missed.
          if (source && event.source === iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              { type: 'kc:load', source },
              window.location.origin
            );
          }
          setFrameReady(true);
          break;
        case 'kc:ready':
          setStatus('ready');
          break;
        case 'kc:error':
          setStatus('error');
          setError(String(data.error || 'Unknown error'));
          break;
        case 'kc:resize':
          if (typeof data.height === 'number' && data.height > 100) {
            setHeight(Math.min(data.height + 32, 4000));
          }
          break;
        default:
          break;
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Once frame is ready (and on source change), send the source in
  useEffect(() => {
    if (!frameReady || !source) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'kc:load', source },
      window.location.origin
    );
  }, [frameReady, source]);

  const frameUrl = `${import.meta.env.BASE_URL}module-frame.html?v=${version}`;

  // Inject the host app's stylesheets into the iframe so uploaded modules
  // (typically Tailwind-styled, e.g. Claude-generated) render correctly.
  // The iframe is allow-same-origin, so we can write into it once loaded.
  const syncStyles = () => {
    try {
      const iframeDoc = iframeRef.current?.contentDocument;
      if (!iframeDoc) return;
      const iframeHead = iframeDoc.head;
      // Avoid duplicating on re-fires
      if (iframeHead.querySelector('[data-host-styles]')) return;
      document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
        iframeHead.appendChild(node.cloneNode(true));
      });
      const marker = iframeDoc.createElement('meta');
      marker.setAttribute('data-host-styles', '1');
      iframeHead.appendChild(marker);
    } catch {
      /* cross-origin guard — should not happen with allow-same-origin */
    }
  };

  return (
    <div className="relative">
      {status === 'loading' && (
        <div className="absolute inset-x-0 top-24 z-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading module…
        </div>
      )}

      {status === 'error' && (
        <div className="mx-auto mb-4 flex max-w-3xl items-start gap-3 rounded-lg border border-destructive/30 bg-red-50 p-4 dark:bg-red-500/10">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-destructive">Module crashed</div>
            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">
              {error}
            </pre>
          </div>
        </div>
      )}

      <iframe
        ref={iframeRef}
        key={`${slug}-v${version}`}
        title={slug}
        src={frameUrl}
        onLoad={() => {
          syncStyles();
        }}
        style={{ height: `${height}px` }}
        className="w-full rounded-xl border bg-white transition-[height] duration-200"
        sandbox="allow-scripts allow-forms allow-modals allow-downloads allow-popups allow-same-origin"
      />
    </div>
  );
}
