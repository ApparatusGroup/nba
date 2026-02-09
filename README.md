# NBA Simulator

A lightweight but realistic NBA simulator that runs a full regular season, play-in tournament, and playoffs.

## Features

- 30 real NBA teams across East/West conferences
- Possession-based game simulation with offense/defense/pace + variance
- Home-court advantage in single games and 2-2-1-1-1 playoff series modeling
- 7-10 play-in tournament in each conference
- Full 16-team playoff bracket and NBA Finals champion
- Reproducible runs using `--seed`

## Quick start

```bash
python3 nba_simulator.py --seed 42 --games-per-matchup 2
```

## Run tests

```bash
python3 -m pytest -q
```

## Notes

- Default setup (`--games-per-matchup 2`) gives 58 regular-season games per team for faster simulation.
- Use `--games-per-matchup 4` for a heavier run closer to a full schedule volume.


## Web app

Run locally:

```bash
python3 app.py
```

Open `http://localhost:8000`.

### Vercel

This repo now includes `vercel.json` for a Python serverless-style entrypoint.

```bash
vercel
```

> I cannot deploy to your Vercel account from this environment because it requires your account auth token/team/project access.
