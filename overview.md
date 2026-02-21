NBA GM Simulator: Master Technical Design Document
Version: 1.0 Target Platform: Web & Mobile (PWA) Data Source: Real 2026 Projected Rosters

1. Executive Summary
We are building a browser-based, mobile-responsive NBA General Manager simulation. The user controls one franchise, managing rosters, finances, and trades, while the AI controls the other 29 teams. The core loop involves simulating games, managing the salary cap, and progressing through infinite seasons.

2. Technology Stack
Framework: Next.js 14+ (App Router)
Language: TypeScript
Styling: Tailwind CSS (Mobile-first approach)
Database: PostgreSQL
ORM: Prisma
State Management: Zustand (for client-side simulation state)
Deployment: Vercel (Frontend/API) + Supabase/Neon (Postgres)
3. Database Schema (Prisma)
Instruction: Copy this directly into schema.prisma.

prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Global League State
model LeagueState {
  id             String   @id @default(uuid())
  currentSeason  Int      @default(2026)
  currentDay     Int      @default(1) // 1 to 170 (Regular Season)
  salaryCap      Float    @default(155000000)
  luxuryTax      Float    @default(188000000)
  userTeamId     String?
}

model Team {
  id           String   @id @default(uuid())
  city         String
  name         String
  abbrev       String   @unique
  conference   String
  division     String
  
  // Strategy
  pace         Int      @default(50) // 0 (Slow) - 100 (Fast)
  focus        String   @default("Balanced") // "Inside", "3PT", "Balanced"
  
  players      Player[]
  homeGames    Game[]   @relation("HomeTeam")
  awayGames    Game[]   @relation("AwayTeam")
}

model Player {
  id           String   @id @default(uuid())
  externalId   String?  // NBA.com ID for images
  firstName    String
  lastName     String
  position     String   // PG, SG, SF, PF, C
  age          Int
  height       Int      // Inches
  
  // Core Ratings (0-99)
  overall      Int
  potential    Int
  offense      Int      // Shot making
  defense      Int      // Perimeter & Interior
  playmaking   Int      // Passing & IQ
  rebounding   Int
  stamina      Int
  
  // Simulation Tendencies (0-100)
  shotTendency Int      // How often they shoot
  touchShare   Int      // Usage rate proxy
  
  // Dynamic State
  morale       Int      @default(80)
  fatigue      Int      @default(0)
  
  teamId       String?
  team         Team?    @relation(fields: [teamId], references: [id])
  contract     Contract?
  stats        PlayerStats[]
}

model Contract {
  id           String   @id @default(uuid())
  playerId     String   @unique
  player       Player   @relation(fields: [playerId], references: [id])
  
  amount       Float    // Current year salary
  yearsLeft    Int
  type         String   // "Guaranteed", "Player Option", "Team Option"
}

model Game {
  id           String   @id @default(uuid())
  season       Int
  day          Int      // Schedule day
  isPlayed     Boolean  @default(false)
  
  homeTeamId   String
  homeTeam     Team     @relation("HomeTeam", fields: [homeTeamId], references: [id])
  homeScore    Int      @default(0)
  
  awayTeamId   String
  awayTeam     Team     @relation("AwayTeam", fields: [awayTeamId], references: [id])
  awayScore    Int      @default(0)
}

model PlayerStats {
  id           String   @id @default(uuid())
  playerId     String
  player       Player   @relation(fields: [playerId], references: [id])
  season       Int
  gamesPlayed  Int      @default(0)
  points       Int      @default(0)
  rebounds     Int      @default(0)
  assists      Int      @default(0)
  minutes      Int      @default(0)
}
4. Core Simulation Engine Logic
Instruction: Implement this logic in lib/simulation/engine.ts.

A. The Possession Loop
The game is not a random number generator. It simulates possessions.

