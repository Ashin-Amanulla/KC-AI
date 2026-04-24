import mongoose from 'mongoose';
import { StaffSchadsRate } from './staffSchadsRate.model.js';
import { Location } from '../locations/location.model.js';

function normName(s) {
  return s?.toString().toLowerCase().replace(/\s+/g, ' ').trim() ?? '';
}

function r2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

const RATE_NUM_KEYS = new Set([
  'daytime',
  'afternoon',
  'night',
  'otUpto2',
  'otAfter2',
  'saturday',
  'satOtAfter2',
  'sunday',
  'ph',
  'mealAllow',
  'brokenShift',
  'sleepover',
  'sleepoverExtra',
  'kmRate',
]);

function normalizeRatesBody(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = { name: raw.name != null ? String(raw.name) : '' };
  for (const k of RATE_NUM_KEYS) {
    if (raw[k] === undefined) continue;
    const v = parseFloat(raw[k]);
    out[k] = r2(Number.isFinite(v) ? v : 0);
  }
  for (const k of RATE_NUM_KEYS) {
    if (out[k] === undefined) out[k] = 0;
  }
  if (out.sleepoverExtra === undefined) out.sleepoverExtra = 0;
  return out;
}

export const listStaffRates = async (req, res, next) => {
  try {
    const { locationId } = req.query;
    if (!locationId) {
      return res.status(400).json({ error: 'locationId query parameter is required' });
    }
    if (!mongoose.isValidObjectId(String(locationId))) {
      return res.status(400).json({ error: 'Invalid locationId' });
    }
    const loc = await Location.findById(locationId).lean();
    if (!loc) {
      return res.status(404).json({ error: 'Location not found' });
    }
    const rows = await StaffSchadsRate.find({ locationId }).sort({ staffName: 1 }).lean();
    res.json({ staffRates: rows });
  } catch (e) {
    next(e);
  }
};

export const upsertStaffRate = async (req, res, next) => {
  try {
    const { locationId, shiftcareStaffId, staffName, rates: rawRates } = req.body || {};
    if (!locationId || !mongoose.isValidObjectId(String(locationId))) {
      return res.status(400).json({ error: 'locationId is required and must be a valid ObjectId' });
    }
    if (!shiftcareStaffId || String(shiftcareStaffId).trim() === '') {
      return res.status(400).json({ error: 'shiftcareStaffId is required' });
    }
    if (staffName == null || String(staffName).trim() === '') {
      return res.status(400).json({ error: 'staffName is required' });
    }
    const loc = await Location.findById(locationId).lean();
    if (!loc) {
      return res.status(404).json({ error: 'Location not found' });
    }
    const nameStr = String(staffName).trim();
    const n = normName(nameStr);
    if (!n) {
      return res.status(400).json({ error: 'Invalid staffName' });
    }
    const rates = normalizeRatesBody({ ...rawRates, name: rawRates?.name != null ? rawRates.name : nameStr });
    if (!rates) {
      return res.status(400).json({ error: 'Invalid rates' });
    }
    rates.name = rates.name || nameStr;

    const locOid = new mongoose.Types.ObjectId(String(locationId));
    const scId = String(shiftcareStaffId).trim();
    const filter = { locationId: locOid, shiftcareStaffId: scId };

    const doc = await StaffSchadsRate.findOneAndUpdate(
      filter,
      {
        $set: {
          locationId: locOid,
          shiftcareStaffId: scId,
          staffName: nameStr,
          normName: n,
          rates,
        },
      },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    res.json({ staffRate: doc });
  } catch (e) {
    next(e);
  }
};

export const deleteStaffRate = async (req, res, next) => {
  try {
    const { locationId, shiftcareStaffId } = req.query;
    if (!locationId || !shiftcareStaffId) {
      return res.status(400).json({ error: 'locationId and shiftcareStaffId query parameters are required' });
    }
    if (!mongoose.isValidObjectId(String(locationId))) {
      return res.status(400).json({ error: 'Invalid locationId' });
    }
    const r = await StaffSchadsRate.deleteOne({
      locationId: new mongoose.Types.ObjectId(String(locationId)),
      shiftcareStaffId: String(shiftcareStaffId).trim(),
    });
    if (r.deletedCount === 0) {
      return res.status(404).json({ error: 'Staff rate not found' });
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

const MAX_BULK = 2000;

export const bulkUpsertStaffRates = async (req, res, next) => {
  try {
    const { locationId, rows } = req.body || {};
    if (!locationId || !mongoose.isValidObjectId(String(locationId))) {
      return res.status(400).json({ error: 'locationId is required and must be a valid ObjectId' });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'rows must be a non-empty array' });
    }
    if (rows.length > MAX_BULK) {
      return res.status(400).json({ error: `Too many rows (max ${MAX_BULK})` });
    }
    const loc = await Location.findById(locationId).lean();
    if (!loc) {
      return res.status(404).json({ error: 'Location not found' });
    }
    const locOid = new mongoose.Types.ObjectId(String(locationId));
    const ops = [];
    for (const r of rows) {
      if (!r?.shiftcareStaffId || !r?.staffName) {
        return res.status(400).json({ error: 'Each row must include shiftcareStaffId and staffName' });
      }
      const nameStr = String(r.staffName).trim();
      const n = normName(nameStr);
      if (!n) {
        return res.status(400).json({ error: 'Invalid staffName in row' });
      }
      const rates = normalizeRatesBody({ ...r.rates, name: r.rates?.name != null ? r.rates.name : nameStr });
      if (!rates) {
        return res.status(400).json({ error: 'Invalid rates in row' });
      }
      rates.name = rates.name || nameStr;
      const scId = String(r.shiftcareStaffId).trim();
      ops.push({
        updateOne: {
          filter: { locationId: locOid, shiftcareStaffId: scId },
          update: {
            $set: {
              locationId: locOid,
              shiftcareStaffId: scId,
              staffName: nameStr,
              normName: n,
              rates,
            },
          },
          upsert: true,
        },
      });
    }
    const result = await StaffSchadsRate.bulkWrite(ops, { ordered: false });
    res.json({
      ok: true,
      saved: rows.length,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount,
    });
  } catch (e) {
    next(e);
  }
};
