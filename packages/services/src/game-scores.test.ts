import { beforeEach, describe, expect, test } from "bun:test";
import { GAME_SCORE_MAX } from "@repo/db/shared";
import { NotFoundError, ValidationError } from "./errors.ts";
import { createTeam, type Team } from "./fixtures.ts";
import {
  createGameScoresService,
  type GameScoresService,
} from "./game-scores.ts";

let team: Team;
let scores: GameScoresService;

beforeEach(async () => {
  team = await createTeam();
  scores = createGameScoresService(team.db);
});

describe("game scores service", () => {
  test("submit stores a score for a member", async () => {
    const score = await scores.submit(team.ana.id, {
      actorId: team.ana.id,
      score: 120,
    });

    expect(score.score).toBe(120);
    expect(score.memberName).toBe("Ana");
    expect(await scores.top()).toEqual([score]);
  });

  test("submit rejects an unknown member", async () => {
    await expect(
      scores.submit("999", { actorId: "999", score: 10 })
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await scores.top()).toEqual([]);
  });

  test("submit rejects negative, oversized and fractional scores", async () => {
    const results = await Promise.allSettled(
      [-1, GAME_SCORE_MAX + 1, 1.5].map((score) =>
        scores.submit(team.ana.id, { actorId: team.ana.id, score })
      )
    );
    for (const result of results) {
      expect(result.status).toBe("rejected");
      expect((result as PromiseRejectedResult).reason).toBeInstanceOf(
        ValidationError
      );
    }
    expect(await scores.top()).toEqual([]);
  });

  test("submit accepts the bounds 0 and GAME_SCORE_MAX", async () => {
    await scores.submit(team.ana.id, { actorId: team.ana.id, score: 0 });
    await scores.submit(team.ana.id, {
      actorId: team.ana.id,
      score: GAME_SCORE_MAX,
    });
    expect((await scores.top()).map((s) => s.score)).toEqual([
      GAME_SCORE_MAX,
      0,
    ]);
  });

  test("top orders by score descending and lets a member repeat", async () => {
    await scores.submit(team.ana.id, { actorId: team.ana.id, score: 50 });
    await scores.submit(team.ben.id, { actorId: team.ben.id, score: 300 });
    await scores.submit(team.ana.id, { actorId: team.ana.id, score: 100 });

    const top = await scores.top();
    expect(top.map((s) => [s.memberName, s.score])).toEqual([
      ["Ben", 300],
      ["Ana", 100],
      ["Ana", 50],
    ]);
  });

  test("top returns at most 10, keeping the best", async () => {
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        scores.submit(team.ben.id, {
          actorId: team.ben.id,
          score: (i + 1) * 10,
        })
      )
    );

    const top = await scores.top();
    expect(top).toHaveLength(10);
    expect(top[0]?.score).toBe(120);
    expect(top.at(-1)?.score).toBe(30);
  });
});
