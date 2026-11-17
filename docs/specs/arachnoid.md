# Arachnoid: brick-breaker game with a team leaderboard

Status: draft. Target build time: about 20 minutes.

## Goal
An Arkanoid-style brick breaker on its own page in Teamdesk. A team member plays
a run, and the score is saved to a shared top-10 leaderboard.

## Decisions from the interview
- Game type: Arkanoid-style (paddle, ball, bricks).
- Persistence: team leaderboard, where each finished run is one row.
- Player identity: the existing acting-member picker (`useActingMember`).
- Gameplay: minimal (see below).
- Leaderboard: top 10 runs, all-time. One member may appear more than once.

## Gameplay (v1)
- One fixed brick layout (for example 5 rows x 8 columns), drawn on a `<canvas>`.
- Paddle controlled by mouse movement or the left/right arrow keys.
- 3 lives. The ball falling past the paddle costs a life and resets the ball.
- 10 points per brick.
- The run ends when lives reach 0 or all bricks are cleared. On game over the
  score is submitted automatically for the acting member.
- The game loop and collision logic live in the browser only and import nothing
  but `@repo/db/shared`.

## Out of scope
Power-ups, multiple levels, ball speed ramping, sound, per-member best scores,
weekly or date-filtered boards, free-text player names, and anti-cheat (a score
is client-reported and trusted, like everything else without auth).

## Data
New table `game_scores` in `packages/db/src/schema.ts`:
- `id`: autoincrement integer, as in `notes`.
- `member_id`: references `members`.
- `score`: integer, at least 0.
- `created_at`: ISO timestamp.

After the schema edit, run `bun run generate` in `packages/db` and commit
`migrations/` including `migrations/meta/`. Add a few rows to
`packages/db/seed.sql` so the board is not empty in dev.

## Layers (copy `notes` and `bookings`)
1. `packages/db/src/game-scores.ts`
   - `createGameScore(db, { memberId, score })`
   - `listTopGameScores(db, limit)`: ordered by score descending, then
     `created_at` ascending, and joined to the member name.
   - Returns plain JSON shapes (string ids, ISO dates).
   - Add an `exports` line in `packages/db/package.json`.
   - Add a `Database`-only test with in-memory `bun:sqlite`.
2. `packages/db/src/shared.ts`: add the `GameScore` type and a `GAME_SCORE_MAX`
   constant (for example 10000) so the browser and service agree.
3. `packages/services/src/game-scores.ts`
   - `submitScoreInput` (zod): `actorId` is a string, and `score` is an integer
     in `0..GAME_SCORE_MAX`.
   - `submit(actorId, input)`: calls `requireMember`, re-parses the input, and
     stores the score. Throws `ValidationError` on bad input.
   - `top()`: returns the top 10.
   - Add an `exports` line in `packages/services/package.json`.
   - Register the service in `apps/web/src/server/trpc/context.ts`.
   - Add tests: unknown member rejected, negative or oversized score rejected,
     ordering and the limit of 10.
4. tRPC router `gameScores` (thin): `submit` is a mutation that takes `actorId`
   in its input and does not use `protectedProcedure`. `top` is a query.
5. Route `apps/web/src/routes/arachnoid.tsx`: the canvas game, the member picker
   (as in `bookings.tsx`), and the leaderboard beside it. Refresh the board
   after a score is submitted. Add a nav link in `__root.tsx`.

## Acceptance
- `bun run check` and `bun test` pass.
- With `bun run dev`, I can pick a member, play a run to game over, and see my
  score appear in the top 10 after a refresh.
- A submit with no member, or with a score above the cap, returns a 4xx rather
  than a 500.
