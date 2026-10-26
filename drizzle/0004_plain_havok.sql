CREATE TABLE `career_application_events` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`user_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `career_applications`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_career_application_events_user_date` ON `career_application_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `career_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`job_id` text NOT NULL,
	`artifact_id` text NOT NULL,
	`policy_version` integer NOT NULL,
	`host` text NOT NULL,
	`status` text NOT NULL,
	`evidence_type` text,
	`confirmation_id` text,
	`started_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`job_id`) REFERENCES `career_jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`artifact_id`) REFERENCES `career_artifacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_career_application_user_job` ON `career_applications` (`user_id`,`job_id`);--> statement-breakpoint
CREATE INDEX `idx_career_application_user_status_date` ON `career_applications` (`user_id`,`status`,`started_at`);--> statement-breakpoint
CREATE TABLE `career_apply_controls` (
	`user_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'disabled' NOT NULL,
	`policy_version` integer DEFAULT 0 NOT NULL,
	`policy_json` text DEFAULT '{}' NOT NULL,
	`approved_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `career_site_capabilities` (
	`host` text PRIMARY KEY NOT NULL,
	`method` text NOT NULL,
	`evidence_url` text NOT NULL,
	`verified_at` integer NOT NULL,
	`credential_secret_name` text NOT NULL,
	`form_verified` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT false NOT NULL
);
