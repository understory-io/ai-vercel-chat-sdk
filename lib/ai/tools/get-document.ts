import { tool } from 'ai';
import { z } from 'zod';
import { getDocumentById } from '@/lib/db/queries';

export const getDocument = () =>
  tool({
    description: 'Get the current content of a document to understand what is written before making updates.',
    inputSchema: z.object({
      id: z.string().describe('The ID of the document to retrieve'),
    }),
    execute: async ({ id }) => {
      const document = await getDocumentById({ id });

      if (!document) {
        return {
          error: 'Document not found',
        };
      }

      return {
        id: document.id,
        title: document.title,
        kind: document.kind,
        content: document.content || '',
        createdAt: document.createdAt,
      };
    },
  });