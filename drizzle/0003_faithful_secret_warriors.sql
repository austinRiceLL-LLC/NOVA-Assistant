CREATE TABLE `career_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`job_id` text NOT NULL,
	`base_resume_id` text NOT NULL,
	`version` integer NOT NULL,
	`content` text NOT NULL,
	`fact_ids_json` text NOT NULL,
	`checksum` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`job_id`) REFERENCES `career_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`base_resume_id`) REFERENCES `career_base_resumes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_career_artifact_job_version` ON `career_artifacts` (`job_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_career_artifact_user_created` ON `career_artifacts` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `career_base_resumes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`version` integer NOT NULL,
	`content` text NOT NULL,
	`approved_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_career_resume_user_version` ON `career_base_resumes` (`user_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_career_resume_user_created` ON `career_base_resumes` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `career_dry_run_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`job_id` text NOT NULL,
	`artifact_id` text,
	`action` text NOT NULL,
	`details_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`job_id`) REFERENCES `career_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artifact_id`) REFERENCES `career_artifacts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_career_dry_run_user_created` ON `career_dry_run_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `career_policy_drafts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`allowed_employers_json` text NOT NULL,
	`locations_json` text NOT NULL,
	`minimum_salary` integer NOT NULL,
	`daily_cap` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `career_profile_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`claim` text NOT NULL,
	`source_label` text NOT NULL,
	`approved_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_career_facts_user_approved` ON `career_profile_facts` (`user_id`,`approved_at`);--> statement-breakpoint
CREATE TABLE `career_review_items` (
	`job_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text NOT NULL,
	`blockers_json` text NOT NULL,
	`artifact_id` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `career_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artifact_id`) REFERENCES `career_artifacts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_career_review_user_status` ON `career_review_items` (`user_id`,`status`);