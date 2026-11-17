import { submitScoreInput } from "@repo/services/game-scores";
import { publicProcedure, router } from "../init.ts";

// Thin on purpose: validation and rules live in @repo/services. No auth yet,
// so the acting member comes in as `actorId`.
export const gameScoresRouter = router({
  submit: publicProcedure
    .input(submitScoreInput)
    .mutation(({ ctx, input }) =>
      ctx.services.gameScores.submit(input.actorId, input)
    ),
  top: publicProcedure.query(({ ctx }) => ctx.services.gameScores.top()),
});
