'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/toast';
import { CollectionSelectorModal } from '@/components/collection-selector-modal';
import { EditorToolbar } from '@/components/editor-toolbar';
import { Editor } from '@/components/text-editor';
import type { EditorView } from 'prosemirror-view';
import { Loader2, ChevronRight, Folder } from 'lucide-react';

interface DraftData {
  id: string;
  title: string;
  content: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  intercomArticleId: string | null;
  userId: string;
  submittedAt: string | null;
}

interface IntercomAdmin {
  id: string;
  name: string;
  email: string;
}

interface Collection {
  id: string;
  name: string;
  description?: string;
  parent_id: string | null;
  children: Collection[];
}

// Session cache for admins (avoids re-fetching on every dialog open)
let adminsCache: IntercomAdmin[] | null = null;

export function PreviewClient({
  initialDraft,
  currentUserId,
  authorName,
  authorEmail,
}: {
  initialDraft: DraftData;
  currentUserId: string | null;
  authorName: string | null;
  authorEmail: string | null;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(draft.title);
  const [editContent, setEditContent] = useState(draft.content);
  const [editDescription, setEditDescription] = useState(
    draft.description || '',
  );
  const [saving, setSaving] = useState(false);
  const [renderedHtml, setRenderedHtml] = useState('');
  const lastUpdatedAt = useRef(draft.updatedAt);
  const [editorView, setEditorView] = useState<EditorView | null>(null);

  // Review action states
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [requestingChanges, setRequestingChanges] = useState(false);

  // Publish/approve dialog state
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] =
    useState<Collection | null>(null);
  const [collectionPath, setCollectionPath] = useState<Collection[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState<string>('');
  const [admins, setAdmins] = useState<IntercomAdmin[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false);
  const [publishDescription, setPublishDescription] = useState('');

  const isAuthor = currentUserId === draft.userId;
  const isPendingReview = draft.status === 'pending_review';
  const isDraft = draft.status === 'draft';
  const isPublished = draft.status === 'published';

  // Render markdown to HTML client-side for preview
  const renderMarkdown = useCallback(async (content: string) => {
    const lines = content.split('\n');
    let html = '';
    let inList = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('### ')) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        html += `<h3>${trimmed.slice(4)}</h3>`;
      } else if (trimmed.startsWith('## ')) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        html += `<h2>${trimmed.slice(3)}</h2>`;
      } else if (trimmed.startsWith('# ')) {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        html += `<h1>${trimmed.slice(2)}</h1>`;
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        if (!inList) {
          html += '<ul>';
          inList = true;
        }
        html += `<li>${formatInline(trimmed.slice(2))}</li>`;
      } else if (trimmed === '') {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
      } else {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
        html += `<p>${formatInline(trimmed)}</p>`;
      }
    }
    if (inList) html += '</ul>';
    return html;
  }, []);

  useEffect(() => {
    renderMarkdown(draft.content).then(setRenderedHtml);
  }, [draft.content, renderMarkdown]);

  // Poll for changes only when ?watch=true, tab is visible, and within timeout
  const [watching, setWatching] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const watchStarted = useRef<number>(0);
  const WATCH_TIMEOUT_MS = 10 * 60 * 1000; // Stop polling after 10 minutes

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('watch')) {
      setWatching(true);
      watchStarted.current = Date.now();
    }
  }, []);

  useEffect(() => {
    const handleVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibility);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (!watching || !tabVisible || editing) return;
    if (draft.status !== 'draft' && draft.status !== 'pending_review') return;

    const interval = setInterval(async () => {
      // Auto-stop after timeout
      if (Date.now() - watchStarted.current > WATCH_TIMEOUT_MS) {
        setWatching(false);
        return;
      }

      try {
        const res = await fetch(`/api/drafts/${draft.id}`);
        if (!res.ok) return;
        const updated: DraftData = await res.json();

        if (updated.updatedAt !== lastUpdatedAt.current) {
          lastUpdatedAt.current = updated.updatedAt;
          setDraft((prev) => ({ ...prev, ...updated }));
          setEditTitle(updated.title);
          setEditContent(updated.content);
          setEditDescription(updated.description || '');
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [draft.id, draft.status, editing, watching, tabVisible]);

  // Load admins when approve dialog opens
  useEffect(() => {
    if (!approveDialogOpen) return;

    setPublishDescription(draft.description || '');

    if (adminsCache) {
      setAdmins(adminsCache);
      return;
    }

    setIsLoadingAdmins(true);
    fetch('/api/intercom/admins')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          const fetched = data.admins || [];
          adminsCache = fetched;
          setAdmins(fetched);
        }
      })
      .catch(() => {
        toast({ type: 'error', description: 'Failed to load authors' });
      })
      .finally(() => setIsLoadingAdmins(false));
  }, [approveDialogOpen, draft.description]);

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
        setDraft((prev) => ({
          ...prev,
          title: updated.title,
          content: updated.content,
          description: updated.description,
          updatedAt: updated.updatedAt,
        }));
        lastUpdatedAt.current = updated.updatedAt;
        setEditorView(null);
        setEditing(false);
        toast({ type: 'success', description: 'Saved' });
      } else {
        toast({ type: 'error', description: 'Failed to save' });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmitForReview() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/drafts/${draft.id}/submit-for-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setDraft((prev) => ({
          ...prev,
          status: 'pending_review',
          submittedAt: new Date().toISOString(),
        }));
        toast({ type: 'success', description: 'Submitted for review' });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          type: 'error',
          description: err.error || 'Failed to submit for review',
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  function openApproveDialog() {
    setSelectedCollection(null);
    setCollectionPath([]);
    setSelectedAuthor('');
    setPublishDescription(draft.description || '');
    setApproveDialogOpen(true);
  }

  async function handleApprove() {
    if (!selectedCollection) {
      toast({ type: 'error', description: 'Please select a collection' });
      return;
    }
    if (!selectedAuthor) {
      toast({ type: 'error', description: 'Please select an author' });
      return;
    }

    setApproving(true);
    try {
      const res = await fetch(`/api/drafts/${draft.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collectionId: selectedCollection.id,
          authorId: selectedAuthor,
          description: publishDescription || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDraft((prev) => ({ ...prev, status: 'published' }));
        setApproveDialogOpen(false);
        toast({
          type: 'success',
          description: 'Approved and published to Intercom!',
        });
        if (data.intercomUrl) {
          window.open(data.intercomUrl, '_blank');
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          type: 'error',
          description: err.error || 'Failed to approve',
        });
      }
    } finally {
      setApproving(false);
    }
  }

  async function handleRequestChanges() {
    setRequestingChanges(true);
    try {
      const res = await fetch(`/api/drafts/${draft.id}/request-changes`, {
        method: 'POST',
      });
      if (res.ok) {
        setDraft((prev) => ({
          ...prev,
          status: 'draft',
          submittedAt: null,
        }));
        toast({
          type: 'success',
          description: 'Changes requested — sent back to author',
        });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({
          type: 'error',
          description: err.error || 'Failed to request changes',
        });
      }
    } finally {
      setRequestingChanges(false);
    }
  }

  async function handleDiscard() {
    const res = await fetch(`/api/drafts/${draft.id}/discard`, {
      method: 'POST',
    });
    if (res.ok) {
      setDraft((prev) => ({ ...prev, status: 'discarded' }));
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
    setEditorView(null);
    setEditing(false);
  }

  const statusBadge = (() => {
    switch (draft.status) {
      case 'published':
        return {
          label: 'Published',
          className:
            'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        };
      case 'discarded':
        return {
          label: 'Discarded',
          className:
            'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-500',
        };
      case 'pending_review':
        return {
          label: 'Pending Review',
          className:
            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        };
      default:
        return {
          label: 'Draft',
          className:
            'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        };
    }
  })();

  return (
    <div className="min-h-dvh bg-white dark:bg-zinc-950">
      {/* Header bar */}
      <div className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur-sm dark:bg-zinc-950/80 dark:border-zinc-800">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge.className}`}
            >
              {statusBadge.label}
            </span>
            {editing && (
              <span className="text-xs text-blue-500 font-medium">Editing</span>
            )}
          </div>
          <div className="flex gap-2">
            {/* Author actions for draft status */}
            {isDraft && isAuthor && !editing && (
              <>
                <Button variant="outline" size="sm" onClick={startEditing}>
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
                  onClick={handleSubmitForReview}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit for Review'}
                </Button>
              </>
            )}
            {/* Editing actions */}
            {editing && (
              <>
                <Button variant="outline" size="sm" onClick={cancelEditing}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </>
            )}
            {/* Reviewer actions for pending_review */}
            {isPendingReview && currentUserId && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRequestChanges}
                  disabled={requestingChanges}
                >
                  {requestingChanges ? 'Sending...' : 'Request Changes'}
                </Button>
                <Button
                  size="sm"
                  onClick={openApproveDialog}
                  disabled={approving}
                >
                  Approve
                </Button>
              </>
            )}
            {/* Published badge */}
            {isPublished && (
              <span className="text-sm text-green-600 dark:text-green-400">
                Published to Intercom
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Submitted banner for pending_review */}
      {isPendingReview && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/40">
          <div className="max-w-3xl mx-auto px-6 py-2 text-sm text-blue-700 dark:text-blue-300">
            Submitted by {authorName || authorEmail || 'Unknown'}
            {draft.submittedAt &&
              ` on ${new Date(draft.submittedAt).toLocaleDateString()}`}
          </div>
        </div>
      )}

      {/* Approve dialog (collection/author picker) */}
      {approveDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setApproveDialogOpen(false)}
          />
          <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold dark:text-zinc-50">
                Approve & Publish to Intercom
              </h2>
              <button
                type="button"
                onClick={() => setApproveDialogOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
              >
                &times;
              </button>
            </div>

            {/* Collection selector */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                Collection
              </label>
              <button
                type="button"
                onClick={() => setCollectionModalOpen(true)}
                className="w-full flex items-center gap-3 p-3 border rounded-lg text-left hover:bg-gray-50 dark:hover:bg-zinc-800 dark:border-zinc-700 transition-colors"
              >
                <Folder className="size-4 text-gray-400 shrink-0" />
                {selectedCollection ? (
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm dark:text-zinc-100 truncate">
                      {selectedCollection.name}
                    </p>
                    {collectionPath.length > 0 && (
                      <p className="text-xs text-gray-500 dark:text-zinc-400 flex items-center gap-0.5 truncate">
                        {collectionPath.map((c, i) => (
                          <span
                            key={c.id}
                            className="flex items-center gap-0.5"
                          >
                            {i > 0 && <ChevronRight className="size-3" />}
                            {c.name}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-zinc-500">
                    Select collection...
                  </span>
                )}
              </button>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                Description (optional)
              </label>
              <textarea
                value={publishDescription}
                onChange={(e) =>
                  setPublishDescription(e.target.value.slice(0, 255))
                }
                placeholder="SEO-friendly summary (up to 255 characters)"
                rows={3}
                className="w-full text-sm border rounded-lg p-3 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <p className="text-xs text-gray-400 text-right">
                {publishDescription.length}/255
              </p>
            </div>

            {/* Author selector */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                Author
              </label>
              {isLoadingAdmins ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="size-4 animate-spin text-gray-400" />
                  <span className="text-sm text-gray-400">
                    Loading authors...
                  </span>
                </div>
              ) : admins.length === 0 ? (
                <p className="text-sm text-red-500">
                  No admins found. Check Intercom configuration.
                </p>
              ) : (
                <select
                  value={selectedAuthor}
                  onChange={(e) => setSelectedAuthor(e.target.value)}
                  className="w-full text-sm border rounded-lg p-2.5 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select author...</option>
                  {admins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setApproveDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleApprove}
                disabled={approving || !selectedCollection || !selectedAuthor}
              >
                {approving ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Publishing...
                  </>
                ) : (
                  'Approve & Publish'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Collection selector modal */}
      <CollectionSelectorModal
        isOpen={collectionModalOpen}
        onClose={() => setCollectionModalOpen(false)}
        onSelect={(collection, path) => {
          setSelectedCollection(collection);
          setCollectionPath(path);
        }}
      />

      {/* Content */}
      {editing ? (
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-4">
          <div>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Article title"
              className="w-full text-3xl font-bold border-0 bg-transparent px-0 py-2 focus:outline-none dark:text-zinc-50 placeholder:text-gray-300 dark:placeholder:text-zinc-600"
            />
          </div>
          <div>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value.slice(0, 255))}
              placeholder="Short description for SEO (optional, max 255 chars)"
              className="w-full text-base border-0 bg-transparent px-0 py-1 focus:outline-none text-gray-500 dark:text-zinc-400 placeholder:text-gray-300 dark:placeholder:text-zinc-600"
            />
          </div>
          <div className="sticky top-[53px] z-10 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm border-b border-gray-100 dark:border-zinc-800 -mx-6 px-6 py-2">
            <EditorToolbar editorView={editorView} />
          </div>
          <div className="min-h-[400px]">
            <Editor
              content={editContent}
              onSaveContent={(updatedContent) => {
                setEditContent(updatedContent);
              }}
              status="idle"
              isCurrentVersion={true}
              currentVersionIndex={0}
              suggestions={[]}
              onEditorReady={(view) => setEditorView(view)}
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
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}
