import axios from 'axios';
import { config } from '../../config/index.js';
import { getShiftCareCredentials } from '../../middlewares/auth.middleware.js';
import { getOrSet } from '../../utils/cache.js';
import { fetchAllShiftCarePages } from './shiftcarePager.js';
import { buildShiftCareKpis } from './shiftcareKpis.service.js';

const SHIFTCARE_LIST_CACHE_TTL = 300;
const SHIFTCARE_KPI_CACHE_TTL = 300;

/**
 * Create axios instance with basic auth for ShiftCare API
 * Authentication uses Account ID as username and API Key as password
 */
const createShiftCareClient = (credentials) => {
  return axios.create({
    baseURL: config.shiftcare.baseUrl,
    auth: {
      username: credentials.accountId,  // ShiftCare Account ID
      password: credentials.apiKey,     // ShiftCare API Key
    },
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    paramsSerializer: (params) => {
      const searchParams = new URLSearchParams();
      Object.keys(params).forEach((key) => {
        const value = params[key];
        if (Array.isArray(value)) {
          value.forEach((item) => {
            searchParams.append(`${key}[]`, item);
          });
        } else if (value !== undefined && value !== null) {
          searchParams.append(key, value);
        }
      });
      return searchParams.toString();
    },
  });
};

function serializeCacheParams(params) {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
}

async function fetchFromShiftCare(credentials, endpoint, params) {
  const client = createShiftCareClient(credentials);
  const response = await client.get(endpoint, { params });

  if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE')) {
    const err = new Error('Invalid response from ShiftCare API. Please check API credentials and URL.');
    err.isShiftcareHtml = true;
    throw err;
  }

  return response.data;
}

function sendShiftcareError(res, error) {
  if (error.isShiftcareHtml) {
    console.error('ShiftCare API returned HTML instead of JSON - check URL and credentials');
    return res.status(502).json({
      error: error.message,
    });
  }

  const shiftcareStatus = error.response?.status;
  const shiftcareError = error.response?.data?.error || error.message || 'Failed to fetch data from ShiftCare API';

  console.error('ShiftCare API Error:', shiftcareStatus, shiftcareError);

  return res.status(502).json({
    error: shiftcareError,
    shiftcareApiError: true,
    originalStatus: shiftcareStatus,
  });
}

/**
 * Proxy request to ShiftCare API
 */
const proxyRequest = async (req, res, endpoint, params = {}) => {
  try {
    const credentials = getShiftCareCredentials(req);

    if (!credentials) {
      return res.status(401).json({
        error: 'ShiftCare API credentials not configured',
      });
    }

    const data = await fetchFromShiftCare(credentials, endpoint, params);
    res.json(data);
  } catch (error) {
    sendShiftcareError(res, error);
  }
};

/**
 * Cached proxy for list endpoints (staff, clients) — tenant-scoped Redis TTL.
 */
const cachedProxyRequest = async (req, res, endpoint, params, resourceType) => {
  try {
    const credentials = getShiftCareCredentials(req);

    if (!credentials) {
      return res.status(401).json({
        error: 'ShiftCare API credentials not configured',
      });
    }

    const cacheKey = `shiftcare:${resourceType}:${credentials.accountId}:${serializeCacheParams(params)}`;
    const data = await getOrSet(cacheKey, SHIFTCARE_LIST_CACHE_TTL, () =>
      fetchFromShiftCare(credentials, endpoint, params)
    );
    res.json(data);
  } catch (error) {
    sendShiftcareError(res, error);
  }
};

export const getShifts = async (req, res) => {
  const {
    from_date,
    to_date,
    status,
    ndis_enabled,
    include_clients,
    include_metadata,
    approved_from_date,
    approved_to_date,
    billable,
    page,
    per_page,
    ids,
  } = req.query;

  const params = {
    ...(from_date && { from_date }),
    ...(to_date && { to_date }),
    ...(status && { status }),
    ...(ndis_enabled !== undefined && { ndis_enabled: String(ndis_enabled) }),
    ...(include_clients !== undefined && { include_clients: String(include_clients) }),
    ...(include_metadata !== undefined && { include_metadata: String(include_metadata) }),
    ...(approved_from_date && { approved_from_date }),
    ...(approved_to_date && { approved_to_date }),
    ...(billable !== undefined && { billable: String(billable) }),
    ...(page && { page }),
    ...(per_page && { per_page }),
  };

  // Handle array parameters
  if (ids) {
    params.ids = Array.isArray(ids) ? ids : [ids];
  }

  await proxyRequest(req, res, '/v3/shifts', params);
};

