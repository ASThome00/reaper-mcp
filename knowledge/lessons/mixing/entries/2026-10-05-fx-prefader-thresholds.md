---
type: process-lesson
seen_count: 1
status: active
expires: 2027-01-03
trigger: [compression, gain-staging, thresholds]
---
What happened: Planned compressor thresholds from post-fader meter readings; insert FX are pre-fader,
so the compressor actually sees the raw instrument output (here 6-15 dB hotter than the metered level).
Caught before applying.
Why: read_track_meters reports post-fader levels; it's easy to forget the fader offset when setting thresholds.
Do next time: Threshold target = (metered RMS − fader dB) − desired GR margin. Or set faders to 0 dB
while dialing dynamics, then gain-stage after.
Promotion target: workflows/gain-staging.md note
