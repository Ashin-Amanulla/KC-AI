import { permissionsByCategory } from '../../config/permissionDisplay';

export function RolePermissionSummary({ permissionKeys = [], catalog = [] }) {
  const groups = permissionsByCategory(permissionKeys, catalog);
  const categories = Object.keys(groups);

  if (categories.length === 0) {
    return <span className="text-xs text-muted-foreground">No access granted</span>;
  }

  return (
    <div className="flex max-w-md flex-col gap-1">
      {categories.map((cat) => (
        <div key={cat} className="text-2xs leading-snug">
          <span className="font-medium text-foreground">{cat}: </span>
          <span className="text-muted-foreground">{groups[cat].join(', ')}</span>
        </div>
      ))}
    </div>
  );
}
