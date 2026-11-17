PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_game_scores` (
	`created_at` text NOT NULL,
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`score` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "game_scores_score_non_negative" CHECK("__new_game_scores"."score" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_game_scores`("created_at", "id", "member_id", "score") SELECT "created_at", "id", "member_id", "score" FROM `game_scores`;--> statement-breakpoint
DROP TABLE `game_scores`;--> statement-breakpoint
ALTER TABLE `__new_game_scores` RENAME TO `game_scores`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `game_scores_score_created` ON `game_scores` (`score`,`created_at`);