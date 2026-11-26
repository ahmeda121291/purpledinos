# Pipeline

Python jobs that pull Raptors data and write it to Supabase.

- `backfill` — one-time pull of every Raptors season since 1995-96 (nba_api).
- `nightly` — last night's box score, play-by-play, lineups, tracking, play types.
- `gamenight` — waits for the final buzzer, then pulls the game.
- `feeds` — ESPN schedule/injuries, RSS articles, beat-writer posts.
- `derive` — garbage-time filter, lineup ratings, on/off, percentiles, franchise ranks.

stats.nba.com blocks cloud IPs, so nba_api jobs route through `NBA_PROXY_URL` (a residential proxy) when they run in the cloud.
