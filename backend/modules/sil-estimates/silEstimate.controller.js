import * as silEstimateService from './silEstimate.service.js';

export async function listSilEstimates(req, res, next) {
  try {
    const estimates = await silEstimateService.listSilEstimates();
    res.json({ estimates });
  } catch (e) {
    next(e);
  }
}

export async function getSilEstimate(req, res, next) {
  try {
    const estimate = await silEstimateService.getSilEstimateById(req.params.id);
    if (!estimate) return res.status(404).json({ error: 'Not found' });
    res.json({ estimate });
  } catch (e) {
    next(e);
  }
}

export async function createSilEstimate(req, res, next) {
  try {
    const estimate = await silEstimateService.createSilEstimate(req.body || {}, req.user?.userId);
    res.status(201).json({ estimate });
  } catch (e) {
    next(e);
  }
}

export async function updateSilEstimate(req, res, next) {
  try {
    const estimate = await silEstimateService.updateSilEstimate(req.params.id, req.body || {});
    if (!estimate) return res.status(404).json({ error: 'Not found' });
    res.json({ estimate });
  } catch (e) {
    next(e);
  }
}

export async function deleteSilEstimate(req, res, next) {
  try {
    const estimate = await silEstimateService.deleteSilEstimate(req.params.id);
    if (!estimate) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function duplicateSilEstimate(req, res, next) {
  try {
    const estimate = await silEstimateService.duplicateSilEstimate(req.params.id, req.user?.userId);
    if (!estimate) return res.status(404).json({ error: 'Not found' });
    res.status(201).json({ estimate });
  } catch (e) {
    next(e);
  }
}
