/**
 * Pure Arachnoid game logic: no DOM, no React, no timers. The route owns the
 * canvas and the animation loop and calls `step` once per frame.
 */

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 360;
export const BRICK_ROWS = 5;
export const BRICK_COLS = 8;
export const BRICK_GAP = 4;
export const BRICK_TOP = 36;
export const BRICK_HEIGHT = 18;
export const BRICK_WIDTH =
  (GAME_WIDTH - BRICK_GAP * (BRICK_COLS + 1)) / BRICK_COLS;
export const PADDLE_WIDTH = 72;
export const PADDLE_HEIGHT = 10;
export const PADDLE_Y = GAME_HEIGHT - 28;
export const PADDLE_SPEED = 420;
export const BALL_RADIUS = 6;
export const BALL_SPEED = 260;
export const POINTS_PER_BRICK = 10;
export const START_LIVES = 3;
export const SERVE_DELAY = 0.8;

const MAX_STEP = 1 / 120;
const MAX_FRAME = 0.05;
const MAX_BOUNCE_ANGLE = Math.PI / 3;
const SERVE_ANGLE = Math.PI / 12;

export interface Ball {
  vx: number;
  vy: number;
  x: number;
  y: number;
}

export interface GameState {
  ball: Ball;
  /** One flag per brick, row-major. `true` means still standing. */
  bricks: boolean[];
  lives: number;
  /** Paddle centre x. */
  paddleX: number;
  score: number;
  /** Seconds until the ball launches; 0 once it is in play. */
  serveTimer: number;
  status: "playing" | "over";
}

export function brickRect(index: number) {
  const row = Math.floor(index / BRICK_COLS);
  const col = index % BRICK_COLS;
  return {
    h: BRICK_HEIGHT,
    w: BRICK_WIDTH,
    x: BRICK_GAP + col * (BRICK_WIDTH + BRICK_GAP),
    y: BRICK_TOP + row * (BRICK_HEIGHT + BRICK_GAP),
  };
}

function servedBall(paddleX: number): Ball {
  return { vx: 0, vy: 0, x: paddleX, y: PADDLE_Y - BALL_RADIUS };
}

export function createGame(): GameState {
  const paddleX = GAME_WIDTH / 2;
  return {
    ball: servedBall(paddleX),
    bricks: new Array<boolean>(BRICK_ROWS * BRICK_COLS).fill(true),
    lives: START_LIVES,
    paddleX,
    score: 0,
    serveTimer: SERVE_DELAY,
    status: "playing",
  };
}

export function bricksLeft(state: GameState): number {
  return state.bricks.filter(Boolean).length;
}

/** Puts the paddle's centre at `x`, kept inside the playfield. */
export function setPaddle(state: GameState, x: number): void {
  const half = PADDLE_WIDTH / 2;
  state.paddleX = Math.min(GAME_WIDTH - half, Math.max(half, x));
}

function launch(state: GameState): void {
  // Slightly off-vertical so the first serve is not a straight line.
  state.ball.vx = BALL_SPEED * Math.sin(SERVE_ANGLE);
  state.ball.vy = -BALL_SPEED * Math.cos(SERVE_ANGLE);
}

function loseLife(state: GameState): void {
  state.lives -= 1;
  if (state.lives <= 0) {
    state.status = "over";
    return;
  }
  state.ball = servedBall(state.paddleX);
  state.serveTimer = SERVE_DELAY;
}

function hitBrick(state: GameState): void {
  const { ball } = state;
  for (let i = 0; i < state.bricks.length; i += 1) {
    if (!state.bricks[i]) {
      continue;
    }
    const r = brickRect(i);
    const nearestX = Math.min(r.x + r.w, Math.max(r.x, ball.x));
    const nearestY = Math.min(r.y + r.h, Math.max(r.y, ball.y));
    const dx = ball.x - nearestX;
    const dy = ball.y - nearestY;
    if (dx * dx + dy * dy > BALL_RADIUS * BALL_RADIUS) {
      continue;
    }
    state.bricks[i] = false;
    state.score += POINTS_PER_BRICK;
    // Bounce on the axis with the smaller penetration (the side that was hit).
    const overlapX = BALL_RADIUS + r.w / 2 - Math.abs(ball.x - (r.x + r.w / 2));
    const overlapY = BALL_RADIUS + r.h / 2 - Math.abs(ball.y - (r.y + r.h / 2));
    if (overlapX < overlapY) {
      ball.vx = -ball.vx;
    } else {
      ball.vy = -ball.vy;
    }
    return;
  }
}

function hitPaddle(state: GameState): void {
  const { ball } = state;
  const half = PADDLE_WIDTH / 2;
  const reachesPaddle =
    ball.vy > 0 &&
    ball.y + BALL_RADIUS >= PADDLE_Y &&
    ball.y - BALL_RADIUS <= PADDLE_Y + PADDLE_HEIGHT &&
    ball.x >= state.paddleX - half - BALL_RADIUS &&
    ball.x <= state.paddleX + half + BALL_RADIUS;
  if (!reachesPaddle) {
    return;
  }
  const offset = Math.max(-1, Math.min(1, (ball.x - state.paddleX) / half));
  const angle = offset * MAX_BOUNCE_ANGLE;
  ball.vx = BALL_SPEED * Math.sin(angle);
  ball.vy = -BALL_SPEED * Math.cos(angle);
  ball.y = PADDLE_Y - BALL_RADIUS;
}

function moveBall(state: GameState, dt: number): void {
  const { ball } = state;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  if (ball.x < BALL_RADIUS) {
    ball.x = BALL_RADIUS;
    ball.vx = Math.abs(ball.vx);
  } else if (ball.x > GAME_WIDTH - BALL_RADIUS) {
    ball.x = GAME_WIDTH - BALL_RADIUS;
    ball.vx = -Math.abs(ball.vx);
  }
  if (ball.y < BALL_RADIUS) {
    ball.y = BALL_RADIUS;
    ball.vy = Math.abs(ball.vy);
  }

  hitPaddle(state);
  hitBrick(state);

  if (bricksLeft(state) === 0) {
    state.status = "over";
  } else if (ball.y - BALL_RADIUS > GAME_HEIGHT) {
    loseLife(state);
  }
}

/**
 * Advances the game by `dt` seconds. Large frames are split into small steps
 * so the ball cannot tunnel through a brick. Does nothing once the game is over.
 */
export function step(state: GameState, dt: number): void {
  let remaining = Math.min(Math.max(dt, 0), MAX_FRAME);
  while (remaining > 0 && state.status === "playing") {
    const slice = Math.min(remaining, MAX_STEP);
    remaining -= slice;
    if (state.serveTimer > 0) {
      state.ball = servedBall(state.paddleX);
      state.serveTimer = Math.max(0, state.serveTimer - slice);
      if (state.serveTimer === 0) {
        launch(state);
      }
    } else {
      moveBall(state, slice);
    }
  }
}
