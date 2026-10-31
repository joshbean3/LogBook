-- the assistant's proposals: the ask, the summary, the checked operations, and once applied the rows as they were (Undo)
CREATE TABLE `assistant_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`ask` text NOT NULL,
	`summary` text NOT NULL,
	`ops` text NOT NULL,
	`labels` text NOT NULL,
	`undo` text,
	`status` text DEFAULT 'proposed' NOT NULL,
	`created_at` text NOT NULL,
	`applied_at` text
);--> statement-breakpoint
CREATE INDEX `assistant_actions_user` ON `assistant_actions` (`user_id`,`created_at`);
