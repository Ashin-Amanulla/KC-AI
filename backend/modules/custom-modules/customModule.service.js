import { CustomModule } from './customModule.model.js';
import { AppError, ConflictError, ValidationError, NotFoundError } from '../../helpers/errors.js';

/** Max uploaded source size: 512 KB is plenty for a single-file JSX tool. */
const MAX_SOURCE_LENGTH = 512 * 1024;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugifyName(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function validateSource(sourceCode) {
  if (typeof sourceCode !== 'string' || !sourceCode.trim()) {
    throw new ValidationError('Source code is required.');
  }
  if (sourceCode.length > MAX_SOURCE_LENGTH) {
    throw new ValidationError('Source code too large (max 512 KB).');
  }
}

async function ensureUniqueSlug(slug, excludeId = null) {
  const clash = await CustomModule.findOne({
    slug,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).lean();
  if (clash) {
    throw new ConflictError(`A module with slug "${slug}" already exists.`);
  }
}

export async function listCustomModules({ includeDrafts = false } = {}) {
  const filter = includeDrafts ? {} : { status: 'published' };
  const rows = await CustomModule.find(filter)
    .sort({ updatedAt: -1 })
    .select('name slug icon description status version createdAt updatedAt')
    .lean();
  return rows;
}

export async function getCustomModuleBySlug(slug) {
  const doc = await CustomModule.findOne({ slug: String(slug || '').toLowerCase() }).lean();
  return doc || null;
}

/** Published module for rendering; drafts only visible to managers via admin endpoints. */
export async function getRenderableModule(slug) {
  const doc = await CustomModule.findOne({
    slug: String(slug || '').toLowerCase(),
    status: 'published',
  }).lean();
  if (!doc) throw new NotFoundError('Module not found or not published.');
  return doc;
}

export async function createCustomModule(data, userId) {
  const name = String(data.name || '').trim();
  if (!name) throw new ApiError(400, 'Module name is required.');
  validateSource(data.sourceCode);

  let slug = slugifyName(data.slug || name);
  if (!SLUG_RE.test(slug)) slug = 'module';
  await ensureUniqueSlug(slug);

  const doc = await CustomModule.create({
    name,
    slug,
    icon: String(data.icon || 'Puzzle').trim() || 'Puzzle',
    description: String(data.description || '').trim(),
    sourceCode: data.sourceCode,
    status: data.status === 'published' ? 'published' : 'draft',
    createdBy: userId || null,
  });
  return doc.toObject();
}

export async function updateCustomModule(id, data) {
  const existing = await CustomModule.findById(id);
  if (!existing) return null;

  if (data.name !== undefined) existing.name = String(data.name).trim();
  if (data.description !== undefined) existing.description = String(data.description).trim();
  if (data.icon !== undefined) existing.icon = String(data.icon).trim() || 'Puzzle';

  if (data.slug !== undefined || data.name !== undefined) {
    const candidate = slugifyName(data.slug || existing.name);
    if (candidate && SLUG_RE.test(candidate) && candidate !== existing.slug) {
      await ensureUniqueSlug(candidate, id);
      existing.slug = candidate;
    }
  }

  if (data.sourceCode !== undefined) {
    validateSource(data.sourceCode);
    existing.sourceCode = data.sourceCode;
    existing.version += 1; // source change bumps version → busts iframe cache
  }

  if (data.status !== undefined) {
    if (!['draft', 'published'].includes(data.status)) {
      throw new ValidationError('Invalid status.');
    }
    existing.status = data.status;
  }

  await existing.save();
  return existing.toObject();
}

export async function deleteCustomModule(id) {
  return CustomModule.findByIdAndDelete(id);
}
