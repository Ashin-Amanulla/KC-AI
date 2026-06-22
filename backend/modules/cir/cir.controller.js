import fs from 'fs';
import * as cirService from './cir.service.js';
import {
  notifyCirRowCreated,
  notifyCirRowUpdated,
  notifyCirRowDeleted,
  notifyCirImportComplete,
} from './cirCollaborationNotify.js';
import { User } from '../user/user.model.js';

function handleMongoError(e, next) {
  if (e?.code === 11000) {
    const err = new Error('A record with this CIR ID already exists');
    err.status = 409;
    return next(err);
  }
  if (e?.status) return resOrNext(e, next);
  return next(e);
}

function resOrNext(e, next) {
  if (e?.status === 400) return next(e);
  if (e?.status === 403) return next(e);
  if (e?.status === 404) return next(e);
  return next(e);
}

async function loadUserContext(req) {
  if (!req.user?.userId) return null;
  const user = await User.findById(req.user.userId).select('name email').lean();
  return user;
}

export async function getNextCirId(req, res, next) {
  try {
    const id = await cirService.previewNextCirId();
    res.json({ id });
  } catch (e) {
    next(e);
  }
}

export async function listCirRecords(req, res, next) {
  try {
    const rows = await cirService.listCirRecords({ search: req.query.search });
    res.json({ records: rows });
  } catch (e) {
    next(e);
  }
}

export async function createCirRecord(req, res, next) {
  try {
    const user = await loadUserContext(req);
    const doc = await cirService.createCirRecord(req.body || {}, user);
    const plain = doc?.toObject ? doc.toObject() : doc;
    notifyCirRowCreated(plain);
    res.status(201).json({ record: plain });
  } catch (e) {
    handleMongoError(e, next);
  }
}

export async function updateCirRecord(req, res, next) {
  try {
    const doc = await cirService.updateCirRecord(req.params.id, req.body || {});
    if (!doc) return res.status(404).json({ error: 'Not found' });
    notifyCirRowUpdated(doc);
    res.json({ record: doc });
  } catch (e) {
    handleMongoError(e, next);
  }
}

export async function deleteCirRecord(req, res, next) {
  try {
    const doc = await cirService.deleteCirRecord(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    notifyCirRowDeleted(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function postActionUpdate(req, res, next) {
  try {
    const { text, authorName } = req.body || {};
    const doc = await cirService.appendActionUpdate(req.params.id, {
      text,
      authorName,
      authorUserId: req.user?.userId || null,
    });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    notifyCirRowUpdated(doc);
    res.json({ record: doc });
  } catch (e) {
    if (e?.status === 400) return res.status(400).json({ error: e.message });
    next(e);
  }
}

export async function importCirWorkbook(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const buffer = fs.readFileSync(req.file.path);
    try {
      fs.unlinkSync(req.file.path);
    } catch {}
    const results = await cirService.importCirWorkbook(buffer);
    notifyCirImportComplete();
    res.json({ results });
  } catch (e) {
    next(e);
  }
}

export async function exportCirWorkbook(req, res, next) {
  try {
    const { filename, body, contentType } = await cirService.exportCirWorkbook();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  } catch (e) {
    next(e);
  }
}