export const getStaff = async (req, res) => {
  const {
    filter_by_name,
    filter_by_email,
    filter_by_external_id,
    filter_by_organization_id,
    include_dummy,
    include_metadata,
    include_external_ids,
    sort_by,
    sort_type,
    page,
    per_page,
  } = req.query;

  const params = {
    ...(filter_by_name && { filter_by_name }),
    ...(filter_by_email && { filter_by_email }),
    ...(filter_by_external_id && { filter_by_external_id }),
    ...(filter_by_organization_id && { filter_by_organization_id }),
    ...(include_dummy !== undefined && { include_dummy: String(include_dummy) }),
    ...(include_metadata !== undefined && { include_metadata: String(include_metadata) }),
    ...(include_external_ids !== undefined && { include_external_ids: String(include_external_ids) }),
    ...(sort_by && { sort_by }),
    ...(sort_type && { sort_type }),
    ...(page && { page }),
    ...(per_page && { per_page }),
  };

  await cachedProxyRequest(req, res, '/v3/staff', params, 'staff');
};

export const getClients = async (req, res) => {
  const {
    filter_by_name,
    include_metadata,
    include_external_ids,
    sort_by,
    sort_type,
    page,
    per_page,
  } = req.query;

  const params = {
    ...(filter_by_name && { filter_by_name }),
    ...(include_metadata !== undefined && { include_metadata: String(include_metadata) }),
    ...(include_external_ids !== undefined && { include_external_ids: String(include_external_ids) }),
    ...(sort_by && { sort_by }),
    ...(sort_type && { sort_type }),
    ...(page && { page }),
    ...(per_page && { per_page }),
  };

  await cachedProxyRequest(req, res, '/v3/clients', params, 'clients');
};

export const getTimesheets = async (req, res) => {
  const {
    from,
    to,
    approved_only,
    include_metadata,
    include_staff,
    include_payable_external_ids,
    page,
    per_page,
  } = req.query;

  // from and to are required parameters
  if (!from || !to) {
    return res.status(400).json({
      error: 'Both "from" and "to" date parameters are required',
    });
  }

  const params = {
    from,
    to,
    ...(approved_only !== undefined && { approved_only: String(approved_only) }),
    ...(include_metadata !== undefined && { include_metadata: String(include_metadata) }),
    ...(include_staff !== undefined && { include_staff: String(include_staff) }),
    ...(include_payable_external_ids !== undefined && { include_payable_external_ids: String(include_payable_external_ids) }),
    ...(page && { page }),
    ...(per_page && { per_page }),
  };

  await proxyRequest(req, res, '/v3/timesheets', params);
};

export const getKpis = async (req, res) => {
  try {
    const credentials = getShiftCareCredentials(req);
    if (!credentials) {
      return res.status(401).json({ error: 'ShiftCare API credentials not configured' });
    }

    const { from, to, time_zone = 'Australia/Brisbane' } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: 'Both "from" and "to" date parameters are required' });
    }

    const cacheKey = `shiftcare:kpis:${credentials.accountId}:${from}:${to}:${time_zone}`;
    const data = await getOrSet(cacheKey, SHIFTCARE_KPI_CACHE_TTL, async () => {
      const [timesheets, shifts] = await Promise.all([
        fetchAllShiftCarePages(
          credentials,
          '/v3/timesheets',
          {
            from,
            to,
            include_staff: true,
            include_payable_external_ids: true,
            time_zone,
          },
          'timesheets'
        ),
        fetchAllShiftCarePages(
          credentials,
          '/v3/shifts',
          {
            from_date: from.slice(0, 10),
            to_date: to.slice(0, 10),
            include_staff: true,
            include_clients: true,
            time_zone,
          },
          'shifts'
        ),
      ]);
      return buildShiftCareKpis(timesheets, shifts);
    });

    res.json(data);
  } catch (error) {
    sendShiftcareError(res, error);
  }
};

