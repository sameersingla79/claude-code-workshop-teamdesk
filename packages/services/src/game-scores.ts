// Business rules for the Arachnoid leaderboard. `@repo/db/game-scores` only
// stores and reads; membership and the score range are checked here.
import type { Database } from "@repo/db";
import { createGameScore, listTopGameScores } from "@repo/db/game-scores";
import { GAME_SCORE_MAX, type GameScore } from "@repo/db/shared";
import { z } from "zod";
import { ValidationError } from "./errors.ts";
import { requireMember } from "./members.ts";

/** Entries on the leaderboard. */
export const GAME_SCORE_TOP_LIMIT = 10;

/** Also the tRPC input schema, so the router and the service agree. */
export const submitScoreInput = z.object({
  actorId: z.string(),
  score: z
    .number()
    .int("Score must be a whole number.")
    .min(0, "Score must not be negative.")
    .max(GAME_SCORE_MAX, `Score must be at most ${GAME_SCORE_MAX}.`),
});

export type SubmitScoreInput = z.input<typeof submitScoreInput>;

export interface GameScoresService {
  /** Stores a score for the acting member. Throws on a bad member or score. */
  submit: (actorId: string, input: SubmitScoreInput) => Promise<GameScore>;
  /** Best score first; earlier runs win ties. */
  top: () => Promise<GameScore[]>;
}

export const createGameScoresService = (db: Database): GameScoresService => ({
  submit: async (actorId, input) => {
    await requireMember(db, actorId);
    // safeParse so a bad score is a ValidationError (400), not a raw ZodError (500).
    const parsed = submitScoreInput.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((issue) => issue.message).join(" ")
      );
    }
    return await createGameScore(db, {
      memberId: actorId,
      score: parsed.data.score,
    });
  },
  top: () => listTopGameScores(db, GAME_SCORE_TOP_LIMIT),
});
