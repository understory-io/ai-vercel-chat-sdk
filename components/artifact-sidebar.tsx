'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useArtifact } from '@/hooks/use-artifact';
import { Loader2, X, Copy } from 'lucide-react';
import { Editor } from '@/components/text-editor';
import { toast } from 'sonner';
import useSWR, { useSWRConfig } from 'swr';
import type { Document } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { useRef } from 'react';

const ARTIFACT_SIDEBAR_WIDTH = '50%';

export function ArtifactSidebar() {
  const { artifact, setArtifact } = useArtifact();
  const { mutate } = useSWRConfig();

  const { data: documents } = useSWR<Array<Document>>(
    artifact?.documentId && artifact.documentId !== 'init'
      ? `/api/document?id=${artifact.documentId}`
      : null,
    fetcher,
  );

  const latestDocument = useMemo(
    () => (documents && documents.length > 0 ? documents.at(-1)! : null),
    [documents],
  );

  const [isContentDirty, setIsContentDirty] = useState(false);

  const handleTitleChange = (newTitle: string) => {
    if (artifact?.status === 'streaming') return; // Prevent editing while AI is streaming

    setArtifact((current) => ({
      ...current,
      title: newTitle,
    }));

    // Debounced save for title-only changes as well
    scheduleSave(artifact.content, newTitle);
  };

  const handleContentChange = useCallback(
    async (updatedContent: string, updatedTitle?: string) => {
      if (!artifact?.documentId) return;

      setIsContentDirty(true);

      await mutate(
        `/api/document?id=${artifact.documentId}`,
        async (currentDocuments?: Array<Document>) => {
          if (!currentDocuments || currentDocuments.length === 0) return currentDocuments;

          const currentDocument = currentDocuments.at(-1)!;
          const incomingTitle = updatedTitle ?? artifact.title;

          const contentChanged = (currentDocument.content ?? '') !== updatedContent;
          const titleChanged = (currentDocument.title ?? '') !== incomingTitle;

          if (!contentChanged && !titleChanged) {
            setIsContentDirty(false);
            return currentDocuments;
          }

          await fetch(`/api/document?id=${artifact.documentId}`, {
            method: 'POST',
            body: JSON.stringify({
              title: incomingTitle,
              content: updatedContent,
              kind: artifact.kind,
            }),
          });

          setIsContentDirty(false);

          const newDocument: Document = {
            ...currentDocument,
            title: incomingTitle,
            content: updatedContent,
            createdAt: new Date(),
          } as Document;

          return [...currentDocuments, newDocument];
        },
        { revalidate: false },
      );
    },
    [artifact, mutate],
  );

  // Stable debounced scheduler to avoid saving on every keystroke
  const saveTimerRef = useRef<number | null>(null);
  const scheduleSave = useCallback(
    (content: string, title?: string) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      setIsContentDirty(true);

      saveTimerRef.current = window.setTimeout(() => {
        handleContentChange(content, title);
      }, 1500);
    },
    [handleContentChange],
  );

  // Clear pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    // Flush pending changes before closing
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      void handleContentChange(artifact.content, artifact.title);
    }

    setArtifact((current) => ({
      ...current,
      isVisible: false,
    }));
  };


  if (!artifact?.isVisible) {
    return null;
  }

  if (!artifact || artifact.documentId === 'init') {
    return (
      <div
        className="h-full bg-background border-l border-border flex flex-col overscroll-contain"
        style={{ width: ARTIFACT_SIDEBAR_WIDTH }}
      >
        <div className="h-14 px-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-medium">Artifact</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="size-8 p-0"
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const isStreaming = artifact.status === 'streaming';

  return (
    <div
      className="h-full min-h-0 bg-background border-l border-border flex flex-col transition-all duration-200 ease-out overscroll-contain animate-in slide-in-from-right-full"
      style={{ width: ARTIFACT_SIDEBAR_WIDTH }}
    >
      {/* Header */}
      <div className="h-14 px-4 border-b border-border flex items-center justify-between">
        <input
          type="text"
          value={artifact.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          disabled={isStreaming}
          className={`text-lg font-medium bg-transparent border-none outline-none flex-1 mr-2 ${
            isStreaming ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          placeholder="Artifact title..."
        />
        <div className="flex items-center gap-2">
          {/* Copy Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(artifact.content);
              toast.success('Copied to clipboard!');
            }}
            disabled={isStreaming}
            className="size-8 p-0"
            title="Copy to clipboard"
          >
            <Copy className="size-4" />
          </Button>

          {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="size-8 p-0"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Streaming Status Banner */}
      {isStreaming && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-blue-800 text-sm flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          AI is generating content... (editing disabled)
        </div>
      )}

      {/* Content Area */}
      <div
        className="flex-1 min-h-0 flex flex-col h-full overflow-y-auto custom-scrollbar"
        data-testid="artifact-scroll-container"
        style={{ WebkitOverflowScrolling: 'touch' as any }}
      >
        <Editor
          content={artifact.content || latestDocument?.content || ''}
          isCurrentVersion={true}
          currentVersionIndex={0}
          status={artifact.status}
          onSaveContent={(content, debounce) => {
            setArtifact((current) => ({
              ...current,
              content,
            }));

            if (debounce) {
              scheduleSave(content);
            } else {
              handleContentChange(content);
            }
          }}
          suggestions={[]}
          isInline={true}
        />
      </div>


    </div>
  );
}
