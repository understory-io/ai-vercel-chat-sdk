import { Artifact } from '@/components/create-artifact';
import { DocumentSkeleton } from '@/components/document-skeleton';
import { Editor } from '@/components/text-editor';
import {
  CopyIcon,
  MessageIcon,
  PenIcon,
  RedoIcon,
  UndoIcon,
} from '@/components/icons';
import { NotionIcon } from '@/components/notion-slack-icons';
import type { Suggestion } from '@/lib/db/schema';
import { toast } from 'sonner';
import { getSuggestions } from '../actions';

interface TextArtifactMetadata {
  suggestions: Array<Suggestion>;
}

export const textArtifact = new Artifact<'text', TextArtifactMetadata>({
  kind: 'text',
  description: 'Useful for text content, like drafting essays and emails.',
  initialize: async ({ documentId, setMetadata }) => {
    const suggestions = await getSuggestions({ documentId });

    setMetadata({
      suggestions,
    });
  },
  onStreamPart: ({ streamPart, setMetadata, setArtifact }) => {
    if (streamPart.type === 'data-suggestion') {
      setMetadata((metadata) => {
        return {
          suggestions: [...metadata.suggestions, streamPart.data],
        };
      });
    }

    // Content is now set directly via data-content event in data-stream-handler
  },
  content: ({
    status,
    content,
    isCurrentVersion,
    currentVersionIndex,
    onSaveContent,
    isLoading,
    metadata,
    isInline,
  }) => {
    if (isLoading) {
      return <DocumentSkeleton artifactKind="text" />;
    }

    return (
      <>
        <div className={`flex flex-col h-full ${isInline ? 'p-4' : 'p-8'}`}>
          <div className="flex flex-col flex-1 w-full max-w-none min-h-0">
            <Editor
              content={content}
              suggestions={metadata ? metadata.suggestions : []}
              isCurrentVersion={isCurrentVersion}
              currentVersionIndex={currentVersionIndex}
              status={status}
              onSaveContent={onSaveContent}
              isInline={isInline}
            />
          </div>

          {metadata?.suggestions && metadata.suggestions.length > 0 ? (
            <div className="md:hidden h-dvh w-12 shrink-0" />
          ) : null}
        </div>
      </>
    );
  },
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: 'View Previous version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('prev');
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'View Next version',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('next');
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: 'Copy to clipboard',
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success('Copied to clipboard!');
      },
    },
    {
      icon: <NotionIcon size={18} />,
      description: 'Export to Notion',
      onClick: async ({ content }) => {
        try {
          // Extract title from first line or use default
          const lines = content.split('\n').filter(line => line.trim());
          const title = lines[0]?.replace(/^#+\s*/, '') || 'Exported Document';
          
          const response = await fetch('/api/notion/export', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title,
              content,
            }),
          });

          const result = await response.json();

          if (result.success) {
            toast.success('Document exported to Notion successfully!');
            if (result.url) {
              // Open the new Notion page
              window.open(result.url, '_blank');
            }
          } else {
            toast.error(`Export failed: ${result.error}`);
          }
        } catch (error) {
          toast.error('Failed to export to Notion');
          console.error('Export error:', error);
        }
      },
    },
  ],
  toolbar: [
    {
      icon: <PenIcon />,
      description: 'Add final polish',
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: 'user',
          parts: [
            {
              type: 'text',
              text: 'Please add final polish and check for grammar, add section titles for better structure, and ensure everything reads smoothly.',
            },
          ],
        });
      },
    },
    {
      icon: <MessageIcon />,
      description: 'Request suggestions',
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: 'user',
          parts: [
            {
              type: 'text',
              text: 'Please add suggestions you have that could improve the writing.',
            },
          ],
        });
      },
    },
  ],
});
