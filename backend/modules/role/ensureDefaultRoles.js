import { Role } from './role.model.js';
import { DEFAULT_ROLES } from '../../config/permissionCatalog.js';

export const ensureDefaultRoles = async () => {
  for (const def of DEFAULT_ROLES) {
    await Role.findOneAndUpdate(
      { slug: def.slug },
      {
        $set: {
          name: def.name,
          description: def.description,
          permissions: def.permissions,
          isSystem: def.isSystem,
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
  }
};
