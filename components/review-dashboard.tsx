'use client';

import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface ReviewDraft {
  id: string;
  title: string;
  description: string | null;
  status: string;
  userId: string;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  authorName: string | null;
  authorEmail: string;
  reviewResult: string | null;
  reviewedAt: Date | null;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function statusBadge(draft: ReviewDraft) {
  if (draft.status === 'published') {
    return {
      label: 'Approved',
      className:
        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    };
  }
  if (draft.status === 'pending_review') {
    return {
      label: 'Pending Review',
      className:
        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    };
  }
  if (draft.reviewResult === 'changes_requested') {
    return {
      label: 'Changes Requested',
      className:
        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    };
  }
  return {
    label: 'Draft',
    className:
      'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400',
  };
}

function ArticleCard({ draft }: { draft: ReviewDraft }) {
  const badge = statusBadge(draft);
  const relevantDate = draft.submittedAt || draft.updatedAt || draft.createdAt;

  return (
    <Link
      href={`/preview/${draft.id}`}
      className="block border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-zinc-900 dark:border-zinc-800 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-medium dark:text-zinc-100">{draft.title}</h3>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>
      {draft.description && (
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1 line-clamp-2">
          {draft.description}
        </p>
      )}
      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400 dark:text-zinc-500">
        <span>{draft.authorName || draft.authorEmail}</span>
        <span>&middot;</span>
        <span>{timeAgo(relevantDate)}</span>
      </div>
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-gray-400 dark:text-zinc-500 text-sm">
      {message}
    </div>
  );
}

export function ReviewDashboard({ drafts }: { drafts: ReviewDraft[] }) {
  const pending = drafts.filter((d) => d.status === 'pending_review');
  const approved = drafts.filter((d) => d.status === 'published');
  const changesRequested = drafts.filter(
    (d) => d.reviewResult === 'changes_requested' && d.status === 'draft',
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b dark:border-zinc-800">
        <h1 className="text-lg font-semibold dark:text-zinc-50">
          Articles for Review
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <Tabs defaultValue="timeline" className="max-w-2xl">
          <TabsList>
            <TabsTrigger value="timeline">
              Timeline
              {drafts.length > 0 && (
                <span className="ml-1.5 text-xs opacity-60">
                  {drafts.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending
              {pending.length > 0 && (
                <span className="ml-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {pending.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved
              {approved.length > 0 && (
                <span className="ml-1.5 text-xs opacity-60">
                  {approved.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="changes-requested">
              Changes Requested
              {changesRequested.length > 0 && (
                <span className="ml-1.5 text-xs opacity-60">
                  {changesRequested.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline">
            {drafts.length === 0 ? (
              <EmptyState message="No articles have been submitted for review yet" />
            ) : (
              <div className="space-y-3 mt-2">
                {drafts.map((draft) => (
                  <ArticleCard key={draft.id} draft={draft} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending">
            {pending.length === 0 ? (
              <EmptyState message="No articles pending review" />
            ) : (
              <div className="space-y-3 mt-2">
                {pending.map((draft) => (
                  <ArticleCard key={draft.id} draft={draft} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="approved">
            {approved.length === 0 ? (
              <EmptyState message="No approved articles yet" />
            ) : (
              <div className="space-y-3 mt-2">
                {approved.map((draft) => (
                  <ArticleCard key={draft.id} draft={draft} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="changes-requested">
            {changesRequested.length === 0 ? (
              <EmptyState message="No articles with changes requested" />
            ) : (
              <div className="space-y-3 mt-2">
                {changesRequested.map((draft) => (
                  <ArticleCard key={draft.id} draft={draft} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
