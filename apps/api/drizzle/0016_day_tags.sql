-- Day tags (the Journal's day page): a yes or a no per tag per day; the tag list itself lives in user_settings
CREATE TABLE IF NOT EXISTS `day_tags` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`tag` text NOT NULL,
	`value` integer NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `date`, `tag`)
);
