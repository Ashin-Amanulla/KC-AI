import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { LoadingScreen } from '../../ui/LoadingSpinner';

export function ForecastAnalysisScope({
  locations,
  locLoading,
  locationId,
  onLocationChange,
  staff,
  onStaffChange,
  client,
  onClientChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  directory,
  dirLoading,
  showStaff = true,
  showDateFilter = true,
}) {
  const staffOptions = directory?.staff || [{ value: 'all', label: 'All Staff' }];
  const clientOptions = directory?.clients || [{ value: 'all', label: 'All Clients' }];

  return (
    <Card className="sticky top-0 z-10 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Scope</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
        <div className="space-y-1">
          <label className="text-sm font-medium">Location</label>
          {locLoading ? (
            <LoadingScreen message="Loading locations…" />
          ) : (
            <select
              className="flex h-10 w-full md:w-64 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={locationId}
              onChange={(e) => onLocationChange(e.target.value)}
            >
              <option value="">Select location…</option>
              {locations.map((loc) => (
                <option key={loc._id || loc.id} value={loc._id || loc.id}>
                  {loc.name} ({loc.code})
                </option>
              ))}
            </select>
          )}
        </div>
        {showStaff && (
          <div className="space-y-1">
            <label className="text-sm font-medium">Staff</label>
            <select
              className="flex h-10 w-full md:w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={staff}
              onChange={(e) => onStaffChange(e.target.value)}
              disabled={!locationId || dirLoading}
            >
              {staffOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-sm font-medium">Client</label>
          <select
            className="flex h-10 w-full md:w-56 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={client}
            onChange={(e) => onClientChange(e.target.value)}
            disabled={!locationId || dirLoading}
          >
            {clientOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {showDateFilter && (
          <>
            <div className="space-y-1">
              <label className="text-sm font-medium">From date</label>
              <input
                type="date"
                className="flex h-10 w-full md:w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                disabled={!locationId}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">To date</label>
              <input
                type="date"
                className="flex h-10 w-full md:w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                disabled={!locationId}
                min={dateFrom || undefined}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
