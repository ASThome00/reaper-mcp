import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { sendCommand } from '../bridge.js';

export function registerTempoTools(server: McpServer): void {
  server.tool(
    'get_tempo_map',
    'Get all tempo and time signature change points in the project (tempo map markers)',
    {},
    async () => {
      const res = await sendCommand('get_tempo_map');
      if (!res.success) {
        return { content: [{ type: 'text', text: `Error: ${res.error}` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }] };
    }
  );

  server.tool(
    'set_tempo',
    'Set the project tempo (BPM) and time signature at the start of the project',
    {
      bpm: z.coerce.number().positive().describe('Tempo in BPM'),
      numerator: z.coerce.number().int().min(1).optional().describe('Time signature numerator (default 4)'),
      denominator: z.coerce.number().int().min(1).optional().describe('Time signature denominator (default 4)'),
    },
    async ({ bpm, numerator, denominator }) => {
      const res = await sendCommand('set_tempo', { bpm, numerator, denominator });
      if (!res.success) {
        return { content: [{ type: 'text', text: `Error: ${res.error}` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }] };
    }
  );
}
