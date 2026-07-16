import { Card, CardContent, CardHeader } from '../../ui/card';
import { LoadingScreen } from '../../ui/LoadingSpinner';
import { CardTitleHint, FieldLabel } from '../../components/InfoHint';
import { nativeSelectClass } from '../../ui/select';

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
    <Card className="sticky top-0 z-10 shadow-xs dark:shadow-none">
      <CardHeader className="border-b py-2.5">
        <CardTitleHint
          titleClassName="text-sm"
          hint="Filters apply to all tabs below. Pick a location first — staff and client lists load from that site."
        >
          Scope
        </CardTitleHint>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 py-3 md:flex-row md:flex-wrap md:items-end">
        <div className="space-y-1">
          <FieldLabel hint="All analysis is location-scoped.">Location</FieldLabel>
          {locLoading ? (
            <LoadingScreen message="Loading locations…" />
          ) : (
            <select
              className={`${nativeSelectClass} md:w-56`}
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
            <FieldLabel>Staff</FieldLabel>
            <select
              className={`${nativeSelectClass} md:w-48`}
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
          <FieldLabel>Client</FieldLabel>
          <select
            className={`${nativeSelectClass} md:w-48`}
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
              <FieldLabel>From</FieldLabel>
              <input
                type="date"
                className={nativeSelectClass}
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                disabled={!locationId}
              />
            </div>
            <div className="space-y-1">
              <FieldLabel>To</FieldLabel>
              <input
                type="date"
                className={nativeSelectClass}
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                disabled={!locationId}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
