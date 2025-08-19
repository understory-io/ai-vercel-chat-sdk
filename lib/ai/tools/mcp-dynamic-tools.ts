import { tool, type UIMessageStreamWriter } from 'ai';
import { z } from 'zod';
import type { Session } from 'next-auth';
import { getProductDocumentationMCPClient } from '@/lib/mcp/client';
import type { ChatMessage } from '@/lib/types';
import { mcpLogger, createPerformanceLogger, createLogger } from '@/lib/logger';
import type { RequestContext } from '@/lib/request-context';

interface MCPToolsProps {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  requestContext?: RequestContext;
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
export async function getMCPTools({ session, dataStream, requestContext }: MCPToolsProps) {
  const perf = createPerformanceLogger('mcp', 'get_mcp_tools');
  const logger = requestContext?.logger || mcpLogger;
  
  try {
    logger.info({
      event: 'mcp_tools_discovery_start',
      userId: session.user?.id
    }, 'Starting MCP tools discovery');

    const client = await getProductDocumentationMCPClient();
    
    // Dynamically discover all available tools from the MCP server
    const toolsResponse = await client.listTools();
    const availableTools = toolsResponse.tools || [];
    
    logger.info({
      event: 'mcp_tools_discovered',
      toolCount: availableTools.length,
      toolNames: availableTools.map(t => t.name)
    }, `Found ${availableTools.length} MCP tools: ${availableTools.map(t => t.name).join(', ')}`);
    
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
            const toolPerf = createPerformanceLogger('mcp-tool', `execute_${mcpTool.name}`);
            const toolLogger = createLogger('mcp-tool', {
              requestId: requestContext?.requestId,
              toolName: mcpTool.name,
              userId: session.user?.id
            });

            try {
              toolLogger.info({
                event: 'mcp_tool_execution_start',
                toolName: mcpTool.name,
                args: args
              }, `Executing MCP tool: ${mcpTool.name}`);
              
              // Call the MCP tool with the provided arguments
              const result = await client.callTool({
                name: mcpTool.name,
                arguments: args
              });
              
              // Extract content from the MCP response
              const content = (result.content as any)?.[0]?.text || (result.content as any)?.[0] || 'Tool executed successfully';
              
              const duration = toolPerf.end({
                toolName: mcpTool.name,
                success: true,
                contentLength: content.length
              });

              toolLogger.info({
                event: 'mcp_tool_execution_success',
                toolName: mcpTool.name,
                duration_ms: duration,
                contentLength: content.length,
                hasResult: !!(result.toolResult)
              }, `Successfully executed ${mcpTool.name} in ${duration.toFixed(2)}ms`);
              
              return {
                success: true,
                toolName: mcpTool.name,
                content,
                result: result.toolResult || null,
                message: `Successfully executed ${mcpTool.name}`
              };
            } catch (error) {
              const duration = toolPerf.error(error as Error, {
                toolName: mcpTool.name,
                args: args
              });

              toolLogger.error({
                event: 'mcp_tool_execution_error',
                toolName: mcpTool.name,
                duration_ms: duration,
                error: {
                  message: error instanceof Error ? error.message : 'Unknown error',
                  stack: error instanceof Error ? error.stack : undefined
                },
                args: args
              }, `Failed to execute ${mcpTool.name} after ${duration.toFixed(2)}ms: ${error instanceof Error ? error.message : 'Unknown error'}`);
              
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
    
    const duration = perf.end({
      toolCount: availableTools.length,
      success: true
    });

    logger.info({
      event: 'mcp_tools_discovery_complete',
      duration_ms: duration,
      toolCount: availableTools.length
    }, `MCP tools discovery completed in ${duration.toFixed(2)}ms`);

    return aiTools;
  } catch (error) {
    const duration = perf.error(error as Error, {
      userId: session.user?.id
    });

    logger.error({
      event: 'mcp_tools_discovery_error',
      duration_ms: duration,
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    }, `Failed to fetch MCP tools after ${duration.toFixed(2)}ms: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return [];
  }
}

/**
 * Helper function to get a specific MCP tool by name
 * Useful if you want to reference specific tools in your code while maintaining dynamic discovery
 */
export async function getMCPToolByName(toolName: string, { session, dataStream, requestContext }: MCPToolsProps) {
  const tools = await getMCPTools({ session, dataStream, requestContext });
  return tools.find((tool: any) => tool.name === toolName);
}