import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from './tools';

export function createMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: 'article-drafts',
    version: '1.0.0',
  });

  registerTools(server, userId);

  return server;
}
