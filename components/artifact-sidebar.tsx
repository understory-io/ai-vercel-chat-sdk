'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useArtifact } from '@/hooks/use-artifact';
import { Save, Loader2, Eye, Edit3, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ArtifactActions } from './artifact-actions';
import { formatDistance } from 'date-fns';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import type { Document } from '@/lib/db/schema';

const ARTIFACT_SIDEBAR_WIDTH = '50%';

export function ArtifactSidebar() {
  const { artifact, setArtifact } = useArtifact();
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch document versions if artifact exists
  const { data: documents, isLoading: isDocumentsFetching } = useSWR<
    Array<Document>
  >(
    artifact &&
      artifact.documentId !== 'init' &&
      artifact.status !== 'streaming'
      ? `/api/document?id=${artifact.documentId}`
      : null,
    fetcher,
  );

  // Auto-resize textarea with max height constraint
  useEffect(() => {
    if (textareaRef.current && !isPreviewMode) {
      textareaRef.current.style.height = 'auto';
      const maxHeight = window.innerHeight - 300; // Reserve space for header and footer
      const newHeight = Math.min(textareaRef.current.scrollHeight, maxHeight);
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [artifact?.content, isPreviewMode]);

  const handleContentChange = (newContent: string) => {
    if (artifact?.status === 'streaming') return; // Prevent editing while AI is streaming

    setArtifact((current) => ({
      ...current,
      content: newContent,
    }));
  };

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

  const formatStats = (content: string) => {
    const words = content.split(/\s+/).filter((word) => word.length > 0).length;
    const chars = content.length;
    return { words, chars };
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
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const { words, chars } = formatStats(artifact.content);
  const isStreaming = artifact.status === 'streaming';
  const mostRecentDocument = documents?.at(-1);

  return (
    <div
      className="h-full bg-background border-l border-border flex flex-col transition-all duration-300 ease-in-out overscroll-contain"
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
          {/* Preview/Edit Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            disabled={isStreaming}
            className="h-8 w-8 p-0"
            title={isPreviewMode ? 'Edit' : 'Preview'}
          >
            {isPreviewMode ? (
              <Edit3 className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </Button>

          {/* Save Status */}
          <div className="flex items-center gap-1">
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            ) : (
              <Save className="w-4 h-4 text-green-500" />
            )}
          </div>

          {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Streaming Status Banner */}
      {isStreaming && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-blue-800 text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          AI is generating content... (editing disabled)
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full p-4 overflow-y-auto overscroll-contain custom-scrollbar">
          {isPreviewMode ? (
            // Preview Mode - Rendered Markdown
            <div className="prose prose-gray max-w-none prose-sm">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-2xl font-bold mb-3 text-foreground">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xl font-semibold mb-2 text-foreground">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-lg font-medium mb-2 text-foreground">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-3 text-muted-foreground leading-relaxed">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="mb-3 ml-4 list-disc text-muted-foreground">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="mb-3 ml-4 list-decimal text-muted-foreground">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-border pl-3 italic text-muted-foreground mb-3">
                      {children}
                    </blockquote>
                  ),
                  code: ({ children }) => (
                    <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="bg-muted p-3 rounded-lg overflow-x-auto mb-3 text-sm">
                      {children}
                    </pre>
                  ),
                }}
              >
                {artifact.content || '*Start writing...*'}
              </ReactMarkdown>
            </div>
          ) : (
            // Edit Mode - Textarea
            <Textarea
              ref={textareaRef}
              value={artifact.content}
              onChange={(e) => handleContentChange(e.target.value)}
              disabled={isStreaming}
              className={`w-full min-h-[400px] border-none resize-none text-sm leading-relaxed bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 custom-scrollbar ${
                isStreaming ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              placeholder="Start writing..."
              style={{
                height: 'auto',
                minHeight: '400px',
                maxHeight: 'calc(100vh - 300px)',
              }}
            />
          )}
        </div>
      </div>

      {/* Actions Bar */}
      {documents && documents.length > 0 && (
        <div className="px-4 py-2 border-t border-border">
          <ArtifactActions
            artifact={artifact}
            handleVersionChange={() => {}} // TODO: Implement version handling
            currentVersionIndex={documents.length - 1}
            isCurrentVersion={true}
            mode="edit"
            metadata={{}}
            setMetadata={() => {}}
          />
        </div>
      )}

      {/* Footer Stats */}
      <div className="px-4 py-2 border-t border-border bg-muted/10">
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>Words: {words}</span>
          <span>Characters: {chars}</span>
          {mostRecentDocument && (
            <span>
              Updated{' '}
              {formatDistance(
                new Date(mostRecentDocument.createdAt),
                new Date(),
                {
                  addSuffix: true,
                },
              )}
            </span>
          )}
          <span>{isStreaming ? 'AI generating...' : 'Ready'}</span>
        </div>
      </div>
    </div>
  );
}
