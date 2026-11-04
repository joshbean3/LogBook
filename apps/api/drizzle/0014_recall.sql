-- "Remember when": what the Journal tab brings back, per past journal entry or learning: boosted, hidden, its stored one-line summary, when last shown
CREATE TABLE IF NOT EXISTS `recall_items` (
	`user_id` text NOT NULL,
	`source_kind` text NOT NULL,
	`source_id` text NOT NULL,
	`boost` integer DEFAULT 0 NOT NULL,
	`hidden` integer DEFAULT 0 NOT NULL,
	`summary` text,
	`summarized_at` text,
	`last_shown` text,
	PRIMARY KEY(`user_id`, `source_kind`, `source_id`)
);
