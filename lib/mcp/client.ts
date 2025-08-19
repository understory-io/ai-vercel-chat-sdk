import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { mcpLogger, createPerformanceLogger } from '@/lib/logger';

interface MCPConfig {
  url: string;
  name: string;
}

class MCPClientManager {
  private clients: Map<string, Client> = new Map();
  private connections: Map<string, Promise<void>> = new Map();

  async getClient(config: MCPConfig): Promise<Client> {
    const existingClient = this.clients.get(config.name);
    if (existingClient) {
      return existingClient;
    }

    // Avoid creating multiple concurrent connections to the same server
    if (!this.connections.has(config.name)) {
      this.connections.set(config.name, this.createConnection(config));
    }

    const connection = this.connections.get(config.name);
    if (connection) {
      await connection;
    }
    
    const client = this.clients.get(config.name);
    if (!client) {
      throw new Error(`Failed to create MCP client for ${config.name}`);
    }
    
    return client;
  }

  private async createConnection(config: MCPConfig): Promise<void> {
    const perf = createPerformanceLogger('mcp-client', 'connection');
    
    try {
      mcpLogger.info({
        event: 'mcp_connection_start',
        serverName: config.name,
        serverUrl: config.url
      }, `Starting connection to MCP server: ${config.name}`);

      const transport = new StreamableHTTPClientTransport(new URL(config.url));
      const client = new Client({
        name: 'product-documentation-tool',
        version: '1.0.0',
      }, {
        capabilities: {
          tools: {}
        }
      });

      await client.connect(transport);
      this.clients.set(config.name, client);
      
      const duration = perf.end({
        serverName: config.name,
        success: true
      });

      mcpLogger.info({
        event: 'mcp_connection_success',
        serverName: config.name,
        duration_ms: duration
      }, `Connected to MCP server: ${config.name} in ${duration.toFixed(2)}ms`);
    } catch (error) {
      const duration = perf.error(error as Error, {
        serverName: config.name,
        serverUrl: config.url
      });

      mcpLogger.error({
        event: 'mcp_connection_error',
        serverName: config.name,
        duration_ms: duration,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      }, `Failed to connect to MCP server ${config.name} after ${duration.toFixed(2)}ms: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      throw error;
    }
  }

  async disconnect(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      mcpLogger.info({
        event: 'mcp_disconnect',
        serverName: name
      }, `Disconnecting from MCP server: ${name}`);
      
      await client.close();
      this.clients.delete(name);
      this.connections.delete(name);
      
      mcpLogger.info({
        event: 'mcp_disconnected',
        serverName: name
      }, `Disconnected from MCP server: ${name}`);
    }
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.keys()).map(name => 
      this.disconnect(name)
    );
    await Promise.all(disconnectPromises);
  }
}

// Singleton instance
const mcpClientManager = new MCPClientManager();

// Configuration for your n8n MCP server
export const MCP_CONFIG: MCPConfig = {
  url: 'https://understory-io.app.n8n.cloud/mcp/productDocumentationMCP',
  name: 'product-documentation'
};

// Export the manager and a helper function to get the client
export { mcpClientManager };

export async function getProductDocumentationMCPClient(): Promise<Client> {
  return mcpClientManager.getClient(MCP_CONFIG);
}