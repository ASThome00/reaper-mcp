import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { sendCommand } from '../bridge.js';

export function registerProjectTools(server: McpServer): void {
  server.tool(
    'get_project_info',
    'Get current REAPER project info: name, track count, tempo, time signature, sample rate, transport state',
    {},
    async () => {
      const res = await sendCommand('get_project_info');
      if (!res.success) {
        return { content: [{ type: 'text', text: `Error: ${res.error}` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }] };
    }
  );

  server.tool(
    'set_project_notes',
    'Replace the REAPER project notes text',
    {
      notes: z.string().describe('Project notes text'),
    },
    async ({ notes }) => {
      const res = await sendCommand('set_project_notes', { notes });
      if (!res.success) {
        return { content: [{ type: 'text', text: `Error: ${res.error}` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }] };
    }
  );

  server.tool(
    'save_project',
    'Save the project; pass an absolute .rpp path to save to a new location',
    {
      path: z.string().optional().describe('Absolute .rpp path (omit to save in place)'),
    },
    async ({ path }) => {
      const res = await sendCommand('save_project', { path });
      if (!res.success) {
        return { content: [{ type: 'text', text: `Error: ${res.error}` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }] };
    }
  );

  server.tool(
    'run_action',
    'Run a REAPER action by numeric command ID or named command string (e.g. "_SWS_ABOUT")',
    {
      commandId: z.union([z.coerce.number().int(), z.string()]).describe('Action command ID or named command'),
    },
    async ({ commandId }) => {
      const res = await sendCommand('run_action', { commandId });
      if (!res.success) {
        return { content: [{ type: 'text', text: `Error: ${res.error}` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }] };
    }
  );
}
