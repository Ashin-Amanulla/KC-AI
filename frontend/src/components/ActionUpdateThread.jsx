import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export function ActionUpdateThread({ notes = [], canPost = true, onPost, isPosting = false }) {
  const [draft, setDraft] = useState('');
  const [author, setAuthor] = useState('');

  async function post() {
    if (!draft.trim() || !onPost) return;
    await onPost({ text: draft.trim(), authorName: author.trim() || undefined });
    setDraft('');
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <p className="text-sm font-medium">Action updates</p>
      {notes.length === 0 ? (
        <p className="text-xs text-muted-foreground">No updates yet.</p>
      ) : (
        <div className="max-h-48 space-y-3 overflow-y-auto pr-1">
          {notes.map((n) => (
            <div key={n._id || `${n.createdAt}-${n.text}`} className="rounded-md border bg-muted/30 px-3 py-2">
              <div className="mb-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{n.authorName || 'Staff'}</span>
                {n.createdAt && (
                  <>
                    <span className="mx-1">·</span>
                    <span>
                      {new Date(n.createdAt).toLocaleString([], {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{n.text}</p>
            </div>
          ))}
        </div>
      )}
      {canPost && (
        <div className="space-y-2">
          <Input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Your name (optional)"
            className="h-8 text-xs"
          />
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Add an action update…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                post();
              }
            }}
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="button" size="sm" onClick={post} disabled={isPosting || !draft.trim()}>
            {isPosting ? 'Posting…' : 'Post update'}
          </Button>
        </div>
      )}
    </div>
  );
}
