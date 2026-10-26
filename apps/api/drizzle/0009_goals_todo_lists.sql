-- to-dos: four priorities (P1 3, P2 2, P3 1, none 0); the old High (2) becomes P1 and the old Medium (1) becomes P2
UPDATE `todos` SET `priority` = `priority` + 1 WHERE `priority` > 0;--> statement-breakpoint
-- a to-do's own highlight colour, and the list it is in
ALTER TABLE `todos` ADD `color` text;--> statement-breakpoint
ALTER TABLE `todos` ADD `group_id` text;--> statement-breakpoint
-- the owner's named lists of to-dos, each with a colour
CREATE TABLE `todo_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text
);--> statement-breakpoint
CREATE INDEX `todo_groups_user` ON `todo_groups` (`user_id`);--> statement-breakpoint
-- goals: one per level (year, month, week, day) and period
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`level` text NOT NULL,
	`period` text NOT NULL,
	`text` text NOT NULL,
	`original` text,
	`why` text,
	`status` text DEFAULT 'open' NOT NULL,
	`reflection` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`closed_at` text,
	`deleted_at` text
);--> statement-breakpoint
CREATE INDEX `goals_user` ON `goals` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `goals_user_level_period` ON `goals` (`user_id`,`level`,`period`);--> statement-breakpoint
-- every change to a goal, kept for the history
CREATE TABLE `goal_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`goal_id` text NOT NULL,
	`level` text NOT NULL,
	`period` text NOT NULL,
	`kind` text NOT NULL,
	`text` text,
	`at` text NOT NULL
);--> statement-breakpoint
CREATE INDEX `goal_events_user_at` ON `goal_events` (`user_id`,`at`);--> statement-breakpoint
CREATE INDEX `goal_events_goal` ON `goal_events` (`goal_id`);
