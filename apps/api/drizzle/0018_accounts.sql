-- Accounts for a public launch: email verification, single-use emailed tokens (password reset, verify), and sign-in
-- counters that survive a restart.
ALTER TABLE `users` ADD `email_verified_at` text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `auth_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `auth_tokens_hash` ON `auth_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `auth_tokens_user` ON `auth_tokens` (`user_id`, `kind`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `auth_throttle` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window_start` integer NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL
);
