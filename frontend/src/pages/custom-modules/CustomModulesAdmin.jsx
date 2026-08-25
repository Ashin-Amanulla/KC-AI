import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Eye, FileUp, Pencil, Puzzle, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  useCustomModules,
  useCreateCustomModule,
  useUpdateCustomModule,
  useDeleteCustomModule,
} from '../../api/customModules';

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsText(file);
  });
}

export function CustomModulesAdmin() {
  const { data: modules = [], isLoading } = useCustomModules();
  const createModule = useCreateCustomModule();
  const updateModule = useUpdateCustomModule();
  const deleteModule = useDeleteCustomModule();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [sourceFileName, setSourceFileName] = useState('');
  const fileInputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.(jsx|js|tsx)$/i.test(file.name)) {
      toast.error('Upload a .jsx / .js / .tsx file.');
      return;
    }
    try {
      const text = await readFileText(file);
      setSource(text);
      setSourceFileName(file.name);
      if (!name.trim()) setName(file.name.replace(/\.(jsx|js|tsx)$/i, ''));
    } catch {
      toast.error("Couldn't read that file.");
    }
  };

  const handleCreate = async (publish) => {
    if (!name.trim()) return toast.error('Give the module a name.');
    if (!source.trim()) return toast.error('Attach a .jsx source file.');
    try {
      await createModule.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        sourceCode: source,
        status: publish ? 'published' : 'draft',
      });
      toast.success(publish ? 'Module published — it is now in the sidebar.' : 'Draft saved.');
      setName('');
      setDescription('');
      setSource('');
      setSourceFileName('');
    } catch (err) {
      toast.error(err?.response?.data?.error?.message || 'Could not create module.');
    }
  };

  const toggleStatus = async (mod) => {
    try {
      await updateModule.mutateAsync({
        id: mod._id,
        body: { status: mod.status === 'published' ? 'draft' : 'published' },
      });
      toast.success(
        mod.status === 'published' ? 'Moved back to draft.' : 'Published — visible in sidebar.'
      );
    } catch {
      toast.error('Update failed.');
    }
  };

  const handleDelete = async (mod) => {
    if (!window.confirm(`Delete "${mod.name}"? This cannot be undone.`)) return;
    try {
      await deleteModule.mutateAsync(mod._id);
      toast.success('Deleted.');
    } catch {
      toast.error('Delete failed.');
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="Custom modules"
        description="Upload single-file JSX tools. They compile in a sandboxed frame and appear in the sidebar once published."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Upload a new module</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Estimate Calculator"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Description (optional)
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Shown under the module title"
              />
            </div>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) {
                const dt = new DataTransfer();
                dt.items.add(file);
                if (fileInputRef.current) {
                  fileInputRef.current.files = dt.files;
                  await handleFile({ target: fileInputRef.current, preventDefault() {} });
                }
              }
            }}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border px-6 py-8 text-center"
          >
            <FileUp className="mb-2 size-6 text-muted-foreground" />
            <div className="text-sm font-medium">
              {sourceFileName ? sourceFileName : 'Drop a .jsx file here or browse'}
            </div>
            <div className="mt-1 text-2xs text-muted-foreground">
              Imports supported: react, react-dom, xlsx, lucide-react
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jsx,.js,.tsx"
              onChange={handleFile}
              className="mt-3 text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" disabled={createModule.isPending} onClick={() => handleCreate(false)}>
              Save as draft
            </Button>
            <Button size="sm" disabled={createModule.isPending} onClick={() => handleCreate(true)}>
              Publish immediately
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Installed modules</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : modules.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Puzzle className="size-8" />
              <div className="text-sm">No custom modules yet.</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Version</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.map((mod) => (
                  <TableRow key={mod._id}>
                    <TableCell>
                      <div className="font-medium">{mod.name}</div>
                      {mod.description && (
                        <div className="text-2xs text-muted-foreground">{mod.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{mod.slug}</TableCell>
                    <TableCell>
                      <Badge variant={mod.status === 'published' ? 'secondary' : 'outline'}>
                        {mod.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">v{mod.version}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/m/${mod.slug}`}>
                            <Eye className="size-4" />
                            Open
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleStatus(mod)}>
                          <Pencil className="size-4" />
                          {mod.status === 'published' ? 'Unpublish' : 'Publish'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(mod)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
