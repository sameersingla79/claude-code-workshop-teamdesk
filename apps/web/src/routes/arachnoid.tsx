import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import FormError from "#/components/form-error";
import MemberPicker from "#/components/member-picker";
import PageError from "#/components/page-error";
import { Button } from "#/components/ui/button";
import { useActingMember } from "#/hooks/use-acting-member";
import { useAction } from "#/hooks/use-action";
import { getTrpc } from "#/integrations/trpc/client";
import {
  BALL_RADIUS,
  brickRect,
  createGame,
  GAME_HEIGHT,
  GAME_WIDTH,
  type GameState,
  PADDLE_HEIGHT,
  PADDLE_SPEED,
  PADDLE_WIDTH,
  PADDLE_Y,
  setPaddle,
  step,
} from "#/lib/arachnoid-game";

export const Route = createFileRoute("/arachnoid")({
  loader: async () => {
    const trpc = getTrpc();
    const [members, scores] = await Promise.all([
      trpc.members.list.query(),
      trpc.gameScores.top.query(),
    ]);
    return { members, scores };
  },
  component: ArachnoidPage,
  errorComponent: PageError,
});

const ROW_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6"];

function draw(ctx: CanvasRenderingContext2D, game: GameState) {
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  game.bricks.forEach((alive, index) => {
    if (!alive) {
      return;
    }
    const r = brickRect(index);
    ctx.fillStyle =
      ROW_COLORS[Math.floor(index / 8) % ROW_COLORS.length] ?? "#3b82f6";
    ctx.fillRect(r.x, r.y, r.w, r.h);
  });

  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(
    game.paddleX - PADDLE_WIDTH / 2,
    PADDLE_Y,
    PADDLE_WIDTH,
    PADDLE_HEIGHT
  );

  ctx.beginPath();
  ctx.arc(game.ball.x, game.ball.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = "#f8fafc";
  ctx.fill();
}

function ArachnoidPage() {
  const { members, scores } = Route.useLoaderData();
  const { actingMember, setActingMemberId } = useActingMember(members);
  const submitScore = useAction();
  const actorId = actingMember?.id ?? "";

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef(null as GameState | null);
  const leftRef = useRef(false as boolean);
  const rightRef = useRef(false as boolean);
  const submittedRef = useRef(false as boolean);
  const playerRef = useRef("");
  const [running, setRunning] = useState(false);
  const [hud, setHud] = useState({ lives: 3, score: 0 });
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const submit = useCallback(
    async (memberId: string, score: number) => {
      // The ref is set synchronously, so a second call before the first
      // resolves cannot send a duplicate. A failure releases it for a retry.
      if (submittedRef.current) {
        return;
      }
      submittedRef.current = true;
      const ok = await submitScore.run(() =>
        getTrpc().gameScores.submit.mutate({ actorId: memberId, score })
      );
      if (!ok) {
        submittedRef.current = false;
      }
    },
    [submitScore.run]
  );

  const submitRef = useRef(submit);
  submitRef.current = submit;

  const handlePlay = useCallback(() => {
    if (!actorId) {
      return;
    }
    playerRef.current = actorId;
    submittedRef.current = false;
    gameRef.current = createGame();
    setFinalScore(null);
    setHud({ lives: 3, score: 0 });
    setRunning(true);
  }, [actorId]);

  // Paint an idle board once so the canvas is not blank before the first run.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && !gameRef.current) {
      draw(ctx, createGame());
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent, down: boolean) => {
      if (event.key === "ArrowLeft") {
        leftRef.current = down;
        event.preventDefault();
      } else if (event.key === "ArrowRight") {
        rightRef.current = down;
        event.preventDefault();
      }
    };
    const onDown = (event: KeyboardEvent) => onKey(event, true);
    const onUp = (event: KeyboardEvent) => onKey(event, false);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  useEffect(() => {
    if (!running) {
      return;
    }
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) {
      return;
    }
    let frame = 0;
    let last = performance.now();
    let lastLives = -1;
    let lastScore = -1;

    const tick = (now: number) => {
      const { current: game } = gameRef;
      if (!game) {
        return;
      }
      const dt = (now - last) / 1000;
      last = now;

      const dir = (rightRef.current ? 1 : 0) - (leftRef.current ? 1 : 0);
      if (dir !== 0) {
        setPaddle(game, game.paddleX + dir * PADDLE_SPEED * dt);
      }
      step(game, dt);
      draw(ctx, game);

      if (game.lives !== lastLives || game.score !== lastScore) {
        lastLives = game.lives;
        lastScore = game.score;
        setHud({ lives: game.lives, score: game.score });
      }

      if (game.status === "over") {
        setRunning(false);
        setFinalScore(game.score);
        submitRef.current(playerRef.current, game.score);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const { current: game } = gameRef;
      if (game?.status !== "playing") {
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      setPaddle(game, ((event.clientX - rect.left) / rect.width) * GAME_WIDTH);
    },
    []
  );

  const handleRetry = useCallback(() => {
    if (finalScore !== null) {
      submit(playerRef.current, finalScore);
    }
  }, [finalScore, submit]);

  return (
    <main className="page-wrap px-4 py-12">
      <section className="flex max-w-3xl flex-col gap-4">
        <p className="island-kicker m-0">Teamdesk</p>
        <h1 className="display-title m-0 text-4xl text-foreground sm:text-5xl">
          Arachnoid
        </h1>
        <p className="m-0 text-base text-muted-foreground leading-8">
          Break all 40 bricks with three lives. Move the paddle with the mouse
          or the left and right arrow keys. Your score is saved when the run
          ends.
        </p>
        <MemberPicker
          members={members}
          onChange={setActingMemberId}
          value={actingMember?.id}
        />
      </section>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        <section className="flex max-w-[480px] flex-1 flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span>Score: {hud.score}</span>
            <span>Lives: {hud.lives}</span>
          </div>
          <canvas
            aria-label="Arachnoid game board"
            className="w-full rounded-lg border border-border"
            height={GAME_HEIGHT}
            onMouseMove={handleMouseMove}
            ref={canvasRef}
            width={GAME_WIDTH}
          />
          <div className="flex items-center gap-3">
            <Button
              disabled={!actingMember || running || submitScore.pending}
              onClick={handlePlay}
            >
              {finalScore === null ? "Play" : "Play again"}
            </Button>
            {actingMember ? null : (
              <span className="text-muted-foreground text-sm">
                Pick a member to play.
              </span>
            )}
            {finalScore !== null && (
              <span className="text-sm">
                Game over: {finalScore} points
                {submitScore.pending ? " (saving...)" : ""}
              </span>
            )}
          </div>
          <FormError message={submitScore.error} />
          {submitScore.error && finalScore !== null ? (
            <div>
              <Button onClick={handleRetry} variant="outline">
                Retry saving score
              </Button>
            </div>
          ) : null}
        </section>

        <section className="flex-1">
          <h2 className="mb-4 font-heading text-2xl text-foreground">Top 10</h2>
          {scores.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No scores yet. Be the first.
            </p>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {scores.map((entry, index) => (
                <li
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                  key={entry.id}
                >
                  <span>
                    {index + 1}. {entry.memberName}
                  </span>
                  <span className="font-semibold">{entry.score}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
