import axios from 'axios';
import { config } from '../../config/index.js';
import { getShiftCareCredentials } from '../../middlewares/auth.middleware.js';

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

    const client = createShiftCareClient(credentials);
    const fullUrl = `${config.shiftcare.baseUrl}${endpoint}`;

    const response = await client.get(endpoint, { params });

    // Check if response is HTML (indicates wrong URL or auth issue)
    if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE')) {
      console.error('ShiftCare API returned HTML instead of JSON - check URL and credentials');
      return res.status(502).json({
        error: 'Invalid response from ShiftCare API. Please check API credentials and URL.',
      });
    }

    res.json(response.data);
  } catch (error) {
    const shiftcareStatus = error.response?.status;
    const shiftcareError = error.response?.data?.error || error.message || 'Failed to fetch data from ShiftCare API';

    console.error('ShiftCare API Error:', shiftcareStatus, shiftcareError);

    // Return 502 Bad Gateway for ShiftCare API errors to prevent frontend from clearing JWT token
    // Include original status in response for debugging
    res.status(502).json({
      error: shiftcareError,
      shiftcareApiError: true,
      originalStatus: shiftcareStatus,
    });
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

  await proxyRequest(req, res, '/v3/staff', params);
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

  await proxyRequest(req, res, '/v3/clients', params);
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
