ALTER TABLE `todos` ADD `priority` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `todos` ADD `due` text;--> statement-breakpoint
ALTER TABLE `todos` ADD `bucket` text DEFAULT 'today' NOT NULL;--> statement-breakpoint
ALTER TABLE `todos` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `todos` SET `position` = `rowid`;