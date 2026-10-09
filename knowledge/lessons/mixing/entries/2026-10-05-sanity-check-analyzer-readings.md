---
type: process-lesson
seen_count: 1
status: active
expires: 2027-01-03
trigger: [critique, spectrum, lufs, metering, bus]
---
What happened: read_track_spectrum returned 256 bins labelled 10.8 Hz resolution (covers only 2.7 kHz) whose
values were a -95 dB floor with isolated spikes; band averages were physically implausible (mids -98 dB while
piano/pad/lead play there). Earlier the same analyzer returned identical (frozen) data across calls. Also: bus
LUFS/crest/correlation analyzers are inserts, i.e. PRE-fader — they ignore the bus fader.
Why: Nearly reported a "scooped mids / missing air" verdict from a broken reading.
Do next time: Before citing spectrum data, check plausibility (bins x resolution ≈ Nyquist; energy present where
the arrangement has instruments; values change between reads). If implausible, say spectral balance is
unverified rather than inventing a verdict. Subtract the bus fader from bus analyzer readings. Use averaged
windows (not single instantaneous reads) for transient tracks.
Promotion target: critique skill → Hard Rules
