-- the assistant, v2 (docs/system.md §7): server-side threads with the full content blocks, memories, and the token bill
CREATE TABLE `assistant_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`compacted_summary` text
);--> statement-breakpoint
CREATE INDEX `assistant_threads_user` ON `assistant_threads` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `assistant_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`content_json` text NOT NULL,
	`action_id` text,
	`created_at` text NOT NULL
);--> statement-breakpoint
CREATE INDEX `assistant_messages_thread` ON `assistant_messages` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `user_memory` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`text` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `key`)
);--> statement-breakpoint
CREATE TABLE `llm_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cached_tokens` integer DEFAULT 0 NOT NULL,
	`ms` integer DEFAULT 0 NOT NULL,
	`at` text NOT NULL
);--> statement-breakpoint
CREATE INDEX `llm_usage_user_at` ON `llm_usage` (`user_id`,`at`);--> statement-breakpoint
-- "About you, for the assistant" (Settings → You), replacing the ATHLETE_CONTEXT env
ALTER TABLE `users` ADD `profile_note` text;
