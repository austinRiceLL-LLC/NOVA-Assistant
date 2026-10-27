CREATE TABLE `career_resume_files` (
 `id` text PRIMARY KEY NOT NULL,
 `user_id` text NOT NULL,
 `filename` text NOT NULL,
 `media_type` text NOT NULL,
 `byte_length` integer NOT NULL,
 `sha256` text NOT NULL,
 `content` blob NOT NULL,
 `uploaded_at` integer NOT NULL,
 `selected_at` integer,
 `archived_at` integer,
 FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `idx_career_resume_files_user_uploaded` ON `career_resume_files` (`user_id`,`uploaded_at`);--> statement-breakpoint
CREATE TABLE `career_application_profiles` (
 `user_id` text PRIMARY KEY NOT NULL,
 `version` integer NOT NULL,
 `data_json` text NOT NULL,
 `approved_at` integer,
 `updated_at` integer NOT NULL,
 FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
