import { expect, test } from '@playwright/test';
import { request as playwrightRequest } from '@playwright/test';
import {
  createTestUserWithApiKey,
  createApiContext,
  createRevokedApiKey,
  createExpiredApiKey,
  cleanupTestUser,
} from '../helpers-api';

const baseURL = `http://localhost:${process.env.PORT || 3000}`;

let userId: string;
let validApiKey: string;
let revokedApiKey: string;
let expiredApiKey: string;

test.describe.serial('API Key Authentication', () => {
  test.beforeAll(async ({ request }) => {
    const result = await createTestUserWithApiKey({
      name: 'auth-test',
      request,
    });
    userId = result.userId;
    validApiKey = result.apiKey;

    revokedApiKey = await createRevokedApiKey(userId);
    expiredApiKey = await createExpiredApiKey(userId);
  });

  test.afterAll(async () => {
    await cleanupTestUser(userId);
  });

  test('Valid API key can access protected endpoints', async () => {
    const ctx = await createApiContext(validApiKey);
    try {
      const res = await ctx.get('/api/drafts');
      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.drafts).toBeInstanceOf(Array);
    } finally {
      await ctx.dispose();
    }
  });

  test('Revoked API key is rejected with 401', async () => {
    const ctx = await createApiContext(revokedApiKey);
    try {
      const res = await ctx.get('/api/drafts');
      expect(res.status()).toBe(401);

      const body = await res.json();
      expect(body.error).toContain('Invalid API key');
    } finally {
      await ctx.dispose();
    }
  });

  test('Expired API key is rejected with 401', async () => {
    const ctx = await createApiContext(expiredApiKey);
    try {
      const res = await ctx.get('/api/drafts');
      expect(res.status()).toBe(401);

      const body = await res.json();
      expect(body.error).toContain('Invalid API key');
    } finally {
      await ctx.dispose();
    }
  });

  test('Request without any auth is rejected with 401', async () => {
    const ctx = await playwrightRequest.newContext({
      baseURL,
      extraHTTPHeaders: { 'Content-Type': 'application/json' },
    });
    try {
      const res = await ctx.get('/api/drafts');
      expect(res.status()).toBe(401);

      const body = await res.json();
      expect(body.error).toBe('Unauthorized');
    } finally {
      await ctx.dispose();
    }
  });

  test('Request with invalid Bearer token is rejected with 401', async () => {
    const ctx = await createApiContext('sk_this_is_completely_fake_and_invalid_key_12345');
    try {
      const res = await ctx.get('/api/drafts');
      expect(res.status()).toBe(401);

      const body = await res.json();
      expect(body.error).toContain('Invalid API key');
    } finally {
      await ctx.dispose();
    }
  });

  test('Request with malformed Authorization header is rejected', async () => {
    const ctx = await playwrightRequest.newContext({
      baseURL,
      extraHTTPHeaders: {
        Authorization: 'Basic dXNlcjpwYXNz', // Basic auth, not Bearer
        'Content-Type': 'application/json',
      },
    });
    try {
      const res = await ctx.get('/api/drafts');
      expect(res.status()).toBe(401);
    } finally {
      await ctx.dispose();
    }
  });

  test('API key auth works for creating drafts', async () => {
    const ctx = await createApiContext(validApiKey);
    try {
      const res = await ctx.post('/api/drafts', {
        data: {
          title: 'Created via API key',
          content: '# API Key Test\n\nCreated programmatically.',
        },
      });

      expect(res.status()).toBe(200);

      const body = await res.json();
      expect(body.id).toBeTruthy();
      expect(body.previewUrl).toBeTruthy();
    } finally {
      await ctx.dispose();
    }
  });

  test('API key auth correctly identifies the user', async () => {
    const ctx = await createApiContext(validApiKey);
    try {
      // Create a draft
      const createRes = await ctx.post('/api/drafts', {
        data: {
          title: 'Identity Check',
          content: 'Verifying user identity.',
        },
      });
      const { id } = await createRes.json();

      // Fetch it back — should work because same user
      const getRes = await ctx.get(`/api/drafts/${id}`);
      expect(getRes.status()).toBe(200);

      const draft = await getRes.json();
      expect(draft.userId).toBe(userId);
    } finally {
      await ctx.dispose();
    }
  });

  test('Two different users with API keys are isolated', async ({ request }) => {
    // Create a second user
    const user2 = await createTestUserWithApiKey({
      name: 'auth-test-2',
      request,
    });
    const ctx1 = await createApiContext(validApiKey);
    const ctx2 = await createApiContext(user2.apiKey);

    try {
      // User 1 creates a draft
      const createRes = await ctx1.post('/api/drafts', {
        data: {
          title: 'User 1 Private Draft',
          content: 'Only user 1 should see this.',
        },
      });
      const { id } = await createRes.json();

      // User 2 cannot access it
      const getRes = await ctx2.get(`/api/drafts/${id}`);
      expect(getRes.status()).toBe(403);

      // User 2 cannot update it
      const patchRes = await ctx2.patch(`/api/drafts/${id}`, {
        data: { title: 'Hijacked' },
      });
      expect(patchRes.status()).toBe(403);

      // User 2 cannot discard it
      const discardRes = await ctx2.post(`/api/drafts/${id}/discard`);
      expect(discardRes.status()).toBe(403);
    } finally {
      await ctx1.dispose();
      await ctx2.dispose();
      await cleanupTestUser(user2.userId);
    }
  });
});
