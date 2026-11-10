-- The security log (sign-in, sign-up, password, consent and deletion events, by a keyed hash of the account id), and
-- which phone an Apple Health token belongs to, so connecting again from the same phone ends its earlier token.
CREATE TABLE IF NOT EXISTS `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` text NOT NULL,
	`event` text NOT NULL,
	`user_hash` text,
	`detail` text
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_log_at` ON `audit_log` (`at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_log_user` ON `audit_log` (`user_hash`, `at`);--> statement-breakpoint
ALTER TABLE `health_devices` ADD `device_key` text;--> statement-breakpoint
-- Tables an earlier, since reverted, server version created in production. This code never reads them, account
-- deletion never reached them, and some held personal data (chat threads, memory notes, sign-in tokens for other
-- services, push subscriptions). They go. A database that never had them is untouched.
DROP TABLE IF EXISTS `assistant_messages`;--> statement-breakpoint
DROP TABLE IF EXISTS `assistant_threads`;--> statement-breakpoint
DROP TABLE IF EXISTS `user_memory`;--> statement-breakpoint
DROP TABLE IF EXISTS `llm_usage`;--> statement-breakpoint
DROP TABLE IF EXISTS `push_subscriptions`;--> statement-breakpoint
DROP TABLE IF EXISTS `reminders`;--> statement-breakpoint
DROP TABLE IF EXISTS `notification_log`;--> statement-breakpoint
DROP TABLE IF EXISTS `provider_connections`;--> statement-breakpoint
DROP TABLE IF EXISTS `provider_clients`;--> statement-breakpoint
DROP TABLE IF EXISTS `email_tokens`;--> statement-breakpoint
DROP TABLE IF EXISTS `leases`;--> statement-breakpoint
DROP TABLE IF EXISTS `job_runs`;--> statement-breakpoint
DROP TABLE IF EXISTS `rate_limits`;
--> statement-breakpoint
-- A habit check belongs to the account that owns the habit. A row another account wrote under someone's habit (the
-- old import allowed it) is removed.
DELETE FROM `habit_checks` WHERE `user_id` <> (SELECT `user_id` FROM `habits` WHERE `habits`.`id` = `habit_checks`.`habit_id`);
