import { beforeEach, describe, expect, test } from "bun:test";
import { createGameScore, listTopGameScores } from "./game-scores.ts";
import { createMember } from "./members.ts";
import { type Database, gameScores } from "./schema.ts";
import { createTestDatabase } from "./testing.ts";

let db: Database;
let anaId: string;
let benId: string;

beforeEach(async () => {
  db = createTestDatabase();
  anaId = (
    await createMember(db, {
      email: "ana@example.com",
      name: "Ana",
      role: "member",
    })
  ).id;
  benId = (
    await createMember(db, {
      email: "ben@example.com",
      name: "Ben",
      role: "member",
    })
  ).id;
});

describe("game scores", () => {
  test("createGameScore stores the score and returns plain JSON", async () => {
    const score = await createGameScore(db, { memberId: anaId, score: 120 });

    expect(score).toMatchObject({
      memberId: anaId,
      memberName: "Ana",
      score: 120,
    });
    expect(typeof score.id).toBe("string");
    expect(new Date(score.createdAt).toISOString()).toBe(score.createdAt);
  });

  test("listTopGameScores orders by score descending and honours the limit", async () => {
    await createGameScore(db, { memberId: anaId, score: 50 });
    await createGameScore(db, { memberId: benId, score: 300 });
    await createGameScore(db, { memberId: anaId, score: 120 });

    const top = await listTopGameScores(db, 2);

    expect(top.map((s) => s.score)).toEqual([300, 120]);
    expect(top[0]?.memberName).toBe("Ben");
  });

  test("equal scores are ordered by created_at ascending", async () => {
    await db.insert(gameScores).values([
      {
        createdAt: "2026-10-23T10:00:00.000Z",
        memberId: Number(benId),
        score: 90,
      },
      {
        createdAt: "2026-10-23T09:00:00.000Z",
        memberId: Number(anaId),
        score: 90,
      },
    ]);

    const top = await listTopGameScores(db, 10);

    expect(top.map((s) => s.memberName)).toEqual(["Ana", "Ben"]);
  });

  test("createGameScore rejects a negative score at the database level", async () => {
    await expect(
      createGameScore(db, { memberId: anaId, score: -1 })
    ).rejects.toThrow();
  });

  test("the same member can appear more than once", async () => {
    await createGameScore(db, { memberId: anaId, score: 200 });
    await createGameScore(db, { memberId: anaId, score: 100 });

    const top = await listTopGameScores(db, 10);

    expect(top.map((s) => s.memberName)).toEqual(["Ana", "Ana"]);
  });
});
