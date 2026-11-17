import { asc, desc, eq } from "drizzle-orm";
import { type Database, gameScores, members } from "./schema.ts";
import type { GameScore } from "./shared.ts";

/** A score row joined to the member's name. */
interface GameScoreRow {
  createdAt: string;
  id: number;
  memberId: number;
  memberName: string;
  score: number;
}

function toGameScore(row: GameScoreRow): GameScore {
  return {
    createdAt: row.createdAt,
    id: String(row.id),
    memberId: String(row.memberId),
    memberName: row.memberName,
    score: row.score,
  };
}

const gameScoreColumns = {
  createdAt: gameScores.createdAt,
  id: gameScores.id,
  memberId: gameScores.memberId,
  memberName: members.name,
  score: gameScores.score,
};

/** Best score first; earlier runs win ties. A member may appear many times. */
export async function listTopGameScores(
  db: Database,
  limit: number
): Promise<GameScore[]> {
  const rows = await db
    .select(gameScoreColumns)
    .from(gameScores)
    .innerJoin(members, eq(gameScores.memberId, members.id))
    .orderBy(
      desc(gameScores.score),
      asc(gameScores.createdAt),
      asc(gameScores.id)
    )
    .limit(limit);
  return rows.map(toGameScore);
}

/**
 * Stores a score as given. Validation is the caller's job: go through
 * `@repo/services/game-scores`, which checks the member and the score range.
 */
export async function createGameScore(
  db: Database,
  input: { memberId: string; score: number }
): Promise<GameScore> {
  const [inserted] = await db
    .insert(gameScores)
    .values({
      createdAt: new Date().toISOString(),
      memberId: Number(input.memberId),
      score: input.score,
    })
    .returning({ id: gameScores.id });
  if (!inserted) {
    throw new Error("Score was inserted but could not be read back.");
  }
  const [row] = await db
    .select(gameScoreColumns)
    .from(gameScores)
    .innerJoin(members, eq(gameScores.memberId, members.id))
    .where(eq(gameScores.id, inserted.id))
    .limit(1);
  if (!row) {
    throw new Error("Score was inserted but could not be read back.");
  }
  return toGameScore(row);
}
