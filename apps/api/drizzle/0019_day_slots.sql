-- the day as a timeline (docs/today-v6.md §5): a day's plan gains timed slots ({ ref, start, minutes }[]) next to the bands
ALTER TABLE `day_plans` ADD `slots` text DEFAULT '[]' NOT NULL;
