-- Demo data for local development. `bun run dev` applies it after the
-- migrations. INSERT OR IGNORE keeps it safe to run on every start.
INSERT OR IGNORE INTO members (id, email, name, role, joined_at) VALUES
  (1, 'kim@example.com', 'Kim Nguyen', 'admin', '2026-01-12T00:00:00.000Z'),
  (2, 'ana@example.com', 'Ana Rossi', 'member', '2026-03-02T00:00:00.000Z'),
  (3, 'ben@example.com', 'Ben Walker', 'member', '2026-06-20T00:00:00.000Z');

INSERT OR IGNORE INTO rooms (id, name, capacity, archived) VALUES
  (1, 'Harbour', 10, 0),
  (2, 'Bridge', 2, 0),
  (3, 'Quay', 6, 0);

INSERT OR IGNORE INTO game_scores (id, member_id, score, created_at) VALUES
  (1, 2, 240, '2026-11-10T09:15:00.000Z'),
  (2, 3, 180, '2026-11-10T11:40:00.000Z'),
  (3, 1, 320, '2026-11-11T14:05:00.000Z'),
  (4, 2, 120, '2026-11-12T16:30:00.000Z');
