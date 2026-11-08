-- how hard a session felt, 1 to 10, from the effort check-in after it is marked done; null until asked or when skipped
ALTER TABLE `training_sessions` ADD `effort` integer;
