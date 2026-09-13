import { bootstrapSchema } from "./schemaBootstrap";
import "dotenv/config";
import postgres from "postgres";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

async function migrate() {
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required.");
const db = postgres(url, { max: 1 });
try {
  await db.begin(async tx => {
    await tx`select pg_advisory_xact_lock(hashtext('raero-schema-migrations'))`;
    await bootstrapSchema(tx);
    await tx`create table if not exists raero_migrations (name text primary key, checksum text not null, applied_at timestamp not null default now())`;
    for (const name of ["20260913_verification.sql", "20260913_approval.sql", "20260913_approval_evidence.sql", "20260913_exam_answers.sql", "20260913_chapter_quizzes.sql", "20260913_chapter_policy.sql", "20260913_course_ownership.sql", "20260913_content_archive.sql", "20260913_archive_links.sql", "20260913_course_versions.sql", "20260913_training_assignments.sql", "20260913_payment_fulfillment.sql", "20260913_training_licenses.sql", "20260913_refund_observations.sql", "20260913_checkout_attempts.sql", "20260913_payment_reconciliation.sql", "20260913_passport_archive.sql", "20260913_live_presence.sql", "20260913_session_cancellations.sql", "20260913_exam_finalization_failures.sql", "20260913_pedagogical_reviews.sql", "20260913_review_withdrawals.sql", "20260913_subscription_enrollments.sql", "20260913_subscription_quantity.sql", "20260913_subscription_checkout.sql", "20260913_subscription_checkout_closure.sql", "20260913_course_media.sql", "20260913_course_media_import.sql", "20260913_legacy_course_media.sql", "20260913_template_instantiations.sql", "20260913_live_video_tickets.sql", "20260913_session_revocation.sql", "20260913_reset_token_hash.sql", "20260913_two_factor_challenges.sql", "20260913_two_factor_settings.sql", "20260913_organization_status.sql", "20260913_preserve_organizations.sql", "20260913_external_training_archive.sql", "20260913_course_copies.sql", "20260913_session_schedule.sql", "20260913_webinar_admin.sql", "20260913_webinar_metadata.sql", "20260913_live_instructors.sql", "20260913_ai_requests.sql", "20260913_ai_outlines.sql", "20260913_ai_video_jobs.sql", "20260913_ai_video_queue_index.sql", "20260913_invoice_archive.sql", "20260913_certificate_archive.sql", "20260913_certificate_revocations.sql", "20260913_signoff_snapshots.sql", "20260913_signoff_requests.sql", "20260913_credential_sharing_events.sql", "20260913_account_closures.sql", "20260913_support_request_kind.sql", "20260913_support_status_events.sql", "20260913_live_message_requests.sql", "20260913_passport_requests.sql", "20260913_verification_requests.sql", "20260913_verification_queue.sql", "20260913_question_creation_requests.sql", "20260913_exam_feedback.sql", "20260913_broadcast_history.sql", "20260913_broadcast_requests.sql", "20260913_broadcast_recipients.sql", "20260913_broadcast_access.sql", "20260913_broadcast_retries.sql", "20260913_module_creation_requests.sql", "20260913_slide_creation_requests.sql", "20260913_slide_revision.sql", "20260913_author_content_revision.sql", "20260913_objective_revision.sql", "20260913_objective_creation_requests.sql", "20260913_verification_revision.sql", "20260913_approval_upload_requests.sql", "20260913_operator_approval_revision.sql", "20260913_approval_finding_revision.sql", "20260913_role_requirement_archive.sql", "20260913_quote_creation_requests.sql", "20260913_quote_status_history.sql", "20260913_quote_message_requests.sql", "20260913_support_message_requests.sql", "20260913_support_creation_requests.sql", "20260913_role_requirement_creator.sql", "20260913_certificate_enrollment_index.sql", "20260913_live_replay_events.sql", "20260913_live_replay_revision.sql", "20260913_support_notification_outbox.sql", "20260913_support_notification_claim_actor.sql"]) {
      const sql = await readFile(new URL(`../drizzle/migrations/${name}`, import.meta.url), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const [applied] = await tx`select checksum from raero_migrations where name = ${name}`;
      if (applied) {
        if (applied.checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      await tx.unsafe(sql);
      await tx`insert into raero_migrations (name, checksum) values (${name}, ${checksum})`;
      console.log(`Applied ${name}`);
    }
  });
} finally { await db.end(); }

}
migrate().catch(error => { console.error(error.message); process.exitCode = 1; });
