'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/toast';

export function PreviewActions({
  draftId,
  status,
}: {
  draftId: string;
  status: string;
}) {
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(status);

  async function handlePublish() {
    setPublishing(true);
    try {
      const res = await fetch(`/api/drafts/${draftId}/publish`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentStatus('published');
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
    setDiscarding(true);
    try {
      const res = await fetch(`/api/drafts/${draftId}/discard`, {
        method: 'POST',
      });
      if (res.ok) {
        setCurrentStatus('discarded');
        toast({ type: 'success', description: 'Draft discarded' });
      }
    } finally {
      setDiscarding(false);
    }
  }

  if (currentStatus === 'published') {
    return (
      <span className="text-sm text-green-600 dark:text-green-400">
        Published to Intercom
      </span>
    );
  }

  if (currentStatus === 'discarded') {
    return <span className="text-sm text-gray-400">Discarded</span>;
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleDiscard}
        disabled={discarding}
        className="text-gray-500"
      >
        {discarding ? 'Discarding...' : 'Discard'}
      </Button>
      <Button size="sm" onClick={handlePublish} disabled={publishing}>
        {publishing ? 'Publishing...' : 'Publish to Intercom'}
      </Button>
    </div>
  );
}
