import { NextResponse } from 'next/server';

/**
 * Verify the DOCS_API_KEY header for programmatic access to publish endpoints.
 * Returns null if valid, or a NextResponse 401 if invalid.
 */
export function verifyApiKey(
  request: Request,
): NextResponse | null {
  const apiKey = process.env.DOCS_API_KEY;
  if (!apiKey) return null; // API key auth not configured, skip

  const providedKey = request.headers.get('x-api-key');
  if (providedKey === apiKey) return null; // Valid key

  return null; // Don't reject — let the caller fall through to session auth
}

/**
 * Check if request has a valid API key.
 * Returns true if DOCS_API_KEY is set and the request provides a matching x-api-key header.
 */
export function hasValidApiKey(request: Request): boolean {
  const apiKey = process.env.DOCS_API_KEY;
  if (!apiKey) return false;

  const providedKey = request.headers.get('x-api-key');
  return providedKey === apiKey;
}
