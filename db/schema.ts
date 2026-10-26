import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const userProfiles = sqliteTable("user_profiles", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  timezone: text("timezone").notNull(),
  preferencesJson: text("preferences_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("idx_user_profiles_email").on(table.email)]);

export const connectorAccounts = sqliteTable("connector_accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  label: text("label").notNull(),
  externalAccountId: text("external_account_id"),
  status: text("status").notNull(),
  permissionLevel: text("permission_level").notNull(),
  grantedCapabilitiesJson: text("granted_capabilities_json").notNull(),
  connectionReference: text("connection_reference"),
  lastSyncAt: integer("last_sync_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_connector_accounts_user_status").on(table.userId, table.status),
  uniqueIndex("idx_connector_accounts_user_provider_external").on(table.userId, table.provider, table.externalAccountId),
]);

export const consentGrants = sqliteTable("consent_grants", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  connectorAccountId: text("connector_account_id").notNull().references(() => connectorAccounts.id, { onDelete: "cascade" }),
  capability: text("capability").notNull(),
  permissionLevel: text("permission_level").notNull(),
  status: text("status").notNull(),
  grantedAt: integer("granted_at", { mode: "timestamp_ms" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
}, (table) => [
  uniqueIndex("idx_consent_account_capability").on(table.connectorAccountId, table.capability),
  index("idx_consent_user_status").on(table.userId, table.status),
]);

export const sourceItems = sqliteTable("source_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  connectorAccountId: text("connector_account_id").notNull().references(() => connectorAccounts.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  summary: text("summary").notNull(),
  summaryStrategy: text("summary_strategy").notNull().default("extractive"),
  modelCallCount: integer("model_call_count").notNull().default(0),
  sensitivity: text("sensitivity").notNull(),
  occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
  dueAt: integer("due_at", { mode: "timestamp_ms" }),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }),
  canonicalUrl: text("canonical_url"),
  labelsJson: text("labels_json").notNull(),
  participantsJson: text("participants_json").notNull(),
  metadataJson: text("metadata_json").notNull(),
  contentHash: text("content_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_source_items_account_external").on(table.connectorAccountId, table.externalId),
  index("idx_source_items_user_occurred").on(table.userId, table.occurredAt),
  index("idx_source_items_user_due").on(table.userId, table.dueAt),
]);

export const alerts = sqliteTable("alerts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  sourceItemId: text("source_item_id").references(() => sourceItems.id, { onDelete: "set null" }),
  severity: text("severity").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  dueAt: integer("due_at", { mode: "timestamp_ms" }),
  status: text("status").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  acknowledgedAt: integer("acknowledged_at", { mode: "timestamp_ms" }),
}, (table) => [
  uniqueIndex("idx_alerts_user_dedupe").on(table.userId, table.dedupeKey),
  index("idx_alerts_user_status_severity").on(table.userId, table.status, table.severity),
]);

export const plannerItems = sqliteTable("planner_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  sourceItemId: text("source_item_id").references(() => sourceItems.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }).notNull(),
  status: text("status").notNull(),
  origin: text("origin").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_planner_user_starts").on(table.userId, table.startsAt),
  index("idx_planner_user_status").on(table.userId, table.status),
]);

