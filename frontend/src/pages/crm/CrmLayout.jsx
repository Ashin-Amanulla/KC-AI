import { Outlet } from 'react-router-dom';
import { InfoHint } from '../../components/InfoHint';
import { TabNav, TabNavLink } from '../../ui/tabs';
import { nativeSelectClass } from '../../ui/select';
import { CrmBdmProvider, useCrmBdm } from './CrmBdmContext';

const LINKS = [
  { to: '/crm', end: true, label: 'Dashboard' },
  { to: '/crm/support-coordinators', label: 'Coordinators' },
  { to: '/crm/leads', label: 'Leads' },
  { to: '/crm/marketing', label: 'Marketing' },
  { to: '/crm/import-export', label: 'Import' },
];

function CrmBdmSelector() {
  const { canViewAll, bdmOwnerId, setBdmOwnerId, bdmOwners } = useCrmBdm();
  if (!canViewAll) return null;

  return (
    <div className="filter-toolbar ml-auto shrink-0 py-1">
      <label htmlFor="crm-bdm-select" className="text-2xs text-muted-foreground">
        BDM
      </label>
      <select
        id="crm-bdm-select"
        value={bdmOwnerId}
        onChange={(e) => setBdmOwnerId(e.target.value)}
        className={`${nativeSelectClass} filter-control h-8 min-w-[8rem] text-xs`}
      >
        <option value="all">All BDMs</option>
        <option value="unassigned">Unassigned</option>
        {bdmOwners.map((owner) => (
          <option key={owner.id} value={owner.id}>
            {owner.name || owner.email || owner.id}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CrmLayout() {
  return (
    <CrmBdmProvider>
      <div className="page-stack-tight">
        <div className="flex flex-wrap items-center gap-2">
          <InfoHint
            content="BDM tracker — support coordinators, leads, marketing activities, and staffing requirements."
            label="About CRM"
            variant="help"
          />
          <span className="text-2xs text-muted-foreground">Growth · BDM pipeline</span>
          <CrmBdmSelector />
        </div>
        <TabNav>
          {LINKS.map(({ to, end, label }) => (
            <TabNavLink key={to} to={to} end={end} className="px-2.5 py-1 text-xs">
              {label}
            </TabNavLink>
          ))}
        </TabNav>
        <Outlet />
      </div>
    </CrmBdmProvider>
  );
}
