# NBA GM Universe (MyLeague-style)

A significantly expanded NBA simulation sandbox inspired by 2K MyLeague.

## What’s included

- Real NBA teams and star-led player pools
- Persistent league sessions (stateful sim)
- Day-by-day, week-by-week, or full-season simulation
- Trade engine (player-for-player)
- Rotation control (set top-10 minute order)
- Standings, season progression, and playoff champion simulation
- Professional dark-theme web UI + JSON API

## Run

```bash
python3 app.py
```

Open `http://localhost:8000`.

## Key APIs

- `GET /api/new_league?seed=42&gpm=2&team=Los%20Angeles%20Lakers`
- `GET /api/simulate_day?sid=<SID>`
- `GET /api/simulate_week?sid=<SID>`
- `GET /api/simulate_season?sid=<SID>`
- `GET /api/trade?sid=<SID>&from_team=...&to_team=...&send=PlayerA&receive=PlayerB`
- `GET /api/rotation?sid=<SID>&team=...&players=Player1,Player2,...`

## Test

```bash
python3 -m pytest -q
```
