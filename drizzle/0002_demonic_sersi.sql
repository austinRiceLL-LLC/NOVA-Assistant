CREATE TABLE `career_evaluations` (
	`job_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`eligibility` text NOT NULL,
	`fit_score` integer NOT NULL,
	`reasons_json` text NOT NULL,
	`uncertainties_json` text NOT NULL,
	`evaluated_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `career_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_career_evaluations_user_fit` ON `career_evaluations` (`user_id`,`fit_score`);--> statement-breakpoint
CREATE TABLE `career_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source_id` text,
	`dedupe_key` text NOT NULL,
	`provider` text NOT NULL,
	`external_id` text,
	`employer` text NOT NULL,
	`title` text NOT NULL,
	`location` text NOT NULL,
	`workplace_type` text,
	`salary_min` integer,
	`salary_max` integer,
	`salary_currency` text,
	`description` text NOT NULL,
	`source_url` text NOT NULL,
	`apply_url` text,
	`posted_at` integer,
	`discovered_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`availability` text NOT NULL,
	`metadata_json` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `career_sources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_career_jobs_user_dedupe` ON `career_jobs` (`user_id`,`dedupe_key`);--> statement-breakpoint
CREATE INDEX `idx_career_jobs_user_seen` ON `career_jobs` (`user_id`,`last_seen_at`);--> statement-breakpoint
CREATE TABLE `career_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`target_roles_json` text NOT NULL,
	`locations_json` text NOT NULL,
	`excluded_employers_json` text NOT NULL,
	`approved_skills_json` text NOT NULL,
	`minimum_salary` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `career_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`source_count` integer NOT NULL,
	`fetched_count` integer NOT NULL,
	`saved_count` integer NOT NULL,
	`errors_json` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_career_runs_user_started` ON `career_runs` (`user_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `career_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`board_token` text NOT NULL,
	`employer` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_career_source_board` ON `career_sources` (`user_id`,`provider`,`board_token`);