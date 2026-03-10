import { expect, test } from '@playwright/test';
import {
  createTestUserWithToken,
  createApiContext,
  cleanupTestUser,
} from '../helpers-api';
import type { APIRequestContext } from '@playwright/test';

let aliceUserId: string;
let aliceRequest: APIRequestContext;

let bobUserId: string;
let bobRequest: APIRequestContext;

// Draft IDs created during tests, for cross-test reference
let aliceDraftId: string;

test.describe.serial('/api/drafts', () => {
  test.beforeAll(async ({ request }) => {
    const alice = await createTestUserWithToken({ name: 'alice-drafts', request });
    aliceUserId = alice.userId;
    aliceRequest = await createApiContext(alice.token);

    const bob = await createTestUserWithToken({ name: 'bob-drafts', request });
    bobUserId = bob.userId;
    bobRequest = await createApiContext(bob.token);
  });

  test.afterAll(async () => {
    await aliceRequest.dispose();
    await bobRequest.dispose();
    await cleanupTestUser(aliceUserId);
    await cleanupTestUser(bobUserId);
  });

  // --- CREATE ---

  test('Alice can create a draft', async () => {
    const res = await aliceRequest.post('/api/drafts', {
      data: {
        title: 'Test Article',
        content: '# Hello\n\nThis is a test article.',
        description: 'A test description',
      },
    });

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.previewUrl).toContain(`/preview/${body.id}`);
    expect(body.previewUrl).toContain('watch=true');

    aliceDraftId = body.id;
  });

  test('Cannot create a draft without title', async () => {
    const res = await aliceRequest.post('/api/drafts', {
      data: {
        content: 'Some content',
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('required');
  });

  test('Cannot create a draft without content', async () => {
    const res = await aliceRequest.post('/api/drafts', {
      data: {
        title: 'Missing content',
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('required');
  });

  test('Cannot create a draft with empty title', async () => {
    const res = await aliceRequest.post('/api/drafts', {
      data: {
        title: '   ',
        content: 'Some content',
      },
    });

    expect(res.status()).toBe(400);
  });

  // --- READ ---

  test('Alice can list her drafts', async () => {
    const res = await aliceRequest.get('/api/drafts');

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.drafts).toBeInstanceOf(Array);
    expect(body.drafts.length).toBeGreaterThanOrEqual(1);

    const draft = body.drafts.find(
      (d: { id: string }) => d.id === aliceDraftId,
    );
    expect(draft).toBeTruthy();
    expect(draft.title).toBe('Test Article');
    expect(draft.status).toBe('draft');
  });

  test('Alice can get a specific draft', async () => {
    const res = await aliceRequest.get(`/api/drafts/${aliceDraftId}`);

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(aliceDraftId);
    expect(body.title).toBe('Test Article');
    expect(body.content).toBe('# Hello\n\nThis is a test article.');
    expect(body.description).toBe('A test description');
    expect(body.status).toBe('draft');
  });

  test('Bob cannot see Alice\'s draft list', async () => {
    const res = await bobRequest.get('/api/drafts');

    expect(res.status()).toBe(200);

    const body = await res.json();
    // Bob should have no drafts (or at least not Alice's)
    const aliceDraft = body.drafts.find(
      (d: { id: string }) => d.id === aliceDraftId,
    );
    expect(aliceDraft).toBeUndefined();
  });

  test('Bob cannot get Alice\'s draft by ID', async () => {
    const res = await bobRequest.get(`/api/drafts/${aliceDraftId}`);

    expect(res.status()).toBe(403);
  });

  test('Getting a non-existent draft returns 404', async () => {
    const res = await aliceRequest.get(
      '/api/drafts/00000000-0000-0000-0000-000000000000',
    );

    expect(res.status()).toBe(404);
  });

  // --- UPDATE ---

  test('Alice can update her draft title', async () => {
    const res = await aliceRequest.patch(`/api/drafts/${aliceDraftId}`, {
      data: { title: 'Updated Title' },
    });

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.title).toBe('Updated Title');
    // Content should not change
    expect(body.content).toBe('# Hello\n\nThis is a test article.');
  });

  test('Alice can update her draft content', async () => {
    const res = await aliceRequest.patch(`/api/drafts/${aliceDraftId}`, {
      data: { content: '# Updated\n\nNew content here.' },
    });

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.content).toBe('# Updated\n\nNew content here.');
    expect(body.title).toBe('Updated Title');
  });

  test('Alice can update her draft description', async () => {
    const res = await aliceRequest.patch(`/api/drafts/${aliceDraftId}`, {
      data: { description: 'New description' },
    });

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.description).toBe('New description');
  });

  test('Bob cannot update Alice\'s draft', async () => {
    const res = await bobRequest.patch(`/api/drafts/${aliceDraftId}`, {
      data: { title: 'Hacked by Bob' },
    });

    expect(res.status()).toBe(403);

    // Verify Alice's draft is unchanged
    const check = await aliceRequest.get(`/api/drafts/${aliceDraftId}`);
    const body = await check.json();
    expect(body.title).toBe('Updated Title');
  });

  // --- DISCARD ---

  test('Bob cannot discard Alice\'s draft', async () => {
    const res = await bobRequest.post(`/api/drafts/${aliceDraftId}/discard`);

    expect(res.status()).toBe(403);
  });

  test('Alice can discard her draft', async () => {
    // First create a new draft specifically for discard testing
    const createRes = await aliceRequest.post('/api/drafts', {
      data: {
        title: 'To Be Discarded',
        content: 'This will be discarded.',
      },
    });
    const { id: discardDraftId } = await createRes.json();

    const res = await aliceRequest.post(`/api/drafts/${discardDraftId}/discard`);

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify status changed
    const check = await aliceRequest.get(`/api/drafts/${discardDraftId}`);
    const draft = await check.json();
    expect(draft.status).toBe('discarded');
  });

  test('Cannot discard an already discarded draft', async () => {
    // Create and discard a draft
    const createRes = await aliceRequest.post('/api/drafts', {
      data: {
        title: 'Double Discard',
        content: 'Try to discard twice.',
      },
    });
    const { id } = await createRes.json();

    await aliceRequest.post(`/api/drafts/${id}/discard`);

    // Try to discard again
    const res = await aliceRequest.post(`/api/drafts/${id}/discard`);

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('already');
  });

  test('Cannot edit a discarded draft', async () => {
    // Create and discard
    const createRes = await aliceRequest.post('/api/drafts', {
      data: { title: 'Will Discard', content: 'Content' },
    });
    const { id } = await createRes.json();

    await aliceRequest.post(`/api/drafts/${id}/discard`);

    // Try to edit
    const res = await aliceRequest.patch(`/api/drafts/${id}`, {
      data: { title: 'Edited After Discard' },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('discarded');
  });

  // --- PUBLISH (without Intercom configured — tests the validation path) ---

  test('Bob cannot publish Alice\'s draft', async () => {
    const res = await bobRequest.post(`/api/drafts/${aliceDraftId}/publish`);

    expect(res.status()).toBe(403);
  });

  test('Cannot publish a discarded draft', async () => {
    // Create and discard
    const createRes = await aliceRequest.post('/api/drafts', {
      data: { title: 'Discard Before Publish', content: 'Content' },
    });
    const { id } = await createRes.json();
    await aliceRequest.post(`/api/drafts/${id}/discard`);

    const res = await aliceRequest.post(`/api/drafts/${id}/publish`);

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('already');
  });

  // --- DESCRIPTION LIMITS ---

  test('Description is trimmed to 255 characters on create', async () => {
    const longDesc = 'A'.repeat(300);

    const res = await aliceRequest.post('/api/drafts', {
      data: {
        title: 'Long Description',
        content: 'Content',
        description: longDesc,
      },
    });

    expect(res.status()).toBe(200);

    const { id } = await res.json();
    const check = await aliceRequest.get(`/api/drafts/${id}`);
    const draft = await check.json();
    expect(draft.description.length).toBeLessThanOrEqual(255);
  });
});
