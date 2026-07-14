import { ErrorBoundary } from 'react-error-boundary';
import { Button } from '../ui/button';

function RouteErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {error?.message || 'An unexpected error occurred while rendering this page.'}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={resetErrorBoundary}>
          Try again
        </Button>
        <Button onClick={() => window.location.assign('/')}>Go to dashboard</Button>
      </div>
    </div>
  );
}

export function AppErrorBoundary({ children }) {
  return (
    <ErrorBoundary
      FallbackComponent={RouteErrorFallback}
      onReset={() => {
        window.location.reload();
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
