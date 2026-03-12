import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createArticleDraft,
  db,
  getArticleDraft,
  getArticleDraftsByUserId,
  updateArticleDraft,
} from '@/lib/db/queries';
import { user as userTable } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notifySlackForReview } from '@/lib/slack/notify-review';

export function registerTools(server: McpServer, userId: string) {
  server.tool(
    'create_draft',
    'Create a new help center article draft',
    {
      title: z.string().describe('Article title'),
      content: z.string().describe('Article content in Markdown'),
      description: z
        .string()
        .optional()
        .describe('Short description (max 255 chars)'),
    },
    async ({ title, content, description }) => {
      const draft = await createArticleDraft({
        userId,
        title: title.trim(),
        content,
        description: description?.slice(0, 255),
      });

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        'https://product-documentation-generator.vercel.app';

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
        .enum(['draft', 'pending_review', 'published', 'discarded'])
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
          content: [
            { type: 'text' as const, text: 'Forbidden: not your draft' },
          ],
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
      description: z
        .string()
        .optional()
        .describe('New description (max 255 chars)'),
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
          content: [
            { type: 'text' as const, text: 'Forbidden: not your draft' },
          ],
          isError: true,
        };
      }
      if (draft.status !== 'draft') {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Cannot edit a ${draft.status} draft`,
            },
          ],
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
    'submit_for_review',
    'Submit a draft for CS team review. Notifies the team in Slack with a link to review the article in the app.',
    {
      id: z.string().uuid().describe('Draft ID'),
      reviewerSlackId: z
        .string()
        .optional()
        .describe(
          'Slack user ID to tag as reviewer in the notification. Use /api/slack/members to list available users.',
        ),
    },
    async ({ id, reviewerSlackId }) => {
      const draft = await getArticleDraft({ id });
      if (!draft) {
        return {
          content: [{ type: 'text' as const, text: 'Draft not found' }],
          isError: true,
        };
      }
      if (draft.userId !== userId) {
        return {
          content: [
            { type: 'text' as const, text: 'Forbidden: not your draft' },
          ],
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

      const now = new Date();
      await updateArticleDraft({
        id: draft.id,
        status: 'pending_review',
        submittedAt: now,
      });

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        'https://product-documentation-generator.vercel.app';

      const reviewUrl = `${baseUrl}/preview/${draft.id}`;

      // Look up user email for the notification
      const [dbUser] = await db
        .select({ email: userTable.email })
        .from(userTable)
        .where(eq(userTable.id, userId));

      // Notify CS in Slack
      const slackResult = await notifySlackForReview({
        title: draft.title,
        submittedBy: dbUser?.email ?? userId,
        reviewUrl,
        reviewerSlackId,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              status: 'pending_review',
              reviewUrl,
              slackNotified: slackResult.ok,
              ...(slackResult.ok ? {} : { slackWarning: slackResult.reason }),
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
          content: [
            { type: 'text' as const, text: 'Forbidden: not your draft' },
          ],
          isError: true,
        };
      }
      if (draft.status !== 'draft' && draft.status !== 'pending_review') {
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
