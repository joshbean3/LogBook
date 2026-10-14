-- the account's name ("Josh"), for the avatar and Settings → You (contract 6); null until the athlete gives one
ALTER TABLE `users` ADD `name` text;--> statement-breakpoint
-- a deleted plan block is kept (soft delete) so Undo and POST /blocks/:id/restore bring it back exactly (contracts 1 and 2)
ALTER TABLE `plan_blocks` ADD `deleted_at` text;--> statement-breakpoint
-- idempotent writes (contract 4): the first answer to each Idempotency-Key, per user, kept 24 hours
CREATE TABLE `idempotency_keys` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`method` text NOT NULL,
	`path` text NOT NULL,
	`status` integer NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `key`)
);--> statement-breakpoint
CREATE INDEX `idempotency_keys_created` ON `idempotency_keys` (`created_at`);
