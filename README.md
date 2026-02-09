# NBA MyLeague GM Simulator

This is now a **2K-style MyLeague sim**:

- Choose any NBA team as your franchise
- Pick a GM strategy
- Sim **day-by-day**, **week-by-week**, or **the entire season**
- Continue the same league session and track standings + playoffs

## Run

```bash
python3 app.py
```

Open `http://localhost:8000`.

## API

Create league:

```bash
curl "http://localhost:8000/api/new_league?seed=42&gpm=2&team=Los%20Angeles%20Lakers&move=all_in"
```

Sim day:

```bash
curl "http://localhost:8000/api/simulate_day?sid=<SESSION_ID>"
```

Sim week:

```bash
curl "http://localhost:8000/api/simulate_week?sid=<SESSION_ID>"
```

Sim full season:

```bash
curl "http://localhost:8000/api/simulate_season?sid=<SESSION_ID>"
```

## Tests

```bash
python3 -m pytest -q
```
