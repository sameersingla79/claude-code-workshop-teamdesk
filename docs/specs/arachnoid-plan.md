# Arachnoid implementation plan

Plan for [arachnoid.md](arachnoid.md). Three phases; commit after each.

## Phase 1: Data and DB layer
1. Add `game_scores` to `packages/db/src/schema.ts` (autoincrement `id`, `member_id` -> `members`, integer `score`, ISO `created_at`). Run `bun run generate` in `packages/db`; keep `migrations/` and `migrations/meta/`.
2. In `packages/db/src/shared.ts` add the `GameScore` type and `GAME_SCORE_MAX = 10000`.
3. Create `packages/db/src/game-scores.ts` with `createGameScore(db, {memberId, score})` and `listTopGameScores(db, limit)` (score DESC, created_at ASC, joined to member name; plain JSON shapes). Add the `exports` line in `packages/db/package.json`.
4. Add an in-memory `bun:sqlite` test (ordering, tie-break, limit, same member twice). Add seed rows to `packages/db/seed.sql`.

Done when: `bun test packages/db` passes and the migration applies.

## Phase 2: Service and tRPC
1. Create `packages/services/src/game-scores.ts`: `submitScoreInput` (zod; string `actorId`, integer `score` in `0..GAME_SCORE_MAX`), `submit(actorId, input)` (`requireMember`, re-parse, `ValidationError` on bad input, store), `top()` (top 10). Add the `exports` line in `packages/services/package.json`.
2. Register the service in `apps/web/src/server/trpc/context.ts`.
3. Add a thin `gameScores` router: `submit` mutation (takes `actorId`, no `protectedProcedure`), `top` query.
4. Tests: unknown member, negative score, oversized score, ordering, limit of 10.

Done when: `bun test` passes; no member or a score above the cap yields a 4xx, not a 500 (zod errors must surface as `ValidationError`).

## Phase 3: Game UI and wrap-up
1. Pure game-logic module (5x8 bricks, paddle, ball, collisions, 10 pts/brick, 3 lives, game-over on 0 lives or all cleared). Imports only `@repo/db/shared`; unit-testable apart from the canvas.
2. `apps/web/src/routes/arachnoid.tsx`: canvas, member picker (as in `bookings.tsx`), leaderboard beside it. Mouse and arrow-key input, rAF loop cleaned up on unmount, submit exactly once on game over, then refresh the board. Disable play until a member is picked.
3. Nav link in `__root.tsx`.
4. `bun run check` and `bun test`; verify with `bun run dev` that a run's score appears in the top 10.

Done when: every acceptance item in the spec passes.

## Risks
- Double submit on game over: guard with a `submitted` flag.
- Score cap (10000) far exceeds the real max (400); accepted, no anti-cheat per the spec.
