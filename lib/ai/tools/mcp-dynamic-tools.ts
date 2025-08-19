import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import { getProductDocumentationMCPClient } from '@/lib/mcp/client';
import type { ChatMessage } from '@/lib/types';

interface MCPToolsProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
}

/**
 * Convert JSON Schema to Zod schema for MCP tools
 * Handles flexible input validation for AI-generated parameters
 */
function convertJsonSchemaToZod(jsonSchema: any): z.ZodType<any> {
  if (!jsonSchema?.properties) {
    return z.object({});
  }

  const properties = jsonSchema.properties;
  const zodProperties: Record<string, z.ZodType<any>> = {};
  
  for (const [key, property] of Object.entries(properties)) {
    const prop = property as any;
    
    // All fields are optional to handle AI's variable parameter sending
    let zodType = z.string().optional().transform(val => {
      if (prop.description?.includes('input: null') && (val === undefined || val === '')) {
        return null;
      }
      return val || '';
    });
    
    if (prop.description) {
      zodType = zodType.describe(prop.description);
    }
    
    zodProperties[key] = zodType;
  }
  
  return z.object(zodProperties);
}

/**
 * Dynamically creates AI SDK tools from MCP server
 * This discovers all available tools from your n8n MCP server and makes them available in the chat
 * When you add new tools to n8n, they automatically appear here without code changes
 */
export async function getMCPTools({ session, dataStream }: MCPToolsProps) {
  try {
    const client = await getProductDocumentationMCPClient();
    
    // Dynamically discover all available tools from the MCP server
    const toolsResponse = await client.listTools();
    const availableTools = toolsResponse.tools || [];
    
    console.log(`Found ${availableTools.length} MCP tools:`, availableTools.map(t => t.name));
    
    // Convert each MCP tool to an AI SDK tool
    const aiTools = availableTools.map((mcpTool: any) => {
      // Convert JSON Schema to Zod schema
      const zodSchema = convertJsonSchemaToZod(mcpTool.inputSchema);
      
      return {
        name: mcpTool.name, // Use the actual MCP tool name
        tool: tool({
          description: mcpTool.description || `Execute MCP tool: ${mcpTool.name}`,
          inputSchema: zodSchema,
          execute: async (args: any) => {
            try {
              console.log(`Executing MCP tool: ${mcpTool.name} with args:`, args);
              
              // Call the MCP tool with the provided arguments
              const result = await client.callTool({
                name: mcpTool.name,
                arguments: args
              });
              
              console.log(`MCP tool ${mcpTool.name} result:`, JSON.stringify(result, null, 2));
              
              // Extract content from the MCP response
              const content = (result.content as any)?.[0]?.text || (result.content as any)?.[0] || 'Tool executed successfully';
              
              return {
                success: true,
                toolName: mcpTool.name,
                content,
                result: result.toolResult || null,
                message: `Successfully executed ${mcpTool.name}`
              };
            } catch (error) {
              console.error(`Error executing MCP tool ${mcpTool.name}:`, error);
              return {
                success: false,
                toolName: mcpTool.name,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                message: `Failed to execute ${mcpTool.name}`
              };
            }
          },
        })
      };
    });
    
    return aiTools;
  } catch (error) {
    console.error('Failed to fetch MCP tools:', error);
    return [];
  }
}

/**
 * Helper function to get a specific MCP tool by name
 * Useful if you want to reference specific tools in your code while maintaining dynamic discovery
 */
export async function getMCPToolByName(toolName: string, { session, dataStream }: MCPToolsProps) {
  const tools = await getMCPTools({ session, dataStream });
  return tools.find((tool: any) => tool.name === toolName);
}