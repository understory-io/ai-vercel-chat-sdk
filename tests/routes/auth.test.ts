import { expect, test } from '@playwright/test';
import {
  createTestUserWithToken,
  createApiContext,
  cleanupTestUser,
} from '../helpers-api';
import type { APIRequestContext } from '@playwright/test';
import { request as playwrightRequest } from '@playwright/test';

const baseURL = `http://localhost:${process.env.PORT || 3000}`;

let aliceUserId: string;
let aliceRequest: APIRequestContext;
let aliceDraftId: string;

let unauthRequest: APIRequestContext;

test.describe
  .serial('Auth enforcement', () => {
    test.beforeAll(async ({ request }) => {
      const alice = await createTestUserWithToken({
        name: 'alice-auth',
        request,
      });
      aliceUserId = alice.userId;
      aliceRequest = await createApiContext(alice.token);

      unauthRequest = await playwrightRequest.newContext({
        baseURL,
        extraHTTPHeaders: { 'Content-Type': 'application/json' },
      });

      // Create a draft for publish tests
      const res = await aliceRequest.post('/api/drafts', {
        data: {
          title: 'Auth Test Article',
          content: '# Auth test\n\nContent for auth testing.',
        },
      });
      const body = await res.json();
      aliceDraftId = body.id;
    });

    test.afterAll(async () => {
      await aliceRequest.dispose();
      await unauthRequest.dispose();
      await cleanupTestUser(aliceUserId);
    });

    // --- Unauthenticated access ---

    test('Unauthenticated: cannot list drafts', async () => {
      const res = await unauthRequest.get('/api/drafts');
      expect(res.status()).toBe(401);
    });

    test('Unauthenticated: cannot get a draft', async () => {
      const res = await unauthRequest.get(`/api/drafts/${aliceDraftId}`);
      expect(res.status()).toBe(401);
    });

    test('Unauthenticated: cannot create a draft', async () => {
      const res = await unauthRequest.post('/api/drafts', {
        data: { title: 'Hacker', content: 'Nope' },
      });
      expect(res.status()).toBe(401);
    });

    test('Unauthenticated: cannot update a draft', async () => {
      const res = await unauthRequest.patch(`/api/drafts/${aliceDraftId}`, {
        data: { title: 'Hacked' },
      });
      expect(res.status()).toBe(401);
    });

    test('Unauthenticated: cannot publish a draft', async () => {
      const res = await unauthRequest.post(
        `/api/drafts/${aliceDraftId}/publish`,
      );
      expect(res.status()).toBe(401);
    });

    test('Unauthenticated: cannot discard a draft', async () => {
      const res = await unauthRequest.post(
        `/api/drafts/${aliceDraftId}/discard`,
      );
      expect(res.status()).toBe(401);
    });

    // --- Fake JWT ---

    test('Fake JWT: cannot list drafts', async () => {
      const fakeRequest = await playwrightRequest.newContext({
        baseURL,
        extraHTTPHeaders: {
          Authorization: 'Bearer fake.jwt.token',
          'Content-Type': 'application/json',
        },
      });

      const res = await fakeRequest.get('/api/drafts');
      expect(res.status()).toBe(401);
      await fakeRequest.dispose();
    });

    test('Fake JWT: cannot publish a draft', async () => {
      const fakeRequest = await playwrightRequest.newContext({
        baseURL,
        extraHTTPHeaders: {
          Authorization: 'Bearer fake.jwt.token',
          'Content-Type': 'application/json',
        },
      });

      const res = await fakeRequest.post(`/api/drafts/${aliceDraftId}/publish`);
      expect(res.status()).toBe(401);
      await fakeRequest.dispose();
    });

    // --- MCP endpoint auth ---

    test('Unauthenticated: MCP tools/list is rejected', async () => {
      const res = await unauthRequest.post('/api/mcp', {
        data: {
          jsonrpc: '2.0',
          method: 'tools/list',
          params: {},
          id: 1,
        },
      });
      expect(res.status()).toBe(401);
    });

    test('Unauthenticated: MCP tools/call is rejected', async () => {
      const res = await unauthRequest.post('/api/mcp', {
        data: {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'list_drafts', arguments: {} },
          id: 1,
        },
      });
      expect(res.status()).toBe(401);
    });

    test('Fake JWT: MCP tools/call is rejected', async () => {
      const fakeRequest = await playwrightRequest.newContext({
        baseURL,
        extraHTTPHeaders: {
          Authorization: 'Bearer fake.jwt.token',
          'Content-Type': 'application/json',
        },
      });

      const res = await fakeRequest.post('/api/mcp', {
        data: {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'list_drafts', arguments: {} },
          id: 1,
        },
      });
      expect(res.status()).toBe(401);
      await fakeRequest.dispose();
    });

    // --- Slack members endpoint ---

    test('Unauthenticated: cannot list Slack members', async () => {
      const res = await unauthRequest.get('/api/slack/members');
      expect(res.status()).toBe(401);
    });

    // --- MCP OAuth domain restriction ---

    test('MCP OAuth: unknown client_id is rejected', async () => {
      const res = await unauthRequest.get(
        '/api/mcp/authorize?client_id=unknown&redirect_uri=http://evil.com&code_challenge=test&code_challenge_method=S256&state=test',
      );
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('invalid_client');
    });
  });
