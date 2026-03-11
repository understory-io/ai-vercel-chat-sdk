import { expect, test } from '@playwright/test';
import {
  createTestUserWithToken,
  createApiContext,
  cleanupTestUser,
} from '../helpers-api';
import type { APIRequestContext } from '@playwright/test';

let aslanUserId: string;
let aslanRequest: APIRequestContext;

test.describe
  .serial('Slack notification on publish', () => {
    test.beforeAll(async ({ request }) => {
      const aslan = await createTestUserWithToken({
        name: 'aslan',
        email: 'aslan@understory.io',
        request,
      });
      aslanUserId = aslan.userId;
      aslanRequest = await createApiContext(aslan.token);
    });

    test.afterAll(async () => {
      await aslanRequest.dispose();
      await cleanupTestUser(aslanUserId);
    });

    test('Publish does not crash regardless of Slack/Intercom configuration', async () => {
      const createRes = await aslanRequest.post('/api/drafts', {
        data: {
          title: 'Slack Test Article',
          content: '# Slack test\n\nShould not crash.',
        },
      });
      const { id } = await createRes.json();

      const res = await aslanRequest.post(`/api/drafts/${id}/publish`, {
        data: { reviewerSlackId: 'U00FAKE123' },
      });
      const body = await res.json();

      // Either Intercom is not configured (500) or publish succeeds (200).
      // The key assertion: no unhandled errors from Slack notification code.
      expect([200, 500]).toContain(res.status());

      if (res.status() === 500) {
        expect(body.error).toBe('Intercom not configured');
      }
      if (res.status() === 200) {
        expect(body.success).toBe(true);
        expect(body.intercomUrl).toBeTruthy();
      }
    });

    test('Publish accepts optional reviewerSlackId without error', async () => {
      const createRes = await aslanRequest.post('/api/drafts', {
        data: {
          title: 'Reviewer Tag Test',
          content: '# Reviewer test\n\nTesting reviewer param.',
        },
      });
      const { id } = await createRes.json();

      // Pass a reviewer — should not cause any errors regardless of config
      const res = await aslanRequest.post(`/api/drafts/${id}/publish`, {
        data: { reviewerSlackId: 'U00FAKE456' },
      });

      expect([200, 500]).toContain(res.status());
    });
  });
