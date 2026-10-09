import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { sendCommand } from '../bridge.js';

export function registerSelectionTools(server: McpServer): void {
  server.tool(
    'get_selected_tracks',
    'Get all currently selected tracks in REAPER with their indices and names',
    {},
    async () => {
      const res = await sendCommand('get_selected_tracks');
      if (!res.success) {
        return { content: [{ type: 'text', text: `Error: ${res.error}` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }] };
    }
  );

  server.tool(
    'set_selected_tracks',
    'Set which tracks are selected (useful before run_action on selected tracks). mode "replace" (default) selects exactly these tracks, "add" adds them to the selection, "remove" deselects them. An empty list with "replace" clears the selection. Returns the resulting selection.',
    {
      trackIndices: z.array(z.coerce.number().int().min(0)).describe('0-based track indices'),
      mode: z.enum(['replace', 'add', 'remove']).optional().default('replace').describe('How to apply the list to the current selection'),
    },
    async ({ trackIndices, mode }) => {
      const res = await sendCommand('set_selected_tracks', { trackIndices, mode });
      if (!res.success) {
        return { content: [{ type: 'text', text: `Error: ${res.error}` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }] };
    }
  );

  server.tool(
    'get_time_selection',
    'Get the current time selection (loop selection) start and end in seconds',
    {},
    async () => {
      const res = await sendCommand('get_time_selection');
      if (!res.success) {
        return { content: [{ type: 'text', text: `Error: ${res.error}` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }] };
    }
  );

  server.tool(
    'set_time_selection',
    'Set the time selection (loop selection) to a start and end position in seconds',
    {
      start: z.coerce.number().min(0).describe('Start position in seconds'),
      end: z.coerce.number().min(0).describe('End position in seconds'),
    },
    async ({ start, end }) => {
      const res = await sendCommand('set_time_selection', { start, end });
      if (!res.success) {
        return { content: [{ type: 'text', text: `Error: ${res.error}` }], isError: true };
      }
      return { content: [{ type: 'text', text: `Time selection set: ${start}s - ${end}s` }] };
    }
  );
}
