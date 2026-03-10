import { auth } from '@/app/(auth)/auth';
import { generateApiKey, hashApiKey, getKeyPrefix } from '@/lib/api-key';
import {
  createApiKeyRecord,
  getApiKeysByUserId,
  revokeApiKey,
} from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const keys = await getApiKeysByUserId({ userId: session.user.id });

  return Response.json(
    keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      createdAt: k.createdAt,
      expiresAt: k.expiresAt,
      lastUsedAt: k.lastUsedAt,
      revokedAt: k.revokedAt,
    })),
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const body = await request.json();
  const name = body.name?.trim();

  if (!name || name.length === 0) {
    return Response.json({ error: 'Name is required' }, { status: 400 });
  }

  const plainKey = generateApiKey();
  const keyHash = hashApiKey(plainKey);
  const keyPrefix = getKeyPrefix(plainKey);

  const record = await createApiKeyRecord({
    userId: session.user.id,
    name,
    keyHash,
    keyPrefix,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
  });

  // Return the full plaintext key — this is the only time it's shown
  return Response.json({
    id: record.id,
    name: record.name,
    keyPrefix: record.keyPrefix,
    key: plainKey,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
  });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return Response.json({ error: 'Key ID is required' }, { status: 400 });
  }

  const result = await revokeApiKey({ id, userId: session.user.id });

  if (!result) {
    return Response.json({ error: 'Key not found' }, { status: 404 });
  }

  return Response.json({ success: true });
}
