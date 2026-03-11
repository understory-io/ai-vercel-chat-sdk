'use client';

import Link from 'next/link';

interface PendingDraft {
  id: string;
  title: string;
  description: string | null;
  status: string;
  userId: string;
  submittedAt: Date | null;
  createdAt: Date;
  authorName: string | null;
  authorEmail: string;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ReviewDashboard({ drafts }: { drafts: PendingDraft[] }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold dark:text-zinc-50">
            Articles for Review
          </h1>
          {drafts.length > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {drafts.length}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {drafts.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-zinc-500">
            No articles pending review
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {drafts.map((draft) => (
              <Link
                key={draft.id}
                href={`/preview/${draft.id}`}
                className="block border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-zinc-900 dark:border-zinc-800 transition-colors"
              >
                <h3 className="font-medium dark:text-zinc-100">
                  {draft.title}
                </h3>
                {draft.description && (
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1 line-clamp-2">
                    {draft.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400 dark:text-zinc-500">
                  <span>{draft.authorName || draft.authorEmail}</span>
                  <span>·</span>
                  <span>
                    {draft.submittedAt
                      ? timeAgo(new Date(draft.submittedAt))
                      : timeAgo(new Date(draft.createdAt))}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
