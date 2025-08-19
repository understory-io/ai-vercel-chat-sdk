import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

interface MCPConfig {
  url: string;
  name: string;
}

class MCPClientManager {
  private clients: Map<string, Client> = new Map();
  private connections: Map<string, Promise<void>> = new Map();

  async getClient(config: MCPConfig): Promise<Client> {
    if (this.clients.has(config.name)) {
      return this.clients.get(config.name)!;
    }

    // Avoid creating multiple concurrent connections to the same server
    if (!this.connections.has(config.name)) {
      this.connections.set(config.name, this.createConnection(config));
    }

    await this.connections.get(config.name);
    return this.clients.get(config.name)!;
  }

  private async createConnection(config: MCPConfig): Promise<void> {
    try {
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
      console.log(`Connected to MCP server: ${config.name}`);
    } catch (error) {
      console.error(`Failed to connect to MCP server ${config.name}:`, error);
      throw error;
    }
  }

  async disconnect(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.close();
      this.clients.delete(name);
      this.connections.delete(name);
      console.log(`Disconnected from MCP server: ${name}`);
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