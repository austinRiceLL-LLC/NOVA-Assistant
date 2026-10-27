# Career resume library and application details

The **Resumes** tab stores PDF, DOCX, or UTF-8 TXT originals in the signed-in user's D1 record. Files are limited to 750 KB. The user can select one file for future applications. Selection alone does not submit anything or approve resume claims. Download and archive operations require the same user's session. Archive hides a file from the library and download API; it does not erase the stored bytes.

The **Application info** tab saves contact, links, education, availability, and user-supplied authorization answers. Every save creates a new draft version and clears approval. The user must review and approve the saved version; approval requires a legal name and email. Empty values are unknown; Atlas must never infer them. Passwords, Social Security numbers, dates of birth, and payment details are not collected here.

Uploaded originals are not automatically converted to approved claims. The existing **Review** tab's plain text resume approval and verified facts remain the only inputs to resume draft generation. Uploaded PDF/DOCX files are held for download and a future authorized application adapter. No employer form is opened or submitted by this phase.

Deployment requires applying `drizzle/0006_career_profile_storage.sql` to the D1 database before these tabs are used. Current hosting has no Cron Trigger or automatic application adapter, and the existing Career pull requests remain stacked for review.
