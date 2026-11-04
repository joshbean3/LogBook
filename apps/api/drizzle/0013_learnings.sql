-- what I learned: one row per thing learned, several a day, soft-deleted so a delete can be undone
CREATE TABLE IF NOT EXISTS `learnings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`text` text NOT NULL,
	`created_at` text NOT NULL,
	`edited_at` text,
	`deleted_at` text
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `learnings_user_date` ON `learnings` (`user_id`,`date`);
