---
type: process-lesson
seen_count: 1
status: active
expires: 2027-01-03
trigger: [add-fx, fx-order, instrument-tracks, metering]
---
What happened: `add_fx` with `position: 0` returned "FX not found" for a valid plugin. The bridge passes
`position` straight into TrackFX_AddByName's `instantiate` arg, where 0 means "query existing only".
Separately, the MCP Meters container had been auto-inserted on an empty instrument track and ended up
BEFORE the instrument, so it metered silence.
Why: Assumed `position` meant chain slot; didn't check that metering tools auto-insert analysis FX.
Do next time: Omit `position` (append) and add the instrument first. Before metering an instrument track,
confirm the instrument is fx 0 and no MCP analysis container sits ahead of it; remove and let it re-insert.
JSFX are added by path without extension (e.g. "reaper-mcp/mcp_lufs_meter").
Promotion target: mixer skill → Hard Rules (or fix the bridge: map position n → -1000-n)
