import { AwardRateSet } from './awardRateSet.model.js';
import { getConstantsEffectiveAt, invalidateAwardRateCache } from './awardRateResolver.js';

export const listAwardRateSets = async (_req, res, next) => {
  try {
    const sets = await AwardRateSet.find({}).sort({ effectiveFrom: -1 }).lean();
    res.json({ sets });
  } catch (err) {
    next(err);
  }
};

export const getEffectiveAwardRates = async (req, res, next) => {
  try {
    const date = req.query.date ? new Date(req.query.date) : new Date();
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid date' });
    }
    const resolved = await getConstantsEffectiveAt(date);
    res.json(resolved);
  } catch (err) {
    next(err);
  }
};

export const createAwardRateSet = async (req, res, next) => {
  try {
    const { label, effectiveFrom, effectiveTo, source, status, constants, notes } = req.body || {};
    if (!label || !effectiveFrom || !constants) {
      return res.status(400).json({ error: 'label, effectiveFrom and constants are required' });
    }
    const set = await AwardRateSet.create({
      label,
      effectiveFrom,
      effectiveTo: effectiveTo || null,
      source: source || '',
      status: status || 'draft',
      constants,
      notes: notes || '',
    });
    await invalidateAwardRateCache();
    res.status(201).json({ set });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'A rate set with that effectiveFrom already exists' });
    }
    next(err);
  }
};

export const updateAwardRateSet = async (req, res, next) => {
  try {
    const allowed = ['label', 'effectiveFrom', 'effectiveTo', 'source', 'status', 'constants', 'notes'];
    const update = {};
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) update[key] = req.body[key];
    }
    const set = await AwardRateSet.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!set) return res.status(404).json({ error: 'Rate set not found' });
    await invalidateAwardRateCache();
    res.json({ set });
  } catch (err) {
    next(err);
  }
};
