-- accounts for the public: email verification, password reset links, and sessions people can see and end
ALTER TABLE `users` ADD `email_verified_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `password_changed_at` text;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `last_seen_at` text;--> statement-breakpoint
-- accounts from before verification existed are taken as verified (their owner is already using them); only new sign-ups get the link
UPDATE `users` SET `email_verified_at` = `created_at` WHERE `email_verified_at` IS NULL;--> statement-breakpoint
CREATE TABLE `email_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	`created_at` text NOT NULL
);--> statement-breakpoint
CREATE INDEX `email_tokens_user` ON `email_tokens` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_tokens_hash` ON `email_tokens` (`token_hash`);
