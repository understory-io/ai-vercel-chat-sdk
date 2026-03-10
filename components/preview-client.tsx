'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/toast';

interface DraftData {
  id: string;
  title: string;
  content: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  intercomArticleId: string | null;
}

export function PreviewClient({
  initialDraft,
}: {
  initialDraft: DraftData;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(draft.title);
  const [editContent, setEditContent] = useState(draft.content);
  const [editDescription, setEditDescription] = useState(
    draft.description || '',
  );
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [renderedHtml, setRenderedHtml] = useState('');
  const lastUpdatedAt = useRef(draft.updatedAt);

  // Render markdown to HTML client-side for preview
  const renderMarkdown = useCallback(async (content: string) => {
    // Simple markdown rendering - use the server for accurate rendering
    // For now, do basic conversion
    const lines = content.split('\n');
    let html = '';
    let inList = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('### ')) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h3>${trimmed.slice(4)}</h3>`;
      } else if (trimmed.startsWith('## ')) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h2>${trimmed.slice(3)}</h2>`;
      } else if (trimmed.startsWith('# ')) {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<h1>${trimmed.slice(2)}</h1>`;
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += `<li>${formatInline(trimmed.slice(2))}</li>`;
      } else if (trimmed === '') {
        if (inList) { html += '</ul>'; inList = false; }
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += `<p>${formatInline(trimmed)}</p>`;
      }
    }
    if (inList) html += '</ul>';
    return html;
  }, []);

  useEffect(() => {
    renderMarkdown(draft.content).then(setRenderedHtml);
  }, [draft.content, renderMarkdown]);

  // Poll for changes only when the URL has ?watch=true (set by the skill)
  // This avoids constant polling during normal browsing
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setWatching(params.has('watch'));
  }, []);

  useEffect(() => {
    if (!watching || draft.status !== 'draft' || editing) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/drafts/${draft.id}`);
        if (!res.ok) return;
        const updated: DraftData = await res.json();

        if (updated.updatedAt !== lastUpdatedAt.current) {
          lastUpdatedAt.current = updated.updatedAt;
          setDraft(updated);
          setEditTitle(updated.title);
          setEditContent(updated.content);
          setEditDescription(updated.description || '');
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [draft.id, draft.status, editing, watching]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/drafts/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          description: editDescription || null,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setDraft({
          ...draft,
          title: updated.title,
          content: updated.content,
          description: updated.description,
          updatedAt: updated.updatedAt,
        });
        lastUpdatedAt.current = updated.updatedAt;
        setEditing(false);
        toast({ type: 'success', description: 'Saved' });
      } else {
        toast({ type: 'error', description: 'Failed to save' });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const res = await fetch(`/api/drafts/${draft.id}/publish`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setDraft({ ...draft, status: 'published' });
        toast({
          type: 'success',
          description: 'Article published to Intercom!',
        });
        if (data.intercomUrl) {
          window.open(data.intercomUrl, '_blank');
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          type: 'error',
          description: err.error || 'Failed to publish',
        });
      }
    } finally {
      setPublishing(false);
    }
  }

  async function handleDiscard() {
    const res = await fetch(`/api/drafts/${draft.id}/discard`, {
      method: 'POST',
    });
    if (res.ok) {
      setDraft({ ...draft, status: 'discarded' });
      toast({ type: 'success', description: 'Draft discarded' });
    }
  }

  function startEditing() {
    setEditTitle(draft.title);
    setEditContent(draft.content);
    setEditDescription(draft.description || '');
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
  }

  const isDraft = draft.status === 'draft';

  return (
    <div className="min-h-dvh bg-white dark:bg-zinc-950">
      {/* Header bar */}
      <div className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur-sm dark:bg-zinc-950/80 dark:border-zinc-800">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                draft.status === 'published'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : draft.status === 'discarded'
                    ? 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-500'
                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}
            >
              {draft.status === 'published'
                ? 'Published'
                : draft.status === 'discarded'
                  ? 'Discarded'
                  : 'Draft'}
            </span>
            {editing && (
              <span className="text-xs text-blue-500 font-medium">
                Editing
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {isDraft && !editing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startEditing}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiscard}
                  className="text-gray-500"
                >
                  Discard
                </Button>
                <Button
                  size="sm"
                  onClick={handlePublish}
                  disabled={publishing}
                >
                  {publishing ? 'Publishing...' : 'Publish to Intercom'}
                </Button>
              </>
            )}
            {editing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cancelEditing}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </>
            )}
            {draft.status === 'published' && (
              <span className="text-sm text-green-600 dark:text-green-400">
                Published to Intercom
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {editing ? (
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1 block">
              Title
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full text-2xl font-bold border-0 border-b border-gray-200 dark:border-zinc-700 bg-transparent px-0 py-2 focus:outline-none focus:border-blue-500 dark:text-zinc-50"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1 block">
              Description (optional, max 255 chars)
            </label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) =>
                setEditDescription(e.target.value.slice(0, 255))
              }
              placeholder="Short description for SEO"
              className="w-full text-sm border-0 border-b border-gray-200 dark:border-zinc-700 bg-transparent px-0 py-2 focus:outline-none focus:border-blue-500 dark:text-zinc-300"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1 block">
              Content (Markdown)
            </label>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={30}
              className="w-full font-mono text-sm border rounded-lg border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 p-4 focus:outline-none focus:border-blue-500 dark:text-zinc-200 resize-y"
            />
          </div>
        </div>
      ) : (
        <article className="max-w-3xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-bold tracking-tight mb-4 dark:text-zinc-50">
            {draft.title}
          </h1>
          {draft.description && (
            <p className="text-lg text-gray-500 dark:text-zinc-400 mb-8">
              {draft.description}
            </p>
          )}
          <div
            className="prose prose-gray dark:prose-invert max-w-none
              prose-headings:font-semibold
              prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3
              prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-2
              prose-p:leading-7
              prose-li:leading-7
              prose-a:text-blue-600 dark:prose-a:text-blue-400
              prose-code:text-sm prose-code:bg-gray-100 dark:prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
              prose-pre:bg-gray-50 dark:prose-pre:bg-zinc-900"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </article>
      )}
    </div>
  );
}

/** Simple inline markdown formatting */
function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(
      /\[(.+?)\]\((.+?)\)/g,
      '<a href="$2">$1</a>',
    );
}
