import mongoose from 'mongoose';
import fs from 'fs';
import { getShiftCareCredentials } from '../../middlewares/auth.middleware.js';
import { Location } from '../locations/location.model.js';
import {
  exportStandardForecastCsv,
  exportStandardVsForecastCsv,
  exportStandardVsForecastPdf,
  getDirectoryOptions,
  getStandardVsForecastSummary,
  getStandardVsForecastVarianceDetail,
  listStandardVsForecastVariance,
  createStandardForecastRecord,
  deleteStandardForecastRecord,
  listStandardForecast,
  updateStandardForecastRecord,
  uploadStandardForecastFromCsv,
} from './standardForecast.service.js';

const financeRoles = ['super_admin', 'finance'];

function resolveClientFilter(query) {
  const { clientId, client } = query;
  return clientId ?? client ?? 'all';
}

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

export const postStandardUpload = async (req, res, next) => {
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

    const result = await uploadStandardForecastFromCsv({
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

export const postStandardCreate = async (req, res, next) => {
  try {
    const credentials = requireShiftCare(req, res);
    if (!credentials) return;

    const {
      locationId,
      clientDirectoryId,
      day,
      startTime,
      endTime,
      duration,
      totalCost,
      rateGroups,
      referenceNo,
      shiftType,
      ratio,
    } = req.body;

    const { error, status } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ success: false, errors: [error] });

    const result = await createStandardForecastRecord({
      locationId,
      clientDirectoryId,
      day,
      startTime,
      endTime,
      duration,
      totalCost,
      rateGroups,
      referenceNo,
      shiftType,
      ratio,
      credentials,
      uploadedBy: req.user?.userId || null,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
};

export const putStandardUpdate = async (req, res, next) => {
  try {
    const credentials = requireShiftCare(req, res);
    if (!credentials) return;

    const {
      locationId,
      clientDirectoryId,
      day,
      startTime,
      endTime,
      duration,
      totalCost,
      rateGroups,
      referenceNo,
      shiftType,
      ratio,
    } = req.body;

    const { error, status } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ success: false, errors: [error] });

    const result = await updateStandardForecastRecord({
      id: req.params.id,
      locationId,
      clientDirectoryId,
      day,
      startTime,
      endTime,
      duration,
      totalCost,
      rateGroups,
      referenceNo,
      shiftType,
      ratio,
      credentials,
    });

    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const deleteStandardRow = async (req, res, next) => {
  try {
    const { locationId } = req.query;
    const { error, status } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ success: false, errors: [error] });

    const result = await deleteStandardForecastRecord({ id: req.params.id, locationId });
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (e) {
    next(e);
  }
};

export const getStandardList = async (req, res, next) => {
  try {
    const { locationId } = req.query;
    const { error, status } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ error });

    const data = await listStandardForecast({ locationId, clientId: resolveClientFilter(req.query) });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const getStandardExport = async (req, res, next) => {
  try {
    const { locationId } = req.query;
    const { error, status } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ error });

    const { filename, body } = await exportStandardForecastCsv({
      locationId,
      clientId: resolveClientFilter(req.query),
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  } catch (e) {
    next(e);
  }
};

export const getSummary = async (req, res, next) => {
  try {
    const credentials = requireShiftCare(req, res);
    if (!credentials) return;

    const { locationId } = req.query;
    const { error, status } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ error });

    const data = await getStandardVsForecastSummary({
      locationId,
      clientId: resolveClientFilter(req.query),
      credentials,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const getSummaryExportCsv = async (req, res, next) => {
  try {
    const credentials = requireShiftCare(req, res);
    if (!credentials) return;

    const { locationId } = req.query;
    const { error, status } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ error });

    const { filename, body } = await exportStandardVsForecastCsv({
      locationId,
      clientId: resolveClientFilter(req.query),
      credentials,
    });
    res.setHeader('Content-Type', 'text/csv');
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

    const { locationId } = req.query;
    const { error, status } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ error });

    const { filename, body } = await exportStandardVsForecastPdf({
      locationId,
      clientId: resolveClientFilter(req.query),
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
    const credentials = getShiftCareCredentials(req);
    const { locationId, tab, page } = req.query;
    const { error, status } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ error });

    const data = await listStandardVsForecastVariance({
      locationId,
      clientId: resolveClientFilter(req.query),
      tab,
      page,
      credentials,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export const getVarianceDetail = async (req, res, next) => {
  try {
    const credentials = getShiftCareCredentials(req);
    const { locationId, templateKey } = req.query;
    const { error, status } = await resolveLocation(locationId);
    if (error) return res.status(status).json({ error });
    if (!templateKey) return res.status(400).json({ error: 'templateKey is required' });

    const data = await getStandardVsForecastVarianceDetail({
      locationId,
      templateKey,
      credentials,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
};

export { financeRoles };
