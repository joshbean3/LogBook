CREATE TABLE `links` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`site_name` text DEFAULT '' NOT NULL,
	`description` text,
	`image_url` text,
	`note` text,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`added_at` text NOT NULL,
	`read_at` text,
	`source` text DEFAULT 'me' NOT NULL,
	`pick_reason` text,
	`pick_date` text,
	`verdict` text,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `links_user` ON `links` (`user_id`);--> statement-breakpoint
CREATE INDEX `links_user_pick` ON `links` (`user_id`,`pick_date`);
