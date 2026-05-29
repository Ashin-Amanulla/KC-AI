import { Download } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../lib/utils';

export function TabularExportButtons({ onExportCsv, onExportXlsx, size = 'sm', className }) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <Button type="button" variant="outline" size={size} onClick={onExportCsv}>
        <Download className="mr-2 h-4 w-4" />
        Export CSV
      </Button>
      <Button type="button" variant="outline" size={size} onClick={onExportXlsx}>
        <Download className="mr-2 h-4 w-4" />
        Export Excel
      </Button>
    </div>
  );
}
