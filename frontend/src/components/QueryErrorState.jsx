import { AlertCircle } from 'lucide-react';
import { getErrorMessage } from '../utils/api';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

export function QueryErrorState({
  error,
  title = 'Failed to load data',
  onRetry,
  className,
}) {
  return (
    <Card className={className ?? 'border-destructive/40'}>
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" aria-hidden />
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{getErrorMessage(error)}</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
