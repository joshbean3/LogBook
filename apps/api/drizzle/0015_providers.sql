-- integrations behind one Provider interface: Strava's rows move to provider_connections (one per user and provider,
-- one Logbook account per athlete), and activities are keyed by (user, provider, external id) so two accounts on the
-- same athlete never collide; `id` stays the row id the client knows
CREATE TABLE `provider_connections` (
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`external_athlete_id` text NOT NULL,
	`athlete_name` text,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`scope` text,
	`cursor` text,
	`last_sync_at` text,
	`last_error` text,
	`status` text DEFAULT 'ok' NOT NULL,
	`connected_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `provider`)
);--> statement-breakpoint
CREATE UNIQUE INDEX `provider_connections_athlete` ON `provider_connections` (`provider`,`external_athlete_id`);--> statement-breakpoint
INSERT OR IGNORE INTO `provider_connections` (`user_id`, `provider`, `external_athlete_id`, `athlete_name`, `access_token`, `refresh_token`, `expires_at`, `scope`, `cursor`, `last_sync_at`, `last_error`, `status`, `connected_at`)
SELECT `user_id`, 'strava', `athlete_id`, `athlete_name`, `access_token`, `refresh_token`, `expires_at`, `scope`, NULL, `last_sync_at`, `last_error`, 'ok', `created_at` FROM `strava_accounts` ORDER BY `created_at`;--> statement-breakpoint
DROP TABLE `strava_accounts`;--> statement-breakpoint
CREATE TABLE `activities_new` (
	`id` text NOT NULL,
	`user_id` text NOT NULL,
	`provider` text DEFAULT 'strava' NOT NULL,
	`external_id` text NOT NULL,
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
	`perf_failed_at` text,
	`polyline` text,
	`duplicate_of` text,
	`deleted_at` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `provider`, `external_id`)
);--> statement-breakpoint
INSERT INTO `activities_new` (`id`, `user_id`, `provider`, `external_id`, `date`, `time`, `name`, `sport_type`, `kind`, `distance_m`, `moving_sec`, `elapsed_sec`, `elev_m`, `avg_hr`, `max_hr`, `cadence`, `laps_json`, `perf_at`, `perf_failed`, `perf_failed_at`, `polyline`, `duplicate_of`, `deleted_at`, `updated_at`)
SELECT `id`, `user_id`, 'strava', `id`, `date`, `time`, `name`, `sport_type`, `kind`, `distance_m`, `moving_sec`, `elapsed_sec`, `elev_m`, `avg_hr`, `max_hr`, `cadence`, `laps_json`, `perf_at`, `perf_failed`, NULL, `polyline`, NULL, `deleted_at`, `updated_at` FROM `activities`;--> statement-breakpoint
DROP TABLE `activities`;--> statement-breakpoint
ALTER TABLE `activities_new` RENAME TO `activities`;--> statement-breakpoint
CREATE UNIQUE INDEX `activities_id` ON `activities` (`id`);--> statement-breakpoint
CREATE INDEX `activities_user_date` ON `activities` (`user_id`,`date`);
