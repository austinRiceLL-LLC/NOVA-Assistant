ALTER TABLE `career_runs` ADD `current_source` text;--> statement-breakpoint
ALTER TABLE `career_runs` ADD `processed_source_count` integer DEFAULT 0 NOT NULL;
