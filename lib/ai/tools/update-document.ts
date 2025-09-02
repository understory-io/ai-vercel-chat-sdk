import { tool, type UIMessageStreamWriter } from 'ai';
import type { Session } from 'next-auth';
import { z } from 'zod';
import { getDocumentById } from '@/lib/db/queries';
import { documentHandlersByArtifactKind } from '@/lib/artifacts/server';
import type { ChatMessage } from '@/lib/types';

interface UpdateDocumentProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

export const updateDocument = ({ session, dataStream }: UpdateDocumentProps) =>
  tool({
    description: 'Update a document with new content.',
    inputSchema: z.object({
      id: z.string().describe('The ID of the document to update'),
      content: z.string().describe('The complete new content for the document'),
      title: z.string().optional().describe('Optional new title for the document'),
    }),
    execute: async ({ id, content, title }) => {
      const document = await getDocumentById({ id });

      if (!document) {
        return {
          error: 'Document not found',
        };
      }

      // Update title if provided
      if (title) {
        dataStream.write({
          type: 'data-title',
          data: title,
          transient: true,
        });
      }

      // Set content directly without any streaming simulation
      dataStream.write({
        type: 'data-content',
        data: content,
        transient: true,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === document.kind,
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${document.kind}`);
      }

      // Create updated document with new content
      const updatedDocument = {
        ...document,
        content,
        title: title || document.title,
      };

      await documentHandler.onUpdateDocument({
        document: updatedDocument,
        description: 'Document updated with new content',
        dataStream,
        session,
        content,
      });

      // Send updated notification
      dataStream.write({ type: 'data-updated', data: null, transient: true });

      return {
        id,
        title: title || document.title,
        kind: document.kind,
        content: 'Document updated successfully.',
      };
    },
  });
