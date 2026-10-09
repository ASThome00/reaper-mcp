# reaper-mcp

Let Claude produce and mix in [REAPER](https://www.reaper.fm/). An MCP server and
Lua bridge that give AI agents real-time control of a live REAPER session:
tracks, FX, MIDI, media items, automation, transport and metering. It ships with
mix-engineer skills that measure before and after every change.

```
"Build a 90s West Coast beat at 92 BPM"
"Gain stage my tracks and fix the low end"
"Which notes does the drum synth on track 1 respond to?"
"Roast my mix — what could be improved?"
```

> **This is a fork** of [mthines/reaper-mcp](https://github.com/mthines/reaper-mcp).
> It tracks upstream and adds the bridge fixes and tools below. Everything else
> works the same as upstream.

## What this fork changes

**Fixes**

- **Metering works on every track.** Meters were matched by file path instead of
  their display name, so every read inserted a fresh, empty meter. The LUFS
  meter's track slot was also set wrong, so every track wrote to slot 0. The
  spectrum, crest and correlation meters had no per-track slot at all and
  overwrote each other.
- **Meter writes no longer bypass the meter container.** After inserting a
  meter, the bridge used an index that pointed at the container, so writing the
  FFT size switched on the container's Bypass.
- **Spectrum readings are accurate.** FFT output is put in frequency order
  (`fft_permute`), smoothing happens in linear power rather than dB, and the
  requested FFT size is applied.
- **`measure_tracks`** inserts and resets meters *before* playback, and reports
  failed metrics under `errors` instead of silently dropping them. It's also on
  the allow-list now, so it no longer asks for permission on every call.
- **Plugin discovery doesn't need SWS.** It uses REAPER's native
  `EnumInstalledFX`; SWS has no `CF_EnumerateInstalledFX`. Instruments are
  labelled correctly (`VSTi`/`VST3i`/`AUi`) and get an `isInstrument` flag.
- **`set_multiple_fx_parameters` applies its updates.** The array was parsed as
  a single object, so nothing was ever applied.
- **`add_fx` with `position: 0` inserts at the start of the chain.** Before, it
  meant "query only" and returned "FX not found".
- **Live MIDI (`send_midi_note/cc/pc`) reaches the instrument.** The MIDI
  emitter now goes at the top of the chain instead of after the synth.

**New tools**

- `probe_instrument_notes` renders one note per pitch offline and reports which
  pitches an instrument responds to. For each one it gives the peak, a
  brightness estimate and the decay time, which is enough to map an unfamiliar
  drum synth. No playback needed.
- `get_fx_named_config` / `set_fx_named_config` read and write a plugin's named
  settings. For example, load a sample into ReaSamplOmatic5000 with `FILE0`.
- `create_track`, `rename_track`, `set_tempo`, `set_project_notes`,
  `save_project`, `run_action` let the agent build a song from an empty project.

## Quick start

```bash
git clone https://github.com/ASThome00/reaper-mcp.git && cd reaper-mcp
./scripts/install.sh
```

The installer builds the server, puts the `reaper-mcp` CLI on your PATH, copies
the Lua bridge and JSFX meters into REAPER, links the mix skills and knowledge
into `~/.claude`, and configures Claude Code (`.mcp.json` plus a tool
allow-list, so there are no per-call permission prompts).

Then start the bridge in REAPER: **Actions → Show action list → Load ReaScript →
`mcp_bridge.lua` → Run**. Open Claude Code and check the setup with:

```bash
reaper-mcp doctor
```

### Requirements

- REAPER 7.06 or later (needed for FX containers and native plugin enumeration)
- Node.js 20+ and pnpm
- macOS, Windows or Linux. Day-to-day testing of this fork is on macOS (Apple Silicon).
- SWS Extensions are **optional**

## How it works

```
Claude Code ←stdio→ MCP server (TypeScript) ←JSON files→ Lua bridge (inside REAPER)
                                                              │
                                              ReaScript API ←─┤
                                   gmem shared memory ←── JSFX meters (per-track slots)
```

REAPER's scripting sandbox has no sockets, so the bridge runs inside REAPER on a
`reaper.defer()` loop, exchanging JSON command and response files with the
server. A round trip takes roughly 50–150 ms. The meters are small JSFX plugins
in an "MCP Meters" container at the end of each measured track. Each track
writes to its own region of shared memory (`gmem`).

## Tools (94)

| Area | Tools |
|------|-------|
| **Project** | `get_project_info`, `set_project_notes`, `save_project`, `run_action`, `get_tempo_map`, `set_tempo` |
| **Tracks** | `list_tracks`, `create_track`, `rename_track`, `get_track_properties`, `set_track_property`, `set_multiple_track_properties`, `get_track_routing` |
| **FX** | `add_fx`, `remove_fx`, `get_fx_parameters`, `analyze_fx`, `set_fx_parameter`, `set_multiple_fx_parameters`, `setup_fx_chain`, `set_fx_enabled`, `set_fx_offline`, `get_fx_named_config`, `set_fx_named_config` |
| **Plugin discovery** | `list_available_fx`, `search_fx`, `get_fx_preset_list`, `set_fx_preset` |
| **Transport** | `play`, `stop`, `record`, `get_transport_state`, `set_cursor_position` |
| **Metering & analysis** | `read_track_meters`, `read_track_spectrum`, `read_track_lufs`, `read_track_correlation`, `read_track_crest`, `measure_tracks`, `probe_instrument_notes`, `analyze_track_aesthetics`¹ |
| **MIDI** | `create_midi_item`, `list_midi_items`, `get_midi_notes`, `analyze_midi`, `insert_midi_note(s)`, `edit_midi_note(s)`, `delete_midi_note`, `get/insert/delete_midi_cc`, `get/set_midi_item_properties` |
| **Live MIDI** | `send_midi_note`, `send_midi_cc`, `send_midi_pc` |
| **Media items** | `list_media_items`, `get/set_media_item_properties`, `set_media_items_properties`, `split/delete/move/trim_media_item`, `add/get/delete_stretch_marker` |
| **Automation** | `get_track_envelopes`, `get_envelope_points`, `insert_envelope_point(s)`, `delete_envelope_point`, `remove_envelope_points`, `create_track_envelope`, `set_envelope_properties`, `clear_envelope` |
| **Markers & selection** | `list/add/delete_marker`, `list/add/delete_region`, `get_selected_tracks`, `get/set_time_selection` |
| **Snapshots** | `snapshot_save`, `snapshot_restore`, `snapshot_list`, `snapshot_delete` |
| **Tool discovery** | `list_tool_categories`, `enable_tool_category`, `disable_tool_category` |

¹ Needs the optional Python sidecar (`reaper-mcp setup-sidecar`).

Notes:

- **FX parameter values** are normalized 0–1 for VST/AU plugins. JSFX sliders
  take raw values.
- **MIDI positions** are in beats from the start of the item. Pitch 60 = C4.
- **Measuring short sounds:** `read_track_meters` reads an instant, so it can
  miss short hits. For a precise per-note peak, use `probe_instrument_notes`,
  which renders offline after the fader.

## Mix skills

`install.sh` links five Claude Code skills that run in your live session:

| Skill | What it does |
|-------|--------------|
| `/mixer` | Gain staging, FX chains, EQ/compression and problem fixing, verified with meters |
| `/critique` | Read-only "roast my mix" report, backed by measurements |
| `/mastering` | Mix-bus EQ, glue compression and a true-peak limiter aimed at a LUFS target |
| `/learn-plugin` | Interviews you about a plugin and writes its knowledge file |
| `/mix-memory` | Recall, tidy and promote what the skills have learned |

Each skill saves a snapshot, measures, makes changes, re-measures, and records
anything durable it learned. That knowledge lives in `knowledge/` (plugin
parameter maps, genre rules, workflows and process lessons). `~/.claude/knowledge`
is a link to that folder, so it's versioned in this repo. Commit it to keep it.

## Updating the bridge

The TypeScript server and the files inside REAPER are updated separately:

```bash
reaper-mcp setup        # copies mcp_bridge.lua + JSFX meters into REAPER
```

- **Bridge (`.lua`) changes:** stop and re-run `mcp_bridge.lua` in REAPER, or
  restart REAPER.
- **JSFX meter changes:** restart REAPER. Meters already in a project only
  reload their code on restart.
- **Server or new-tool changes:** rebuild, then reconnect the MCP server in
  Claude Code (`/mcp`).

If old tools work but new ones time out, the bridge running in REAPER is out of date.

## Development

```bash
pnpm install
pnpm nx run-many --target=build,lint,test
```

> **Careful with a live session open.** Some integration tests
> (`midi.integration.test.ts`, `bridge.stress.test.ts`) talk to a running
> REAPER bridge. The MIDI tests send events to track `REAPER_TEST_TRACK_INDEX`
> (default 0) and remove FX there. Run them against a scratch project, or run
> specific unit test files while you're working on a real song.

New tools need four things: a bridge handler in `reaper/mcp_bridge.lua`, a
command type in `libs/protocol`, the tool in `apps/reaper-mcp-server/src/tools`,
and an entry in `MCP_TOOL_NAMES` (`cli.ts`) plus a category in
`tools/categories.ts`. See [DEVELOPMENT.md](DEVELOPMENT.md) and
[docs/TESTING.md](docs/TESTING.md).

### Staying in sync with upstream

```bash
git fetch upstream
git merge upstream/main     # or rebase
```

## Credits

Built on [mthines/reaper-mcp](https://github.com/mthines/reaper-mcp). The fixes
here apply upstream too and can be contributed back.

## License

MIT
