import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLocations } from '../api/locations';
import { useForecastDirectory } from '../api/forecastActuals';
import { ForecastAnalysisScope } from './forecast-analysis/ForecastAnalysisScope';
import {
  PRIMARY_TABS,
  primaryTabFromSearch,
  DEFAULT_PRIMARY_TAB,
} from './forecast-analysis/forecastAnalysisTabs';
import { StandardTemplatesSection } from './forecast-analysis/StandardTemplatesSection';
import { StandardVsForecastSection } from './forecast-analysis/StandardVsForecastSection';
import { ForecastActualsSection } from './forecast-analysis/ForecastActualsSection';
import { Button } from '../ui/button';
import { cn } from '../lib/utils';

const INITIAL_SVF_UI = {
  section: 'summary',
  page: 1,
  varianceTab: 'all',
  expandedKey: null,
};

const INITIAL_FVA_UI = {
  section: 'forecast',
  page: 1,
  varianceTab: 'all',
};

export function ForecastAnalysis() {
  const [searchParams, setSearchParams] = useSearchParams();
  const primaryTab = primaryTabFromSearch(searchParams);

  const { data: locData, isLoading: locLoading } = useLocations();
  const locations = locData?.locations ?? [];

  const [locationId, setLocationId] = useState('');
  const [staff, setStaff] = useState('all');
  const [client, setClient] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [svfUi, setSvfUi] = useState(INITIAL_SVF_UI);
  const [fvaUi, setFvaUi] = useState(INITIAL_FVA_UI);

  const { data: directory, isLoading: dirLoading } = useForecastDirectory(Boolean(locationId));

  const setPrimaryTab = (tab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === DEFAULT_PRIMARY_TAB) {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      return next;
    });
  };

  const onLocationChange = (id) => {
    setLocationId(id);
    setStaff('all');
    setClient('all');
    setDateFrom('');
    setDateTo('');
    setSvfUi(INITIAL_SVF_UI);
    setFvaUi(INITIAL_FVA_UI);
  };

  const resetPages = () => {
    setSvfUi((u) => ({ ...u, page: 1, expandedKey: null }));
    setFvaUi((u) => ({ ...u, page: 1 }));
  };

  const onDateFromChange = (value) => {
    setDateFrom(value);
    if (dateTo && value && dateTo < value) setDateTo(value);
    resetPages();
  };

  const onDateToChange = (value) => {
    setDateTo(value);
    resetPages();
  };

  const onStaffChange = (value) => {
    setStaff(value);
    setFvaUi((u) => ({ ...u, page: 1 }));
  };

  const onClientChange = (value) => {
    setClient(value);
    setSvfUi((u) => ({ ...u, page: 1, expandedKey: null }));
    setFvaUi((u) => ({ ...u, page: 1 }));
  };

  const activeTabMeta = PRIMARY_TABS.find((t) => t.id === primaryTab);
  const showStaff = primaryTab === 'forecast-vs-actuals';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Forecast analysis</h2>
        <p className="text-sm text-muted-foreground">
          Manage standard templates, compare standard to forecast, and forecast to actuals.
        </p>
      </div>

      <ForecastAnalysisScope
        locations={locations}
        locLoading={locLoading}
        locationId={locationId}
        onLocationChange={onLocationChange}
        staff={staff}
        onStaffChange={onStaffChange}
        client={client}
        onClientChange={onClientChange}
        dateFrom={dateFrom}
        onDateFromChange={onDateFromChange}
        dateTo={dateTo}
        onDateToChange={onDateToChange}
        showDateFilter={primaryTab !== 'templates'}
        directory={directory}
        dirLoading={dirLoading}
        showStaff={showStaff}
      />

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 border-b pb-2">
          {PRIMARY_TABS.map((t) => (
            <Button
              key={t.id}
              type="button"
              variant={primaryTab === t.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPrimaryTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        {activeTabMeta && (
          <p className={cn('text-sm text-muted-foreground')}>{activeTabMeta.description}</p>
        )}
      </div>

      {!locationId ? (
        <p className="text-sm text-muted-foreground">Select a location above to continue.</p>
      ) : (
        <>
          {primaryTab === 'templates' && (
            <StandardTemplatesSection
              locationId={locationId}
              client={client}
              directory={directory}
              dirLoading={dirLoading}
            />
          )}
          {primaryTab === 'standard-vs-forecast' && (
            <StandardVsForecastSection
              locationId={locationId}
              client={client}
              dateFrom={dateFrom}
              dateTo={dateTo}
              section={svfUi.section}
              onSectionChange={(section) => setSvfUi((u) => ({ ...u, section }))}
              page={svfUi.page}
              onPageChange={(page) => setSvfUi((u) => ({ ...u, page }))}
              varianceTab={svfUi.varianceTab}
              onVarianceTabChange={(varianceTab) => setSvfUi((u) => ({ ...u, varianceTab }))}
              expandedKey={svfUi.expandedKey}
              onExpandedKeyChange={(expandedKey) => setSvfUi((u) => ({ ...u, expandedKey }))}
            />
          )}
          {primaryTab === 'forecast-vs-actuals' && (
            <ForecastActualsSection
              locationId={locationId}
              staff={staff}
              client={client}
              dateFrom={dateFrom}
              dateTo={dateTo}
              directory={directory}
              section={fvaUi.section}
              onSectionChange={(section) => setFvaUi((u) => ({ ...u, section }))}
              page={fvaUi.page}
              onPageChange={(page) => setFvaUi((u) => ({ ...u, page }))}
              varianceTab={fvaUi.varianceTab}
              onVarianceTabChange={(varianceTab) => setFvaUi((u) => ({ ...u, varianceTab }))}
            />
          )}
        </>
      )}
    </div>
  );
}
