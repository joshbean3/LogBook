-- ops: advisory leases (one process per job family, and the lock the migrations themselves run under), the job log,
-- and the rate-limit windows that used to live in memory. `leases` is created by db/index.ts before any migration runs
-- (it is the lock), so every statement here is IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS `leases` (
	`name` text PRIMARY KEY NOT NULL,
	`holder` text NOT NULL,
	`expires_at` integer NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `job_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`ok` integer,
	`error` text,
	`meta` text
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `job_runs_name_started` ON `job_runs` (`name`,`started_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `job_runs_started` ON `job_runs` (`started_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer NOT NULL
);
