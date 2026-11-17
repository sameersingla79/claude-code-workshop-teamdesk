import { describe, expect, test } from "bun:test";
import {
  BALL_RADIUS,
  BRICK_COLS,
  BRICK_ROWS,
  brickRect,
  bricksLeft,
  createGame,
  GAME_HEIGHT,
  GAME_WIDTH,
  PADDLE_WIDTH,
  PADDLE_Y,
  POINTS_PER_BRICK,
  START_LIVES,
  setPaddle,
  step,
} from "./arachnoid-game.ts";

function inPlay() {
  const game = createGame();
  game.serveTimer = 0;
  return game;
}

describe("arachnoid-game", () => {
  test("starts with 5x8 bricks, 3 lives and no score", () => {
    const game = createGame();
    expect(game.bricks).toHaveLength(40);
    expect(BRICK_ROWS * BRICK_COLS).toBe(40);
    expect(bricksLeft(game)).toBe(40);
    expect(game.lives).toBe(START_LIVES);
    expect(game.score).toBe(0);
    expect(game.status).toBe("playing");
  });

  test("ball launches after the serve delay", () => {
    const game = createGame();
    step(game, 0.05);
    expect(game.ball.vy).toBe(0);
    for (let i = 0; i < 30; i += 1) {
      step(game, 0.05);
    }
    expect(game.ball.vy).not.toBe(0);
  });

  test("paddle is clamped to the playfield", () => {
    const game = createGame();
    setPaddle(game, -50);
    expect(game.paddleX).toBe(PADDLE_WIDTH / 2);
    setPaddle(game, GAME_WIDTH + 50);
    expect(game.paddleX).toBe(GAME_WIDTH - PADDLE_WIDTH / 2);
  });

  test("ball bounces off the side and top walls", () => {
    const game = inPlay();
    game.ball = { vx: -200, vy: -200, x: BALL_RADIUS + 1, y: BALL_RADIUS + 1 };
    step(game, 0.02);
    expect(game.ball.vx).toBeGreaterThan(0);
    expect(game.ball.vy).toBeGreaterThan(0);
  });

  test("ball bounces off the paddle", () => {
    const game = inPlay();
    setPaddle(game, 200);
    game.ball = { vx: 0, vy: 200, x: 200, y: PADDLE_Y - BALL_RADIUS - 1 };
    step(game, 0.02);
    expect(game.ball.vy).toBeLessThan(0);
    expect(game.lives).toBe(START_LIVES);
  });

  test("hitting a brick removes it and scores 10", () => {
    const game = inPlay();
    const r = brickRect(BRICK_COLS * (BRICK_ROWS - 1));
    game.ball = {
      vx: 0,
      vy: -200,
      x: r.x + r.w / 2,
      y: r.y + r.h + BALL_RADIUS + 1,
    };
    step(game, 0.02);
    expect(game.score).toBe(POINTS_PER_BRICK);
    expect(bricksLeft(game)).toBe(39);
    expect(game.ball.vy).toBeGreaterThan(0);
  });

  test("missing the ball costs a life and re-serves", () => {
    const game = inPlay();
    setPaddle(game, 40);
    game.ball = { vx: 0, vy: 200, x: 400, y: GAME_HEIGHT + BALL_RADIUS - 1 };
    step(game, 0.02);
    expect(game.lives).toBe(START_LIVES - 1);
    expect(game.status).toBe("playing");
    expect(game.serveTimer).toBeGreaterThan(0);
    expect(game.ball.vy).toBe(0);
  });

  test("game is over at 0 lives and stops advancing", () => {
    const game = inPlay();
    game.lives = 1;
    setPaddle(game, 40);
    game.ball = { vx: 0, vy: 200, x: 400, y: GAME_HEIGHT + BALL_RADIUS - 1 };
    step(game, 0.02);
    expect(game.lives).toBe(0);
    expect(game.status).toBe("over");
    const before = { ...game.ball };
    step(game, 0.05);
    expect(game.ball).toEqual(before);
  });

  test("clearing the last brick ends the game with the full score", () => {
    const game = inPlay();
    game.bricks.fill(false);
    game.score = 390;
    game.bricks[0] = true;
    const r = brickRect(0);
    game.ball = {
      vx: 0,
      vy: -200,
      x: r.x + r.w / 2,
      y: r.y + r.h + BALL_RADIUS + 1,
    };
    step(game, 0.02);
    expect(game.score).toBe(400);
    expect(game.status).toBe("over");
    expect(game.lives).toBe(START_LIVES);
  });
});
