import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMcpServer } from '@/lib/mcp/server';
import { verifyAccessToken } from '@/lib/mcp/jwt';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://product-documentation-generator.vercel.app';
const RESOURCE_METADATA_URL = `${BASE_URL}/.well-known/oauth-protected-resource`;

function unauthorizedResponse() {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Unauthorized' },
      id: null,
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer resource_metadata="${RESOURCE_METADATA_URL}"`,
      },
    },
  );
}

async function handleMcpRequest(req: Request): Promise<Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return unauthorizedResponse();
  }

  const token = authHeader.slice(7);
  let userId: string;

  try {
    const payload = await verifyAccessToken(token, `${BASE_URL}/api/mcp`);
    userId = payload.sub;
  } catch {
    return unauthorizedResponse();
  }

  const server = createMcpServer(userId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  try {
    const response = await transport.handleRequest(req);
    return response;
  } finally {
    await transport.close();
    await server.close();
  }
}

export async function GET() {
  // Stateless server — no server-initiated notifications, so no SSE stream needed.
  // Return 405 to stop the client from polling.
  return new Response(null, { status: 405 });
}

export async function POST(req: Request) {
  return handleMcpRequest(req);
}

export async function DELETE(req: Request) {
  return handleMcpRequest(req);
}
