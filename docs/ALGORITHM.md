# 🧠 AI Algorithm — Territory Control Strategy

> How the snakes decide where to move on your contribution graph

## Overview

Each snake makes decisions every turn using a multi-layered heuristic system. The algorithm balances **efficient local painting** with **global exploration**, while avoiding common pathological behaviors like chase-loops and dead-end trapping.

```
┌──────────────────────────────────────────────────────────────┐
│                     chooseDirection()                         │
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐ │
│  │ Loop         │   │ Stagnation   │   │ Strategy         │ │
│  │ Detection    │──▶│ ε-Greedy     │──▶│ Evaluation       │ │
│  │ (period 2-4) │   │ (3%~50%)     │   │ (9 factors)      │ │
│  └──────────────┘   └──────────────┘   └──────────────────┘ │
│         │                  │             │           │       │
│    Force random       Force random   Normal mode  Nav mode  │
│    if cycling         if stagnant   (8 factors)  (+BFS nav) │
└──────────────────────────────────────────────────────────────┘
```

## Decision Pipeline

### 1. Loop Detection

Before evaluating any move, the algorithm checks if the snake is stuck in a **positional cycle** (period 2, 3, or 4) by comparing the last 20 trail positions.

If a cycle is detected → **force a random move** to escape.

### 2. Stagnation-Aware ε-Greedy

The engine tracks how many consecutive turns each snake has moved **without painting a new cell**. This "stagnation counter" feeds into an epsilon-greedy mechanism:

| Stagnation | Random Probability |
|------------|-------------------|
| 0 turns    | 0.5% (base)       |
| 10 turns   | 8.5%              |
| 20+ turns  | 15.5% (capped)    |

**Formula**: `ε = 0.005 + min(0.15, stagnation × 0.008)`

This ensures the snake moves efficiently when actively painting but injects increasing randomness when stuck, breaking any repetitive pattern.

### 3. Multi-Factor Move Scoring

When not forced into a random move, each valid direction is scored using 9 weighted heuristics:

#### Factor 1: Distance-Decayed BFS (Paintable Score)

A breadth-first search up to depth 30 counts **unpainted cells only**, weighted by distance:

```
weight = (maxDepth - depth) / maxDepth

Nearby cell (depth 1):  weight ≈ 0.97
Mid-range (depth 15):   weight ≈ 0.50
Far cell (depth 29):    weight ≈ 0.03
```

**Key design decision**: Enemy cells score **zero** in BFS. Only `CellOwner.None` cells attract the snake. This completely eliminates the "chase-loop" bug where snakes follow behind the enemy's trail instead of seeking fresh territory.

#### Factor 2: Frontier Bonus (+15 / -2 / -5)

| Next cell type | Bonus  |
|---------------|--------|
| Unpainted     | **+15** |
| Enemy         | **-2**  |
| Own territory | **-5**  |

The strong asymmetry ensures the snake always prefers fresh ground over repainting.

#### Factor 3: Global Compass (+10)

Scans the **entire grid** to find the center of mass of all remaining unpainted cells, then rewards moving in that cardinal direction. This gives the snake a "sense of direction" beyond the BFS horizon.

#### Factor 4: Recently-Visited Penalty (-8)

Positions visited in the last 15 steps receive a penalty, discouraging small-area looping.

#### Factor 5: Escape Route Detection (-5 / -20)

A short-range BFS (depth 5) counts reachable cells. If very few cells are accessible:

| Reachable cells | Penalty |
|----------------|---------|
| < 3            | **-20** (dead end!) |
| < 6            | **-5**  |
| ≥ 6            | 0       |

This prevents the snake from entering corridors or corners with no way out.

#### Factor 6: Opponent Avoidance (+10 / -8)

When within **Manhattan distance 5** of the opponent:
- Moving **away**: +10 bonus
- Moving **toward**: -8 penalty

This separates the two snakes, ensuring they explore different regions of the grid rather than fighting over the same area.

#### Factor 7: Sweep Direction Continuity (+2)

A small bonus for continuing in the current heading direction, producing cleaner sweep patterns instead of erratic zig-zagging.

#### Factor 8: Edge Avoidance (-1)

A minor penalty for moving to grid edges, subtly encouraging interior exploration.

#### Factor 9: Long-Range Navigation (+30 / -10)

**"Nav Mode"** activates when the BFS paintable score from the snake's current position is below 1.0, meaning the snake is surrounded by its own territory with no nearby targets.

In nav mode:
- A full-grid BFS finds the **nearest unpainted or enemy cell** and traces the shortest path back to the snake
- The direction of the **first step** on that shortest path receives a **+30 bonus**
- All other directions receive a **-10 penalty**
- The recently-visited penalty window extends from 15 to **30 steps** to prevent backtracking
- The recently-visited penalty itself increases (-8 → **-15**)

This eliminates the "circling in own territory" problem: instead of wandering aimlessly when all nearby cells are painted, the snake marches purposefully toward the nearest target. The ε-greedy mechanism still provides natural variation.

### Final Score

```
score = BFS_paintable
      + frontier_bonus
      + compass_bonus
      + recent_penalty
      + escape_penalty
      + opponent_avoidance
      + sweep_bonus
      + edge_penalty
      + nav_bonus           ← NEW (Factor 9)
      + random_jitter(0, 0.5)
```

The small random jitter (0–0.5) breaks ties between equally-scored moves.

## Results

With this algorithm, the snakes consistently achieve:

- **100% grid coverage** across multiple runs
- **0 chase-loop incidents** (snakes explore independently)
- **Natural variation** in territory split due to ε-greedy randomness
- **Efficient early-game painting** (~45% coverage by turn 100)

## Architecture

```
engine.ts                    solver/index.ts
┌──────────────────┐        ┌──────────────────────────┐
│ Game Loop        │        │ chooseDirection()         │
│                  │        │                          │
│ For each turn:   │        │ 1. detectLoop()          │
│  track stagnation├───────▶│ 2. ε-greedy check        │
│  call solver     │        │ 3. aggressiveStrategy()  │
│  update grid     │        │    ├─ BFS scoring        │
│  record frame    │        │    ├─ frontier bonus      │
│                  │        │    ├─ compass             │
└──────────────────┘        │    ├─ escape check        │
                            │    ├─ opponent avoidance  │
                            │    └─ sweep + edge        │
                            └──────────────────────────┘
```
