import { z } from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { sendCommand } from '../bridge.js';

export function registerTrackTools(server: McpServer): void {
  server.tool(
    'list_tracks',
    'List all tracks in the current REAPER project with name, index, volume, mute/solo state, and folder structure',
    {},
    async () => {
      const res = await sendCommand('list_tracks');
      if (!res.success) {
        return { content: [{ type: 'text', text: `Error: ${res.error}` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }] };
    }
  );

  server.tool(
    'get_track_properties',
    'Get detailed properties of a specific track including volume, pan, mute, solo, and FX chain',
    { trackIndex: z.coerce.number().int().min(0).describe('Zero-based track index') },
    async ({ trackIndex }) => {
      const res = await sendCommand('get_track_properties', { trackIndex });
      if (!res.success) {
        return { content: [{ type: 'text', text: `Error: ${res.error}` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }] };
    }
  );

  server.tool(
    'set_track_property',
    'Set a track property: volume (dB), pan (-1.0 to 1.0), mute/solo/recordArm/phase (0/1), input (REAPER input index)',
    {
      trackIndex: z.coerce.number().int().min(0).describe('Zero-based track index'),
      property: z.enum(['volume', 'pan', 'mute', 'solo', 'recordArm', 'phase', 'input']).describe('Property to set: volume (dB), pan (-1.0–1.0), mute/solo/recordArm/phase (0 or 1), input (REAPER input index, -1=no input)'),
      value: z.coerce.number().describe('Value: volume in dB, pan -1.0–1.0, mute/solo/recordArm/phase 0 or 1, input = REAPER input index'),
    },
    async ({ trackIndex, property, value }) => {
      const res = await sendCommand('set_track_property', { trackIndex, property, value });
      if (!res.success) {
        return { content: [{ type: 'text', text: `Error: ${res.error}` }], isError: true };
      }
      return { content: [{ type: 'text', text: `Set track ${trackIndex} ${property} = ${value}` }] };
    }
  );

  server.tool(
    'create_track',
    'Insert a new track at an index (default: end of track list) with an optional name',
    {
      index: z.coerce.number().int().min(0).optional().describe('Insert position (0-based); omit to append'),
      name: z.string().optional().describe('Track name'),
    },
    async ({ index, name }) => {
      const res = await sendCommand('create_track', { index, name });
      if (!res.success) {
        return { content: [{ type: 'text', text: `Error: ${res.error}` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }] };
    }
  );

  server.tool(
    'delete_tracks',
    'Delete one or more tracks (with their items and FX) by 0-based index, as a single undo step. All indices are validated first; if any is invalid nothing is deleted. Returns the deleted tracks\' original indices and names. Remaining tracks shift down to fill the gap.',
    {
      trackIndices: z.array(z.coerce.number().int().min(0)).min(1).describe('0-based indices of the tracks to delete'),
    },
    async ({ trackIndices }) => {
      const res = await sendCommand('delete_tracks', { trackIndices });
      if (!res.success) {
        return { content: [{ type: 'text', text: `Error: ${res.error}` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }] };
    }
  );

  server.tool(
    'rename_track',
    'Rename an existing track',
    {
      trackIndex: z.coerce.number().int().min(0).describe('Track index (0-based)'),
      name: z.string().describe('New track name'),
    },
    async ({ trackIndex, name }) => {
      const res = await sendCommand('rename_track', { trackIndex, name });
      if (!res.success) {
        return { content: [{ type: 'text', text: `Error: ${res.error}` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(res.data, null, 2) }] };
    }
  );
}
