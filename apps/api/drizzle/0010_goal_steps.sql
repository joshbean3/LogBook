-- a goal's steps (GoalStep[] as JSON): checked off through the day, each check logged in goal_events
ALTER TABLE `goals` ADD `steps` text DEFAULT '[]' NOT NULL;