export const getProgressNotes = async (req, res) => {
  const {
    shift_id,
    staff_id,
    client_id,
    category,
    created_from,
    created_to,
    shift_date_from,
    shift_date_to,
    include_metadata,
    sort_by,
    sort_type,
    time_zone,
    page,
    per_page,
  } = req.query;

  const params = {
    ...(shift_id && { shift_id }),
    ...(staff_id && { staff_id }),
    ...(client_id && { client_id }),
    ...(created_from && { created_from }),
    ...(created_to && { created_to }),
    ...(shift_date_from && { shift_date_from }),
    ...(shift_date_to && { shift_date_to }),
    ...(include_metadata !== undefined && { include_metadata: String(include_metadata) }),
    ...(sort_by && { sort_by }),
    ...(sort_type && { sort_type }),
    ...(time_zone && { time_zone }),
    ...(page && { page }),
    ...(per_page && { per_page }),
  };

  if (category) {
    params.category = Array.isArray(category) ? category : [category];
  }

  await proxyRequest(req, res, '/v3/progress_notes', params);
};

export const getClientFunds = async (req, res) => {
  const { clientId } = req.params;
  const { include_metadata, page, per_page } = req.query;
  await proxyRequest(req, res, `/v3/clients/${clientId}/funds`, {
    ...(include_metadata !== undefined && { include_metadata: String(include_metadata) }),
    ...(page && { page }),
    ...(per_page && { per_page }),
  });
};

export const getClientFundBalance = async (req, res) => {
  const { clientId, fundId } = req.params;
  await proxyRequest(req, res, `/v3/clients/${clientId}/funds/${fundId}/current_balance`);
};

export const getInvoices = async (req, res) => {
  const {
    from_date,
    to_date,
    status,
    client_id,
    include_client,
    include_external_references,
    include_metadata,
    page,
    per_page,
    time_zone,
  } = req.query;

  await proxyRequest(req, res, '/v3/invoices', {
    ...(from_date && { from_date }),
    ...(to_date && { to_date }),
    ...(status && { status }),
    ...(client_id && { client_id }),
    ...(include_client !== undefined && { include_client: String(include_client) }),
    ...(include_external_references !== undefined && {
      include_external_references: String(include_external_references),
    }),
    ...(include_metadata !== undefined && { include_metadata: String(include_metadata) }),
    ...(page && { page }),
    ...(per_page && { per_page }),
    ...(time_zone && { time_zone }),
  });
};

export const getInvoice = async (req, res) => {
  const { id } = req.params;
  const { include_client, include_external_references, time_zone } = req.query;
  await proxyRequest(req, res, `/v3/invoices/${id}`, {
    ...(include_client !== undefined && { include_client: String(include_client) }),
    ...(include_external_references !== undefined && {
      include_external_references: String(include_external_references),
    }),
    ...(time_zone && { time_zone }),
  });
};

export const getLeaves = async (req, res) => {
  const { from_date, to_date, user_id, include_metadata, page, per_page, time_zone } = req.query;
  await proxyRequest(req, res, '/v3/leaves', {
    ...(from_date && { from_date }),
    ...(to_date && { to_date }),
    ...(user_id && { user_id }),
    ...(include_metadata !== undefined && { include_metadata: String(include_metadata) }),
    ...(page && { page }),
    ...(per_page && { per_page }),
    ...(time_zone && { time_zone }),
  });
};

export const getStaffQualifications = async (req, res) => {
  const { staffId } = req.params;
  await proxyRequest(req, res, `/v3/staffs/${staffId}/qualifications`);
};

export const getStaffFiles = async (req, res) => {
  const { user_id, include_metadata, page, per_page } = req.query;
  await proxyRequest(req, res, '/v3/staff_files', {
    ...(user_id && { user_id }),
    ...(include_metadata !== undefined && { include_metadata: String(include_metadata) }),
    ...(page && { page }),
    ...(per_page && { per_page }),
  });
};

export const getQualifications = async (req, res) => {
  await proxyRequest(req, res, '/v3/qualifications');
};

export const getQualificationCategories = async (req, res) => {
  const { include_metadata, page, per_page } = req.query;
  await proxyRequest(req, res, '/v3/qualification_categories', {
    ...(include_metadata !== undefined && { include_metadata: String(include_metadata) }),
    ...(page && { page }),
    ...(per_page && { per_page }),
  });
};

