import { z } from 'zod/v4';
import { readFile, unlink } from 'node:fs/promises';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  ProbeInstrumentNotesRenderResult,
  ProbeInstrumentNotesResult,
  ProbedNote,
} from '@reaper-mcp/protocol';
import { sendCommand } from '../bridge.js';

// Offline render of up to ~100 notes can take a while on heavy instruments.
const PROBE_TIMEOUT_MS = 60_000;
// Attack window measured after each note-on, and pre-roll window measured just
// before it (to tell a new hit apart from the previous note's decaying tail).
const ATTACK_WINDOW_S = 0.15;
const PRE_WINDOW_S = 0.03;
const MIN_RISE_DB = 6;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteName(pitch: number): string {
  return `${NOTE_NAMES[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

export interface DecodedWav {
  sampleRate: number;
  channels: number;
  frames: number;
  /** Returns the absolute sample value (0..1) of a frame, max across channels. */
  absAt(frame: number): number;
  /** Returns the signed sample value (-1..1) of the first channel. */
  signedAt(frame: number): number;
}

/** Minimal RIFF/WAVE reader: PCM 16/24/32-bit and IEEE float 32/64-bit. */
export function decodeWav(buf: Buffer): DecodedWav {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE file');
  }
  let fmt: { format: number; channels: number; sampleRate: number; bits: number } | undefined;
  let dataOffset = -1;
  let dataSize = 0;
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ') {
      let format = buf.readUInt16LE(body);
      // WAVE_FORMAT_EXTENSIBLE: real format is the first 2 bytes of the subformat GUID
      if (format === 0xfffe && size >= 26) format = buf.readUInt16LE(body + 24);
      fmt = {
        format,
        channels: buf.readUInt16LE(body + 2),
        sampleRate: buf.readUInt32LE(body + 4),
        bits: buf.readUInt16LE(body + 14),
      };
    } else if (id === 'data') {
      dataOffset = body;
      dataSize = Math.min(size, buf.length - body);
      break;
    }
    pos = body + size + (size % 2);
  }
  if (!fmt) throw new Error('WAV has no fmt chunk');
  if (dataOffset < 0) throw new Error('WAV has no data chunk');

  const { format, channels, sampleRate, bits } = fmt;
  const bytes = bits / 8;
  let read: (off: number) => number;
  if (format === 1 && bits === 16) read = (o) => buf.readInt16LE(o) / 32768;
  else if (format === 1 && bits === 24) read = (o) => buf.readIntLE(o, 3) / 8388608;
  else if (format === 1 && bits === 32) read = (o) => buf.readInt32LE(o) / 2147483648;
  else if (format === 3 && bits === 32) read = (o) => buf.readFloatLE(o);
  else if (format === 3 && bits === 64) read = (o) => buf.readDoubleLE(o);
  else throw new Error(`Unsupported WAV encoding: format ${format}, ${bits}-bit`);

  const frameBytes = bytes * channels;
  const frames = Math.floor(dataSize / frameBytes);
  return {
    sampleRate,
    channels,
    frames,
    absAt(frame: number): number {
      let max = 0;
      const base = dataOffset + frame * frameBytes;
      for (let c = 0; c < channels; c++) {
        const v = Math.abs(read(base + c * bytes));
        if (v > max) max = v;
      }
      return max;
    },
    signedAt(frame: number): number {
      return read(dataOffset + frame * frameBytes);
    },
  };
}

function peakDb(wav: DecodedWav, fromS: number, toS: number): number {
  const a = Math.max(0, Math.floor(fromS * wav.sampleRate));
  const b = Math.min(wav.frames, Math.ceil(toS * wav.sampleRate));
  let max = 0;
  for (let f = a; f < b; f++) {
    const v = wav.absAt(f);
    if (v > max) max = v;
  }
  return max > 0 ? Math.round(20 * Math.log10(max) * 10) / 10 : -150;
}

/** Zero-crossing rate (Hz) of the first channel: ~pitch for tonal sounds, high for noise. */
function zeroCrossingHz(wav: DecodedWav, fromS: number, toS: number): number {
  const a = Math.max(0, Math.floor(fromS * wav.sampleRate));
  const b = Math.min(wav.frames, Math.ceil(toS * wav.sampleRate));
  let crossings = 0;
  let prev = wav.signedAt(a);
  for (let f = a + 1; f < b; f++) {
    const v = wav.signedAt(f);
    if ((prev < 0 && v >= 0) || (prev >= 0 && v < 0)) crossings++;
    prev = v;
  }
  const seconds = (b - a) / wav.sampleRate;
  return seconds > 0 ? Math.round(crossings / 2 / seconds) : 0;
}

/** Time from the attack peak until the level falls 20 dB below it (ms). */
function decayMs(wav: DecodedWav, fromS: number, toS: number): number {
  const a = Math.max(0, Math.floor(fromS * wav.sampleRate));
  const b = Math.min(wav.frames, Math.ceil(toS * wav.sampleRate));
  let peak = 0;
  let peakFrame = a;
  for (let f = a; f < b; f++) {
    const v = wav.absAt(f);
    if (v > peak) { peak = v; peakFrame = f; }
  }
  if (peak === 0) return 0;
  // Envelope in 5 ms blocks so a single low sample mid-waveform doesn't end the decay.
  const block = Math.max(1, Math.round(wav.sampleRate * 0.005));
  const target = peak * 0.1;
  for (let f = peakFrame; f < b; f += block) {
    let max = 0;
    for (let g = f; g < Math.min(b, f + block); g++) max = Math.max(max, wav.absAt(g));
    if (max < target) return Math.round(((f - peakFrame) / wav.sampleRate) * 1000);
  }
  return Math.round(((b - peakFrame) / wav.sampleRate) * 1000);
}

/** Measure each probe slot: attack peak and rise over the preceding tail. */
export function analyzeProbe(
  wav: DecodedWav,
  lowPitch: number,
  highPitch: number,
  slotSeconds: number,
  thresholdDb: number,
): { responding: ProbedNote[]; silentPitches: number[] } {
  const responding: ProbedNote[] = [];
  const silentPitches: number[] = [];
  for (let pitch = lowPitch; pitch <= highPitch; pitch++) {
    const onset = (pitch - lowPitch) * slotSeconds;
    const peak = peakDb(wav, onset, onset + ATTACK_WINDOW_S);
    const pre = peakDb(wav, onset - PRE_WINDOW_S, onset);
    const rise = Math.round((peak - pre) * 10) / 10;
    if (peak >= thresholdDb && rise >= MIN_RISE_DB) {
      responding.push({
        pitch,
        noteName: noteName(pitch),
        peakDb: peak,
        riseDb: rise,
        zeroCrossHz: zeroCrossingHz(wav, onset, onset + ATTACK_WINDOW_S),
        decayMs: decayMs(wav, onset, onset + slotSeconds),
      });
    } else {
      silentPitches.push(pitch);
    }
  }
  return { responding, silentPitches };
}

export function registerProbeTools(server: McpServer): void {
  server.tool(
    'probe_instrument_notes',
    'Discover which MIDI pitches an instrument on a track responds to (e.g. a drum synth\'s note map). Renders one note per pitch offline past the project end (no playback needed; the temporary item is removed) and reports each responding pitch with its attack peak. Use before writing drum parts for an unfamiliar instrument.',
    {
      trackIndex: z.coerce.number().min(0).describe('0-based track index of the instrument track'),
      lowPitch: z.coerce.number().min(0).max(127).optional().describe('Lowest pitch to probe (default 24)'),
      highPitch: z.coerce.number().min(0).max(127).optional().describe('Highest pitch to probe (default 84)'),
      velocity: z.coerce.number().min(1).max(127).optional().describe('Probe note velocity (default 110)'),
      slotSeconds: z.coerce.number().min(0.2).max(5).optional().describe('Seconds between probe notes (default 0.75; raise for long-decay sounds)'),
      thresholdDb: z.coerce.number().max(0).optional().describe('Minimum attack peak to count as responding (default -60 dBFS)'),
    },
    async ({ trackIndex, lowPitch, highPitch, velocity, slotSeconds, thresholdDb }) => {
      const res = await sendCommand(
        'probe_instrument_notes',
        { trackIndex, lowPitch, highPitch, velocity, slotSeconds },
        PROBE_TIMEOUT_MS,
      );
      if (!res.success) {
        return { content: [{ type: 'text', text: `Error: ${res.error}` }], isError: true };
      }
      const data = res.data as ProbeInstrumentNotesRenderResult;
      const threshold = thresholdDb ?? -60;
      try {
        const wav = decodeWav(await readFile(data.wavPath));
        const { responding, silentPitches } = analyzeProbe(
          wav, data.lowPitch, data.highPitch, data.slotSeconds, threshold,
        );
        const result: ProbeInstrumentNotesResult = {
          trackIndex: data.trackIndex,
          trackName: data.trackName,
          thresholdDb: threshold,
          responding,
          silentPitches,
        };
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error analyzing probe render: ${(err as Error).message}` }],
          isError: true,
        };
      } finally {
        await unlink(data.wavPath).catch(() => undefined);
      }
    },
  );
}
