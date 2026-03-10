import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createArticleDraft,
  getArticleDraft,
  getArticleDraftsByUserId,
  updateArticleDraft,
} from '@/lib/db/queries';
import { markdownToHtml } from '@/lib/intercom/markdown-to-html';

export function registerTools(server: McpServer, userId: string) {
  server.tool(
    'create_draft',
    'Create a new help center article draft',
    {
      title: z.string().describe('Article title'),
      content: z.string().describe('Article content in Markdown'),
      description: z.string().optional().describe('Short description (max 255 chars)'),
    },
    async ({ title, content, description }) => {
      const draft = await createArticleDraft({
        userId,
        title: title.trim(),
        content,
        description: description?.slice(0, 255),
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://product-documentation-generator.vercel.app';

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              id: draft.id,
              title: draft.title,
              status: draft.status,
              previewUrl: `${baseUrl}/preview/${draft.id}?watch=true`,
              createdAt: draft.createdAt,
            }),
          },
        ],
      };
    },
  );

  server.tool(
    'list_drafts',
    'List your article drafts',
    {
      status: z
        .enum(['draft', 'published', 'discarded'])
        .optional()
        .describe('Filter by status'),
    },
    async ({ status }) => {
      const drafts = await getArticleDraftsByUserId({ userId });
      const filtered = status
        ? drafts.filter((d) => d.status === status)
        : drafts;

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              filtered.map((d) => ({
                id: d.id,
                title: d.title,
                status: d.status,
                description: d.description,
                createdAt: d.createdAt,
                updatedAt: d.updatedAt,
              })),
            ),
          },
        ],
      };
    },
  );

  server.tool(
    'get_draft',
    'Get a specific article draft by ID',
    {
      id: z.string().uuid().describe('Draft ID'),
    },
    async ({ id }) => {
      const draft = await getArticleDraft({ id });
      if (!draft) {
        return {
          content: [{ type: 'text' as const, text: 'Draft not found' }],
          isError: true,
        };
      }
      if (draft.userId !== userId) {
        return {
          content: [{ type: 'text' as const, text: 'Forbidden: not your draft' }],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              id: draft.id,
              title: draft.title,
              content: draft.content,
              description: draft.description,
              status: draft.status,
              intercomArticleId: draft.intercomArticleId,
              createdAt: draft.createdAt,
              updatedAt: draft.updatedAt,
            }),
          },
        ],
      };
    },
  );

  server.tool(
    'update_draft',
    'Update an existing article draft',
    {
      id: z.string().uuid().describe('Draft ID'),
      title: z.string().optional().describe('New title'),
      content: z.string().optional().describe('New content in Markdown'),
      description: z.string().optional().describe('New description (max 255 chars)'),
    },
    async ({ id, title, content, description }) => {
      const draft = await getArticleDraft({ id });
      if (!draft) {
        return {
          content: [{ type: 'text' as const, text: 'Draft not found' }],
          isError: true,
        };
      }
      if (draft.userId !== userId) {
        return {
          content: [{ type: 'text' as const, text: 'Forbidden: not your draft' }],
          isError: true,
        };
      }
      if (draft.status === 'discarded') {
        return {
          content: [{ type: 'text' as const, text: 'Cannot edit a discarded draft' }],
          isError: true,
        };
      }

      const updated = await updateArticleDraft({
        id,
        title: title?.trim(),
        content,
        description: description?.slice(0, 255),
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              id: updated.id,
              title: updated.title,
              status: updated.status,
              updatedAt: updated.updatedAt,
            }),
          },
        ],
      };
    },
  );

  server.tool(
    'publish_draft',
    'Publish a draft to Intercom as a help center article',
    {
      id: z.string().uuid().describe('Draft ID'),
      collectionId: z.string().optional().describe('Intercom collection ID to place article in'),
      authorId: z.string().optional().describe('Intercom admin ID to set as author'),
      description: z.string().optional().describe('Override description for the published article'),
    },
    async ({ id, collectionId, authorId, description }) => {
      const draft = await getArticleDraft({ id });
      if (!draft) {
        return {
          content: [{ type: 'text' as const, text: 'Draft not found' }],
          isError: true,
        };
      }
      if (draft.userId !== userId) {
        return {
          content: [{ type: 'text' as const, text: 'Forbidden: not your draft' }],
          isError: true,
        };
      }
      if (draft.status !== 'draft') {
        return {
          content: [
            { type: 'text' as const, text: `Draft is already ${draft.status}` },
          ],
          isError: true,
        };
      }

      const accessToken = process.env.INTERCOM_ACCESS_TOKEN;
      const workspaceId = process.env.INTERCOM_WORKSPACE_ID;

      if (!accessToken || !workspaceId) {
        return {
          content: [{ type: 'text' as const, text: 'Intercom not configured' }],
          isError: true,
        };
      }

      const finalDescription = (description ?? draft.description)?.slice(0, 255);

      let resolvedAuthorId = authorId ? Number.parseInt(authorId) : undefined;

      if (!resolvedAuthorId) {
        const adminsRes = await fetch('https://api.intercom.io/admins', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'Intercom-Version': '2.14',
          },
        });

        if (adminsRes.ok) {
          const adminsData = await adminsRes.json();
          const admins = adminsData.admins || [];
          if (admins.length > 0) {
            resolvedAuthorId = admins[0].id;
          }
        }

        if (!resolvedAuthorId) {
          return {
            content: [
              { type: 'text' as const, text: 'No Intercom admin found to set as author' },
            ],
            isError: true,
          };
        }
      }

      const htmlContent = await markdownToHtml(draft.content);

      const articlePayload: Record<string, unknown> = {
        title: draft.title,
        body: htmlContent,
        author_id: resolvedAuthorId,
        state: 'draft',
      };

      if (collectionId) {
        articlePayload.parent_type = 'collection';
        articlePayload.parent_id = Number.parseInt(collectionId);
      }

      if (finalDescription) {
        articlePayload.description = finalDescription;
      }

      const response = await fetch('https://api.intercom.io/articles', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Intercom-Version': '2.14',
        },
        body: JSON.stringify(articlePayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to publish to Intercom: ${JSON.stringify(errorData)}`,
            },
          ],
          isError: true,
        };
      }

      const articleData = await response.json();

      await updateArticleDraft({
        id: draft.id,
        status: 'published',
        intercomArticleId: String(articleData.id),
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              intercomArticleId: articleData.id,
              intercomUrl: `https://app.intercom.com/a/apps/${workspaceId}/articles/${articleData.id}`,
            }),
          },
        ],
      };
    },
  );

  server.tool(
    'discard_draft',
    'Discard an article draft',
    {
      id: z.string().uuid().describe('Draft ID'),
    },
    async ({ id }) => {
      const draft = await getArticleDraft({ id });
      if (!draft) {
        return {
          content: [{ type: 'text' as const, text: 'Draft not found' }],
          isError: true,
        };
      }
      if (draft.userId !== userId) {
        return {
          content: [{ type: 'text' as const, text: 'Forbidden: not your draft' }],
          isError: true,
        };
      }
      if (draft.status !== 'draft') {
        return {
          content: [
            { type: 'text' as const, text: `Draft is already ${draft.status}` },
          ],
          isError: true,
        };
      }

      await updateArticleDraft({ id, status: 'discarded' });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ success: true, id, status: 'discarded' }),
          },
        ],
      };
    },
  );
}