export const getWebhookSubscriptions = async (req, res) => {
  const { include_metadata, page, per_page } = req.query;
  await proxyRequest(req, res, '/v3/webhooks/subscriptions', {
    ...(include_metadata !== undefined && { include_metadata: String(include_metadata) }),
    ...(page && { page }),
    ...(per_page && { per_page }),
  });
};

export const getWebhookEventTypes = async (req, res) => {
  await proxyRequest(req, res, '/v3/webhooks/event_types');
};

/** Aggregate funds + balances for all clients (cached). */
export const getFundsDashboard = async (req, res) => {
  try {
    const credentials = getShiftCareCredentials(req);
    if (!credentials) {
      return res.status(401).json({ error: 'ShiftCare API credentials not configured' });
    }

    const cacheKey = `shiftcare:funds-dashboard:${credentials.accountId}`;
    const data = await getOrSet(cacheKey, SHIFTCARE_LIST_CACHE_TTL, async () => {
      const clients = await fetchAllShiftCarePages(
        credentials,
        '/v3/clients',
        { sort_by: 'name', sort_type: 'asc' },
        'clients'
      );

      const rows = [];
      for (const client of clients.slice(0, 60)) {
        try {
          const funds = await fetchFromShiftCare(credentials, `/v3/clients/${client.id}/funds`, {
            include_metadata: true,
          });
          const fundList = funds.funds || [];
          for (const fund of fundList) {
            let balance = null;
            try {
              balance = await fetchFromShiftCare(
                credentials,
                `/v3/clients/${client.id}/funds/${fund.id}/current_balance`
              );
            } catch {
              /* skip balance errors per fund */
            }
            rows.push({
              clientId: client.id,
              clientName: client.display_name || client.first_name,
              fundId: fund.id,
              fundName: fund.name,
              amount: fund.amount,
              hours: fund.hours,
              expiresAt: fund.expires_at,
              balanceAmount: balance?.balance_amount ?? null,
              balanceHours: balance?.balance_hours ?? null,
            });
          }
        } catch {
          /* skip clients without fund access */
        }
      }

      return {
        clients: rows,
        generatedAt: new Date().toISOString(),
      };
    });

    res.json(data);
  } catch (error) {
    sendShiftcareError(res, error);
  }
};

/** Compliance snapshot: expiring qualifications + upcoming leave. */
export const getComplianceDashboard = async (req, res) => {
  try {
    const credentials = getShiftCareCredentials(req);
    if (!credentials) {
      return res.status(401).json({ error: 'ShiftCare API credentials not configured' });
    }

    const { from_date, to_date } = req.query;
    const cacheKey = `shiftcare:compliance:${credentials.accountId}:${from_date || 'all'}:${to_date || 'all'}`;
    const data = await getOrSet(cacheKey, SHIFTCARE_LIST_CACHE_TTL, async () => {
      const staff = await fetchAllShiftCarePages(
        credentials,
        '/v3/staff',
        { sort_by: 'name', sort_type: 'asc' },
        'staff'
      );

      const expiringQualifications = [];
      const now = Date.now();
      const in30Days = now + 30 * 86400000;

      for (const member of staff.slice(0, 80)) {
        try {
          const quals = await fetchFromShiftCare(
            credentials,
            `/v3/staffs/${member.id}/qualifications`
          );
          for (const q of quals || []) {
            if (!q.expires_at) continue;
            const exp = new Date(q.expires_at).getTime();
            if (exp <= in30Days) {
              expiringQualifications.push({
                staffId: member.id,
                staffName: member.name || member.first_name,
                qualificationId: q.qualification_id,
                expiresAt: q.expires_at,
                expired: exp < now,
              });
            }
          }
        } catch {
          /* skip */
        }
      }

      let leaves = [];
      try {
        leaves = await fetchAllShiftCarePages(
          credentials,
          '/v3/leaves',
          {
            ...(from_date && { from_date }),
            ...(to_date && { to_date }),
          },
          'leaves'
        );
      } catch {
        /* leave endpoint may fail for some accounts */
      }

      return {
        expiringQualifications: expiringQualifications.sort(
          (a, b) => new Date(a.expiresAt) - new Date(b.expiresAt)
        ),
        leaves: leaves.slice(0, 200),
        generatedAt: new Date().toISOString(),
      };
    });

    res.json(data);
  } catch (error) {
    sendShiftcareError(res, error);
  }
};
