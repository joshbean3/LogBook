ALTER TABLE `users` ADD `onboarded_at` text;--> statement-breakpoint
-- every account that exists before onboarding shipped has already set itself up: never send it to /welcome
UPDATE `users` SET `onboarded_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE `onboarded_at` IS NULL;
