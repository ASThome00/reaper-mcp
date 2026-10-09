import { describe, it, expect } from 'vitest';
import { decodeWav, analyzeProbe, noteName } from './probe.js';

/** Build a mono 16-bit PCM WAV from float samples. */
function makeWav(samples: number[], sampleRate = 1000): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(s * 32767), i * 2));
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0);          // PCM
  fmt.writeUInt16LE(1, 2);          // mono
  fmt.writeUInt32LE(sampleRate, 4);
  fmt.writeUInt32LE(sampleRate * 2, 8);
  fmt.writeUInt16LE(2, 12);
  fmt.writeUInt16LE(16, 14);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(4 + 8 + 16 + 8 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  const chunk = (id: string, body: Buffer) => {
    const h = Buffer.alloc(8);
    h.write(id, 0, 'ascii');
    h.writeUInt32LE(body.length, 4);
    return Buffer.concat([h, body]);
  };
  return Buffer.concat([header, chunk('fmt ', fmt), chunk('data', data)]);
}

describe('noteName', () => {
  it('uses C4 = 60', () => {
    expect(noteName(60)).toBe('C4');
    expect(noteName(36)).toBe('C2');
    expect(noteName(42)).toBe('F#2');
  });
});

describe('decodeWav', () => {
  it('reads 16-bit PCM', () => {
    const wav = decodeWav(makeWav([0, 0.5, -1]));
    expect(wav.frames).toBe(3);
    expect(wav.absAt(1)).toBeCloseTo(0.5, 3);
    expect(wav.absAt(2)).toBeCloseTo(1, 3);
  });

  it('rejects non-WAV data', () => {
    expect(() => decodeWav(Buffer.from('not a wav file at all'))).toThrow();
  });
});

describe('analyzeProbe', () => {
  it('detects hits and ignores decaying tails', () => {
    // 1000 Hz sample rate, 1 s slots, pitches 36..38
    const samples = new Array(3000).fill(0);
    // pitch 36: loud hit with a long tail that spills into the pitch-37 slot
    for (let i = 0; i < 1200; i++) samples[i] = 0.8 * Math.exp(-i / 400);
    // pitch 38: clear hit
    for (let i = 2000; i < 2100; i++) samples[i] = 0.5;
    const { responding, silentPitches } = analyzeProbe(decodeWav(makeWav(samples)), 36, 38, 1, -60);
    expect(responding.map((n) => n.pitch)).toEqual([36, 38]);
    expect(silentPitches).toEqual([37]);
  });

  it('reports brightness and decay', () => {
    // 1000 Hz sample rate, one 1 s slot: a 50 Hz sine decaying with tau = 100 ms
    const samples = Array.from({ length: 1000 }, (_, i) => Math.exp(-i / 100) * Math.sin((2 * Math.PI * 50 * i) / 1000));
    const [hit] = analyzeProbe(decodeWav(makeWav(samples)), 36, 36, 1, -60).responding;
    expect(hit.zeroCrossHz).toBeGreaterThan(40);
    expect(hit.zeroCrossHz).toBeLessThan(60);
    // -20 dB at t = tau * ln(10) ≈ 230 ms (± 5 ms envelope blocks)
    expect(hit.decayMs).toBeGreaterThan(200);
    expect(hit.decayMs).toBeLessThan(250);
  });
});
