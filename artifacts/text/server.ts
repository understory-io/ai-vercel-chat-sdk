import { createDocumentHandler } from '@/lib/artifacts/server';

export const textDocumentHandler = createDocumentHandler<'text'>({
  kind: 'text',
  onCreateDocument: async ({ title, dataStream, session, content }) => {
    // Content should always be provided now with the simplified approach
    if (!content) {
      throw new Error('Content is required for text document creation');
    }
    
    return content;
  },
  onUpdateDocument: async ({ document, description, dataStream, content }) => {
    // Content should always be provided now with the simplified approach
    if (!content) {
      throw new Error('Content is required for text document updates');
    }
    
    return content;
  },
});
