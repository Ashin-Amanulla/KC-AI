import fs from 'fs';
import * as crmService from './crm.service.js';
import {
  notifyRowCreated,
  notifyRowDeleted,
  notifyRowUpdated,
  notifyCrmImportComplete,
  SPREADSHEET_ROOMS,
} from './crmCollaborationNotify.js';

function handleMongoError(e, next) {
  if (e?.code === 11000) {
    const err = new Error('A record with this ID already exists');
    err.status = 409;
    return next(err);
  }
  return next(e);
}

export async function getNextId(req, res, next) {
  try {
    const id = await crmService.previewNextId(req.params.entity);
    res.json({ id });
  } catch (e) {
    if (e.status === 400) return res.status(400).json({ error: e.message });
    next(e);
  }
}

export async function getDashboard(req, res, next) {
  try {
    const summary = await crmService.getDashboardSummary();
    res.json(summary);
  } catch (e) {
    next(e);
  }
}

// Support Coordinators

export async function listSupportCoordinators(req, res, next) {
  try {
    const rows = await crmService.listSupportCoordinators({ search: req.query.search });
    res.json({ supportCoordinators: rows });
  } catch (e) {
    next(e);
  }
}

export async function createSupportCoordinator(req, res, next) {
  try {
    const doc = await crmService.createSupportCoordinator(req.body || {});
    notifyRowCreated(SPREADSHEET_ROOMS.supportCoordinators, doc);
    res.status(201).json({ supportCoordinator: doc });
  } catch (e) {
    handleMongoError(e, next);
  }
}

export async function updateSupportCoordinator(req, res, next) {
  try {
    const doc = await crmService.updateSupportCoordinator(req.params.id, req.body || {});
    if (!doc) return res.status(404).json({ error: 'Not found' });
    notifyRowUpdated(SPREADSHEET_ROOMS.supportCoordinators, doc);
    res.json({ supportCoordinator: doc });
  } catch (e) {
    handleMongoError(e, next);
  }
}

export async function deleteSupportCoordinator(req, res, next) {
  try {
    const doc = await crmService.deleteSupportCoordinator(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    notifyRowDeleted(SPREADSHEET_ROOMS.supportCoordinators, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

// Leads

export async function listLeads(req, res, next) {
  try {
    const rows = await crmService.listLeads({
      search: req.query.search,
      status: req.query.status,
    });
    res.json({ leads: rows });
  } catch (e) {
    next(e);
  }
}

export async function createLead(req, res, next) {
  try {
    const doc = await crmService.createLead(req.body || {});
    notifyRowCreated(SPREADSHEET_ROOMS.leads, doc);
    res.status(201).json({ lead: doc });
  } catch (e) {
    handleMongoError(e, next);
  }
}

export async function updateLead(req, res, next) {
  try {
    const doc = await crmService.updateLead(req.params.id, req.body || {});
    if (!doc) return res.status(404).json({ error: 'Not found' });
    notifyRowUpdated(SPREADSHEET_ROOMS.leads, doc);
    res.json({ lead: doc });
  } catch (e) {
    handleMongoError(e, next);
  }
}

export async function deleteLead(req, res, next) {
  try {
    const doc = await crmService.deleteLead(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    notifyRowDeleted(SPREADSHEET_ROOMS.leads, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

// Marketing Activities

export async function listMarketingActivities(req, res, next) {
  try {
    const rows = await crmService.listMarketingActivities({ search: req.query.search });
    res.json({ marketingActivities: rows });
  } catch (e) {
    next(e);
  }
}

export async function createMarketingActivity(req, res, next) {
  try {
    const doc = await crmService.createMarketingActivity(req.body || {});
    notifyRowCreated(SPREADSHEET_ROOMS.marketing, doc);
    res.status(201).json({ marketingActivity: doc });
  } catch (e) {
    handleMongoError(e, next);
  }
}

export async function updateMarketingActivity(req, res, next) {
  try {
    const doc = await crmService.updateMarketingActivity(req.params.id, req.body || {});
    if (!doc) return res.status(404).json({ error: 'Not found' });
    notifyRowUpdated(SPREADSHEET_ROOMS.marketing, doc);
    res.json({ marketingActivity: doc });
  } catch (e) {
    handleMongoError(e, next);
  }
}

export async function deleteMarketingActivity(req, res, next) {
  try {
    const doc = await crmService.deleteMarketingActivity(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    notifyRowDeleted(SPREADSHEET_ROOMS.marketing, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

// Staffing Requirements

export async function listStaffingRequirements(req, res, next) {
  try {
    const rows = await crmService.listStaffingRequirements({ search: req.query.search });
    res.json({ staffingRequirements: rows });
  } catch (e) {
    next(e);
  }
}

export async function createStaffingRequirement(req, res, next) {
  try {
    const doc = await crmService.createStaffingRequirement(req.body || {});
    notifyRowCreated(SPREADSHEET_ROOMS.hrRequirements, doc);
    res.status(201).json({ staffingRequirement: doc });
  } catch (e) {
    next(e);
  }
}

export async function updateStaffingRequirement(req, res, next) {
  try {
    const doc = await crmService.updateStaffingRequirement(req.params.id, req.body || {});
    if (!doc) return res.status(404).json({ error: 'Not found' });
    notifyRowUpdated(SPREADSHEET_ROOMS.hrRequirements, doc);
    res.json({ staffingRequirement: doc });
  } catch (e) {
    next(e);
  }
}

export async function deleteStaffingRequirement(req, res, next) {
  try {
    const doc = await crmService.deleteStaffingRequirement(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    notifyRowDeleted(SPREADSHEET_ROOMS.hrRequirements, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

// Import / Export

export async function importCrmWorkbook(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const buffer = fs.readFileSync(req.file.path);
    try {
      fs.unlinkSync(req.file.path);
    } catch {}
    const results = await crmService.importWorkbook(buffer);
    notifyCrmImportComplete();
    res.json({ results });
  } catch (e) {
    next(e);
  }
}

export async function exportCrmWorkbook(req, res, next) {
  try {
    const { filename, body, contentType } = await crmService.exportWorkbook();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  } catch (e) {
    next(e);
  }
}
