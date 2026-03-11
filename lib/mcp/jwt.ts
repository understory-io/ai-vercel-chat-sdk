import { SignJWT, jwtVerify } from 'jose';

function getSigningKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not set');
  return new TextEncoder().encode(secret);
}

const ISSUER =
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://product-documentation-generator.vercel.app';

export async function signAccessToken(
  userId: string,
  audience: string,
  scope: string,
): Promise<string> {
  return new SignJWT({ scope })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(getSigningKey());
}

export async function verifyAccessToken(
  token: string,
  expectedAudience: string,
): Promise<{ sub: string; scope: string }> {
  const { payload } = await jwtVerify(token, getSigningKey(), {
    issuer: ISSUER,
    audience: expectedAudience,
  });

  if (!payload.sub) throw new Error('Token missing sub claim');

  return {
    sub: payload.sub,
    scope: (payload.scope as string) || '',
  };
}
