-- the training answers (goal, race date, run days, long-run day, weekly miles) as JSON: written by onboarding and PATCH /me/training
ALTER TABLE `users` ADD `training_profile` text;
