-- reminders and push: the owner's time zone and quiet hours, the devices that take pushes, the reminders, and what was sent
ALTER TABLE `users` ADD `timezone` text;--> statement-breakpoint
ALTER TABLE `users` ADD `quiet_hours_json` text;--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`endpoint_or_token` text NOT NULL,
	`p256dh` text,
	`auth` text,
	`user_agent` text,
	`created_at` text NOT NULL,
	`last_ok_at` text,
	`failed_at` text
);--> statement-breakpoint
CREATE INDEX `push_subscriptions_user` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint` ON `push_subscriptions` (`user_id`,`endpoint_or_token`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`route` text,
	`fire_at_utc` text NOT NULL,
	`rrule` text,
	`source` text DEFAULT 'user' NOT NULL,
	`assistant_action_id` text,
	`dedupe_key` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL
);--> statement-breakpoint
CREATE INDEX `reminders_due` ON `reminders` (`status`,`fire_at_utc`);--> statement-breakpoint
CREATE INDEX `reminders_user` ON `reminders` (`user_id`,`fire_at_utc`);--> statement-breakpoint
CREATE UNIQUE INDEX `reminders_dedupe` ON `reminders` (`user_id`,`dedupe_key`);--> statement-breakpoint
CREATE TABLE `notification_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`reminder_id` text NOT NULL,
	`subscription_id` text,
	`status` text NOT NULL,
	`error` text,
	`at` text NOT NULL
);--> statement-breakpoint
CREATE INDEX `notification_log_user` ON `notification_log` (`user_id`,`at`);
