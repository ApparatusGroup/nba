# NBA Simulator

A realistic NBA franchise simulator where the user can run any team as GM and simulate a full season + playoffs.

## Features

- 30 real NBA teams with roster generation anchored by real star players
- User-controlled franchise mode (`team` + front-office `move`)
- Regular season simulation with configurable schedule size
- Play-in tournament and full playoff bracket
- Web UI for standings, your roster, and playoff rounds
- JSON API for integrating simulation data externally

## Run web app

```bash
python3 app.py
```

Open `http://localhost:8000` and choose your team + move.

## API example

```bash
curl "http://localhost:8000/api/simulate?seed=42&gpm=2&team=Los%20Angeles%20Lakers&move=all_in"
```

## CLI example

```bash
python3 nba_simulator.py --seed 42 --games-per-matchup 2 --gm-team "Los Angeles Lakers" --gm-move all_in
```

## Tests

```bash
python3 -m pytest -q
```