Pace Factor: Calculate possessions per game based on Team.pace (Avg ~100).
Possession Resolution:
Ball Handler Selection: Weighted random based on Player.touchShare.
Action:
Shot: (Offense Rating vs Defender Rating) + Variance.
Pass: If Playmaking > Random(0-100), pass to open teammate (boosts shot chance).
Turnover: (100 - Playmaking) * Defense Pressure.
Fatigue System:
Every minute played increases Fatigue.
If Fatigue > Stamina, attributes drop by 10-20%.
B. Auto-Substitution
Check player fatigue every 4 "game minutes".
If Fatigue > 80, sub in the highest-rated bench player at that position.
5. GM Logic & Algorithms
Instruction: Implement in lib/gm/logic.ts.

A. Trade Value Calculator
Used to determine if AI accepts a user trade.

typescript
function getTradeValue(player: Player, contract: Contract): number {
  let value = player.overall * 3; // Base value
  
  // Age Factor
  if (player.age < 24) value += (player.potential - player.overall) * 2;
  if (player.age > 32) value -= (player.age - 32) * 5;

  // Contract Factor (Simplified)
  const salaryCap = 155000000;
  const pctOfCap = contract.amount / salaryCap;
  
  // Penalize bad contracts for low rated players
  if (pctOfCap > 0.20 && player.overall < 80) value -= 20;
  
  return Math.max(0, value);
}
B. Salary Cap Validation
Hard Cap Rule: Teams cannot exceed the "Apron" ($190M) via trade unless they send out more salary than they take in.
Trade Match Rule: If over the cap, incoming salary must be within 125% of outgoing salary + $250k.
6. Frontend Architecture (Next.js)
Directory Structure
text
/app
  /api
    /simulation      # Endpoints to trigger game sims
    /league          # Endpoints for standings, leaders
  /dashboard         # Main GM Hub
  /roster            # Drag-and-drop lineup management
  /trade             # Trade machine UI
  /game/[id]         # Live "SimCast" view
/components
  /ui                # Generic UI (Buttons, Cards)
  /simulation        # Game log ticker, Box score table
/lib
  /engine            # The math (Sim logic)
  /db                # Prisma client
Key Components
RosterGrid.tsx: A Data Grid displaying players. Columns: Name, Pos, Age, OVR, Salary.
Feature: Click a player to open a modal with their "Player Card" (Attributes/Badges).
SimCast.tsx: A visualizer for the simulation.
Visuals: A basketball court graphic showing dots for players.
Text: A scrolling play-by-play log ("LeBron James makes 3pt jump shot").
Controls: Speed slider (1x, 10x, Instant).
7. Data Seeding Strategy (Real 2026 Rosters)
Instruction: Create a script prisma/seed.ts.

Source File: Create data/rosters_2026.json.
Structure:
json
[
  {
    "team": "Lakers",
    "players": [
      { "name": "LeBron James", "age": 41, "ovr": 88, "salary": 51000000, "imgId": "2544" }
    ]
  }
]
Logic: The seed script must iterate through this JSON, create the Team first, then create Players and Contracts linked to that Team ID.
8. Implementation Roadmap
Phase 1: The Skeleton
Initialize Next.js project.
Set up PostgreSQL database and apply Prisma Schema.
Run the Seed Script to populate the 30 NBA teams.
Phase 2: The Engine
Build the GameSimulation class (TypeScript).
Create a "Quick Sim" button that simulates one game and logs the result to the console.
Connect the simulation results to the Database (update Game and PlayerStats).
Phase 3: The UI
Build the Dashboard: Show Team Record, Cap Space, and Next Opponent.
Build the Roster Page: Allow users to cut players or change starters.
Build the Standings Page: Query the DB to rank teams by wins.
Phase 4: GM Features
Implement Trade Logic: Allow users to select players from another team and propose a swap.
Implement Free Agency: A list of players with no team (teamId: null) that can be signed if cap space exists.
9. API Endpoints Reference
Method	Endpoint	Description
GET	/api/league/standings	Returns teams sorted by Win/Loss.
GET	/api/team/[id]/roster	Returns players and contracts for a team.
POST	/api/sim/day	Simulates all games scheduled for the current day.
POST	/api/gm/trade	Validates and executes a trade proposal.
POST	/api/gm/sign	Signs a free agent (checks cap space).