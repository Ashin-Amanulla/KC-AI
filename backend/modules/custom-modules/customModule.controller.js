import * as customModuleService from './customModule.service.js';

export async function listModules(req, res, next) {
  try {
    // Managers see drafts too; viewers only see published.
    const includeDrafts = Boolean(req.canManageCustomModules);
    const modules = await customModuleService.listCustomModules({ includeDrafts });
    res.json({ modules });
  } catch (e) {
    next(e);
  }
}

export async function getModule(req, res, next) {
  try {
    const module = await customModuleService.getCustomModuleBySlug(req.params.slug);
    if (!module) return res.status(404).json({ error: 'Not found' });
    // Draft source is only exposed to managers.
    if (module.status !== 'published' && !req.canManageCustomModules) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({ module });
  } catch (e) {
    next(e);
  }
}

export async function createModule(req, res, next) {
  try {
    const module = await customModuleService.createCustomModule(req.body || {}, req.user?.userId);
    res.status(201).json({ module });
  } catch (e) {
    next(e);
  }
}

export async function updateModule(req, res, next) {
  try {
    const module = await customModuleService.updateCustomModule(req.params.id, req.body || {});
    if (!module) return res.status(404).json({ error: 'Not found' });
    res.json({ module });
  } catch (e) {
    next(e);
  }
}

export async function deleteModule(req, res, next) {
  try {
    await customModuleService.deleteCustomModule(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
