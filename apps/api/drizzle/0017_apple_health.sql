-- Apple Health (docs/health/apple-health.md §3.5): devices that may upload, the samples, the day sums, sleep segments,
-- workouts waiting to join the run list (phase 5), and the connection itself.
CREATE TABLE IF NOT EXISTS `health_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `health_devices_token` ON `health_devices` (`token_hash`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `health_samples` (
	`user_id` text NOT NULL,
	`uuid` text NOT NULL,
	`type` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`value` real NOT NULL,
	`unit` text NOT NULL,
	`source_bundle` text NOT NULL,
	`source_name` text NOT NULL,
	`product_type` text,
	`user_entered` integer NOT NULL DEFAULT 0,
	`tz` text,
	`deleted_at` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `uuid`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `health_samples_type` ON `health_samples` (`user_id`, `type`, `start_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `health_days` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`metric` text NOT NULL,
	`value` real,
	`buckets_json` text,
	`day_start_at` text NOT NULL,
	`tz` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `date`, `metric`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sleep_segments` (
	`user_id` text NOT NULL,
	`uuid` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`stage` text NOT NULL,
	`source_bundle` text NOT NULL,
	`source_name` text NOT NULL,
	`product_type` text,
	`tz` text,
	`deleted_at` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `uuid`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `sleep_segments_start` ON `sleep_segments` (`user_id`, `start_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `health_workouts` (
	`user_id` text NOT NULL,
	`uuid` text NOT NULL,
	`activity` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`duration_sec` real NOT NULL,
	`distance_m` real,
	`energy_kcal` real,
	`avg_hr` real,
	`max_hr` real,
	`hr_json` text,
	`source_bundle` text NOT NULL,
	`source_name` text NOT NULL,
	`product_type` text,
	`tz` text,
	`deleted_at` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `uuid`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `health_workouts_start` ON `health_workouts` (`user_id`, `start_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `health_batches` (
	`user_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`stored_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `batch_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `health_sync` (
	`user_id` text PRIMARY KEY NOT NULL,
	`connected_at` text NOT NULL,
	`last_sync_at` text,
	`last_error` text,
	`history_from` text NOT NULL,
	`types_seen_json` text NOT NULL DEFAULT '[]'
);
