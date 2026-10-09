# Mixing Lessons — Index

Process lessons the mix skills accumulate over time — "what to do better next
time" about the *mixing process* (not facts about your mix). Always read first;
≤ 200 lines. One pointer per lesson; details live in `entries/<date>-<slug>.md`.

This file is **versioned in the repo** — commit lessons to your fork so they
travel with you and (if you push) reach anyone who clones. The full contract,
lesson schema, entrenchment guards, and the promotion/self-heal flow are in
[`../../reference/memory-protocol.md`](../../reference/memory-protocol.md).

> Empty to start. The mix skills append a pointer here at correction points
> (a reverted change, a re-measure that got worse) and increment `seen_count`
> on recurrence. A lesson at `seen_count >= 3` is promotable to a hard rule via
> `/mix-memory promote`.

## Lessons

<!-- - [short title](entries/2026-06-28-slug.md) — one-line takeaway [seen:1] -->
- [add_fx position 0 = query-only; meters before instrument](entries/2026-10-05-add-fx-position-zero.md) — omit `position`, instrument first, check analysis-container order [seen:1]
- [Insert FX are pre-fader](entries/2026-10-05-fx-prefader-thresholds.md) — subtract the fader offset when setting comp thresholds from meter readings [seen:1]
- [Bridge polling during playback lags REAPER](entries/2026-10-05-metering-poll-rate-lags-reaper.md) — ≤1 cmd/s, FFT once per section, bus headroom first [seen:1]
- [Sanity-check analyzer readings](entries/2026-10-05-sanity-check-analyzer-readings.md) — spectrum can be implausible/frozen; bus analyzers are pre-fader; average transient meters [seen:1]
