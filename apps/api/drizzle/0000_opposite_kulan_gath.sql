CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`time` text,
	`name` text NOT NULL,
	`sport_type` text NOT NULL,
	`kind` text NOT NULL,
	`distance_m` real DEFAULT 0 NOT NULL,
	`moving_sec` integer DEFAULT 0 NOT NULL,
	`elapsed_sec` integer DEFAULT 0 NOT NULL,
	`elev_m` real DEFAULT 0 NOT NULL,
	`avg_hr` integer,
	`max_hr` integer,
	`cadence` integer,
	`laps_json` text,
	`perf_at` text,
	`perf_failed` integer DEFAULT 0 NOT NULL,
	`deleted_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activities_user_date` ON `activities` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`user_agent` text
);
--> statement-breakpoint
CREATE TABLE `coach_reads` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`key` text NOT NULL,
	`text` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `date`, `key`)
);
--> statement-breakpoint
CREATE TABLE `daily_picks` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`kind` text NOT NULL,
	`item_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `date`, `kind`)
);
--> statement-breakpoint
CREATE TABLE `habit_checks` (
	`user_id` text NOT NULL,
	`habit_id` text NOT NULL,
	`date` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`note` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`habit_id`, `date`)
);
--> statement-breakpoint
CREATE INDEX `habit_checks_user_date` ON `habit_checks` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_on` text NOT NULL,
	`archived_on` text
);
--> statement-breakpoint
CREATE INDEX `habits_user` ON `habits` (`user_id`);--> statement-breakpoint
CREATE TABLE `hr_zones` (
	`user_id` text PRIMARY KEY NOT NULL,
	`zones_json` text NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`text` text NOT NULL,
	`fav` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`edited_at` text,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `journal_user_date` ON `journal_entries` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `lift_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`exercise` text NOT NULL,
	`weight` real NOT NULL,
	`reps` integer NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `lift_sets_user_date` ON `lift_sets` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `morning_days` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`mode` text NOT NULL,
	`type` text NOT NULL,
	`miles` real NOT NULL,
	`minutes` integer NOT NULL,
	`wake` integer NOT NULL,
	PRIMARY KEY(`user_id`, `date`)
);
--> statement-breakpoint
CREATE TABLE `plan_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`start` text NOT NULL,
	`end` text NOT NULL,
	`source` text,
	`summary` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `plan_blocks_user` ON `plan_blocks` (`user_id`);--> statement-breakpoint
CREATE TABLE `quote_prefs` (
	`user_id` text NOT NULL,
	`quote_id` text NOT NULL,
	`fav` integer DEFAULT false NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`user_id`, `quote_id`)
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`theme` text DEFAULT '' NOT NULL,
	`work` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `quotes_theme` ON `quotes` (`theme`);--> statement-breakpoint
CREATE TABLE `shown_items` (
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`item_id` text NOT NULL,
	`last_shown` text NOT NULL,
	PRIMARY KEY(`user_id`, `kind`, `item_id`)
);
--> statement-breakpoint
CREATE TABLE `strava_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`athlete_id` text NOT NULL,
	`athlete_name` text,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`scope` text,
	`created_at` text NOT NULL,
	`last_sync_at` text,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `todos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`text` text NOT NULL,
	`created_on` text NOT NULL,
	`done_on` text,
	`deleted_on` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `todos_user` ON `todos` (`user_id`);--> statement-breakpoint
CREATE TABLE `training_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`kind` text NOT NULL,
	`type` text,
	`title` text,
	`details` text,
	`miles` real,
	`minutes` integer,
	`block_id` text,
	`moved_from` text,
	`mark` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_user_date` ON `training_sessions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `sessions_block` ON `training_sessions` (`block_id`);--> statement-breakpoint
CREATE TABLE `user_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`text` text NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `user_quotes_user` ON `user_quotes` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`json` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `key`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);