-- Apple Health is narrowed to what a screen shows: sleep, heart rate variability and resting heart rate.
-- Readings of other kinds that an earlier build uploaded are removed, and the source name (usually the name the person
-- gave their device) is no longer kept. The phone still has everything in the Health app.
DELETE FROM `health_samples` WHERE `type` NOT IN ('hrv', 'resting_hr');--> statement-breakpoint
DELETE FROM `health_days`;--> statement-breakpoint
DELETE FROM `health_workouts`;--> statement-breakpoint
UPDATE `health_samples` SET `source_name` = '' WHERE `source_name` <> '';--> statement-breakpoint
UPDATE `sleep_segments` SET `source_name` = '' WHERE `source_name` <> '';