export const memoryRecords = sqliteTable("memory_records", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  sourceItemId: text("source_item_id").notNull().references(() => sourceItems.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  keywordsJson: text("keywords_json").notNull(),
  sensitivity: text("sensitivity").notNull(),
  embeddingReference: text("embedding_reference"),
  occurredAt: integer("occurred_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  index("idx_memory_user_occurred").on(table.userId, table.occurredAt),
  uniqueIndex("idx_memory_source_item").on(table.sourceItemId),
]);

export const syncRuns = sqliteTable("sync_runs", {
  id: text("id").primaryKey(),
  connectorAccountId: text("connector_account_id").notNull().references(() => connectorAccounts.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  cursor: text("cursor"),
  itemCount: integer("item_count").notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  errorCode: text("error_code"),
}, (table) => [index("idx_sync_runs_account_started").on(table.connectorAccountId, table.startedAt)]);

export const auditEntries = sqliteTable("audit_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  connectorAccountId: text("connector_account_id").references(() => connectorAccounts.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  outcome: text("outcome").notNull(),
  requiresApproval: integer("requires_approval", { mode: "boolean" }).notNull(),
  metadataJson: text("metadata_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_audit_user_created").on(table.userId, table.createdAt)]);

export const careerPreferences = sqliteTable("career_preferences", {
  userId: text("user_id").primaryKey().references(() => userProfiles.id, { onDelete: "cascade" }),
  targetRolesJson: text("target_roles_json").notNull(),
  locationsJson: text("locations_json").notNull(),
  excludedEmployersJson: text("excluded_employers_json").notNull(),
  approvedSkillsJson: text("approved_skills_json").notNull(),
  minimumSalary: integer("minimum_salary").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const careerSources = sqliteTable("career_sources", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  boardToken: text("board_token").notNull(),
  employer: text("employer").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("idx_career_source_board").on(table.userId, table.provider, table.boardToken)]);

export const careerJobs = sqliteTable("career_jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  sourceId: text("source_id").references(() => careerSources.id, { onDelete: "set null" }),
  dedupeKey: text("dedupe_key").notNull(),
  provider: text("provider").notNull(),
  externalId: text("external_id"),
  employer: text("employer").notNull(),
  title: text("title").notNull(),
  location: text("location").notNull(),
  workplaceType: text("workplace_type"),
  salaryMin: integer("salary_min"),
  salaryMax: integer("salary_max"),
  salaryCurrency: text("salary_currency"),
  description: text("description").notNull(),
  sourceUrl: text("source_url").notNull(),
  applyUrl: text("apply_url"),
  postedAt: integer("posted_at", { mode: "timestamp_ms" }),
  discoveredAt: integer("discovered_at", { mode: "timestamp_ms" }).notNull(),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
  availability: text("availability").notNull(),
  metadataJson: text("metadata_json").notNull(),
}, (table) => [
  uniqueIndex("idx_career_jobs_user_dedupe").on(table.userId, table.dedupeKey),
  index("idx_career_jobs_user_seen").on(table.userId, table.lastSeenAt),
]);

export const careerEvaluations = sqliteTable("career_evaluations", {
  jobId: text("job_id").primaryKey().references(() => careerJobs.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  eligibility: text("eligibility").notNull(),
  fitScore: integer("fit_score").notNull(),
  reasonsJson: text("reasons_json").notNull(),
  uncertaintiesJson: text("uncertainties_json").notNull(),
  evaluatedAt: integer("evaluated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_career_evaluations_user_fit").on(table.userId, table.fitScore)]);

export const careerRuns = sqliteTable("career_runs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  sourceCount: integer("source_count").notNull(),
  fetchedCount: integer("fetched_count").notNull(),
  savedCount: integer("saved_count").notNull(),
  errorsJson: text("errors_json").notNull(),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp_ms" }),
}, (table) => [index("idx_career_runs_user_started").on(table.userId, table.startedAt)]);

export const careerProfileFacts = sqliteTable("career_profile_facts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  claim: text("claim").notNull(),
  sourceLabel: text("source_label").notNull(),
  approvedAt: integer("approved_at", { mode: "timestamp_ms" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_career_facts_user_approved").on(table.userId, table.approvedAt)]);

export const careerBaseResumes = sqliteTable("career_base_resumes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  approvedAt: integer("approved_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_career_resume_user_version").on(table.userId, table.version),
  index("idx_career_resume_user_created").on(table.userId, table.createdAt),
]);

export const careerArtifacts = sqliteTable("career_artifacts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  jobId: text("job_id").notNull().references(() => careerJobs.id, { onDelete: "cascade" }),
  baseResumeId: text("base_resume_id").notNull().references(() => careerBaseResumes.id),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  factIdsJson: text("fact_ids_json").notNull(),
  checksum: text("checksum").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [
  uniqueIndex("idx_career_artifact_job_version").on(table.jobId, table.version),
  index("idx_career_artifact_user_created").on(table.userId, table.createdAt),
]);

export const careerReviewItems = sqliteTable("career_review_items", {
  jobId: text("job_id").primaryKey().references(() => careerJobs.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  blockersJson: text("blockers_json").notNull(),
  artifactId: text("artifact_id").references(() => careerArtifacts.id, { onDelete: "set null" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_career_review_user_status").on(table.userId, table.status)]);

export const careerDryRunEvents = sqliteTable("career_dry_run_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  jobId: text("job_id").notNull().references(() => careerJobs.id, { onDelete: "cascade" }),
  artifactId: text("artifact_id").references(() => careerArtifacts.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  detailsJson: text("details_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [index("idx_career_dry_run_user_created").on(table.userId, table.createdAt)]);

export const careerPolicyDrafts = sqliteTable("career_policy_drafts", {
  userId: text("user_id").primaryKey().references(() => userProfiles.id, { onDelete: "cascade" }),
  allowedEmployersJson: text("allowed_employers_json").notNull(),
  locationsJson: text("locations_json").notNull(),
  minimumSalary: integer("minimum_salary").notNull(),
  dailyCap: integer("daily_cap").notNull(),
  status: text("status").notNull().default("draft"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
