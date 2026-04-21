import mongoose from 'mongoose';
import fs from 'fs';
import { getShiftCareCredentials } from '../../middlewares/auth.middleware.js';
import { Location } from '../locations/location.model.js';
import {
  exportActualsCsv,
  exportForecastCsv,
  exportSummaryCsv,
  exportSummaryPdf,
  exportVarianceCsv,
  getDirectoryOptions,
  getSummary,
  getVarianceDetail,
  listActuals,
  listForecast,
  listVariance,
  uploadActualsFromCsv,
  uploadForecastFromCsv,
} from './forecastActuals.service.js';

const financeRoles = ['super_admin', 'finance'];

function requireShiftCare(req, res) {
  const credentials = getShiftCareCredentials(req);
  if (!credentials?.accountId || !credentials?.apiKey) {
    res.status(401).json({
      error: 'ShiftCare API credentials not configured. Set SHIFTCARE_ACCOUNT_ID and SHIFTCARE_API_KEY.',
    });
    return null;
  }
  return credentials;
}

async function resolveLocation(locationId) {
  if (!locationId || !mongoose.Types.ObjectId.isValid(locationId)) {
    return { error: 'Invalid or missing locationId', status: 400 };
  }
  const loc = await Location.findById(locationId).lean();
  if (!loc) return { error: 'Location not found', status: 404 };
  return { location: loc };
}

export const getDirectory = async (req, res, next) => {
  try {
    const credentials = requireShiftCare(req, res);
    if (!credentials) return;

    const data = await getDirectoryOptions(credentials);
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const postForecastUpload = async (req, res, next) => {
  try {
    const credentials = requireShiftCare(req, res);
    if (!credentials) return;

    const { locationId } = req.body;
    const { error, status, location } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ success: false, errors: [error] });

    if (!req.file) {
      return res.status(400).json({ success: false, errors: ['No file uploaded'] });
    }

    const buffer = fs.readFileSync(req.file.path);
    try {
      fs.unlinkSync(req.file.path);
    } catch {}

    const result = await uploadForecastFromCsv({
      locationId,
      fileBuffer: buffer,
      credentials,
      uploadedBy: req.user?.userId || null,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const postActualsUpload = async (req, res, next) => {
  try {
    const credentials = requireShiftCare(req, res);
    if (!credentials) return;

    const { locationId } = req.body;
    const { error, status } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ success: false, errors: [error] });

    if (!req.file) {
      return res.status(400).json({ success: false, errors: ['No file uploaded'] });
    }

    const buffer = fs.readFileSync(req.file.path);
    try {
      fs.unlinkSync(req.file.path);
    } catch {}

    const result = await uploadActualsFromCsv({
      locationId,
      fileBuffer: buffer,
      credentials,
      uploadedBy: req.user?.userId || null,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const getForecastList = async (req, res, next) => {
  try {
    const { locationId, staff = 'all', client = 'all', page = 1 } = req.query;
    const { error, status } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ error });

    const data = await listForecast({ locationId, staffId: staff, clientId: client, page });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const getActualsList = async (req, res, next) => {
  try {
    const { locationId, staff = 'all', client = 'all', page = 1 } = req.query;
    const { error, status } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ error });

    const data = await listActuals({ locationId, staffId: staff, clientId: client, page });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const getSummaryHandler = async (req, res, next) => {
  try {
    const credentials = requireShiftCare(req, res);
    if (!credentials) return;

    const { locationId, staff = 'all', client = 'all' } = req.query;
    const { error, status } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ error });

    const data = await getSummary({
      locationId,
      staffId: staff,
      clientId: client,
      credentials,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const getForecastExport = async (req, res, next) => {
  try {
    const { locationId, staff = 'all', client = 'all' } = req.query;
    const { error, status, location } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ error });

    const { filename, body } = await exportForecastCsv({
      locationId,
      staffId: staff,
      clientId: client,
      timezone: location.timezone,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  } catch (e) {
    next(e);
  }
};

export const getActualsExport = async (req, res, next) => {
  try {
    const { locationId, staff = 'all', client = 'all' } = req.query;
    const { error, status, location } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ error });

    const { filename, body } = await exportActualsCsv({
      locationId,
      staffId: staff,
      clientId: client,
      timezone: location.timezone,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  } catch (e) {
    next(e);
  }
};

export const getSummaryExportCsv = async (req, res, next) => {
  try {
    const credentials = requireShiftCare(req, res);
    if (!credentials) return;

    const { locationId, staff = 'all', client = 'all' } = req.query;
    const { error, status } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ error });

    const { filename, body } = await exportSummaryCsv({
      locationId,
      staffId: staff,
      clientId: client,
      credentials,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  } catch (e) {
    next(e);
  }
};

export const getSummaryExportPdf = async (req, res, next) => {
  try {
    const credentials = requireShiftCare(req, res);
    if (!credentials) return;

    const { locationId, staff = 'all', client = 'all' } = req.query;
    const { error, status } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ error });

    const { filename, body } = await exportSummaryPdf({
      locationId,
      staffId: staff,
      clientId: client,
      credentials,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  } catch (e) {
    next(e);
  }
};

export const getVarianceList = async (req, res, next) => {
  try {
    const { locationId, tab = 'all', staff = 'all', client = 'all', page = 1 } = req.query;
    const { error, status } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ error });

    const data = await listVariance({
      locationId,
      tab,
      staffId: staff,
      clientId: client,
      page,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const getVarianceExport = async (req, res, next) => {
  try {
    const { locationId, staff = 'all', client = 'all' } = req.query;
    const { error, status, location } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ error });

    const { filename, body } = await exportVarianceCsv({
      locationId,
      staffId: staff,
      clientId: client,
      timezone: location.timezone,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  } catch (e) {
    next(e);
  }
};

export const getVarianceDetailHandler = async (req, res, next) => {
  try {
    const { locationId } = req.query;
    const { shiftcareId } = req.params;
    const { error, status } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ error });

    if (!shiftcareId) {
      return res.status(400).json({ error: 'shiftcareId required' });
    }

    const data = await getVarianceDetail({ locationId, shiftcareId });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export { financeRoles };
