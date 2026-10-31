-- a day's plan: the morning, afternoon and evening, each an ordered list of to-do and goal-step references
CREATE TABLE `day_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`bands` text DEFAULT '{"morning":[],"afternoon":[],"evening":[]}' NOT NULL,
	`updated_at` text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `day_plans_user_date` ON `day_plans` (`user_id`,`date`);
