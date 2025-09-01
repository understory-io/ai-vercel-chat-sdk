'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { useArtifact } from '@/hooks/use-artifact';
import { Save, Loader2, X, Copy } from 'lucide-react';
import { Editor } from '@/components/text-editor';
import { toast } from 'sonner';

const ARTIFACT_SIDEBAR_WIDTH = '50%';

export function ArtifactSidebar() {
  const { artifact, setArtifact } = useArtifact();

  const handleTitleChange = (newTitle: string) => {
    if (artifact?.status === 'streaming') return; // Prevent editing while AI is streaming

    setArtifact((current) => ({
      ...current,
      title: newTitle,
    }));
  };

  const handleClose = () => {
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
      className="h-full bg-background border-l border-border flex flex-col transition-all duration-200 ease-out overscroll-contain animate-in slide-in-from-right-full"
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
          {/* Save Status */}
          <div className="flex items-center gap-1">
            {isStreaming ? (
              <Loader2 className="size-4 animate-spin text-blue-500" />
            ) : (
              <Save className="size-4 text-green-500" />
            )}
          </div>

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
      <div className="flex-1 min-h-0 flex flex-col h-full">
        <Editor
          content={artifact.content || ''}
          isCurrentVersion={true}
          currentVersionIndex={0}
          status={artifact.status}
          onSaveContent={(content) => {
            setArtifact((current) => ({
              ...current,
              content,
            }));
          }}
          suggestions={[]}
          isInline={true}
        />
      </div>


    </div>
  );
}
