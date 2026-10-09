---
type: process-lesson
seen_count: 1
status: active
expires: 2027-01-03
trigger: [metering, playback, critique, bridge-load]
---
What happened: Ran scripted measurement passes polling the bridge 10-20 cmds/s (meters + LUFS + FFT + crest
+ correlation) during playback; the user reported REAPER lagging and clipping and paused it. A "lighter" 2-4
cmds/s pass still lagged. Bus fader was also at 0 dB with denser sections peaking ~0 dBFS (real clipping).
Why: Every bridge command runs Lua on REAPER's main thread; spectrum/LUFS responses serialize large arrays.
Didn't check bus headroom before long playback passes.
Do next time: Before any playback measurement, give the bus 6 dB headroom. Sample at <=1 cmd/s, read FFT/crest/
correlation once per section, keep passes short (a few sections, not the whole song), and ask the user whether
playback is smooth before scaling up.
Promotion target: critique + mixer skills → Hard Rules
