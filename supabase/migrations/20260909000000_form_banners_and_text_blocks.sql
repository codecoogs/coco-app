-- Adds a banner image to forms and, as an override, to individual sections
-- (a section's banner replaces the form's on that section's page). Also adds
-- "text_block" as a question type: a display-only message (e.g. "Thank you
-- for Applying") addable anywhere in the question list, same as any other
-- question type - it never collects an answer.

ALTER TABLE "public"."forms"
    ADD COLUMN "banner_url" "text";

ALTER TABLE "public"."form_sections"
    ADD COLUMN "banner_url" "text";

ALTER TABLE "public"."form_questions"
    DROP CONSTRAINT "form_questions_type_check";

ALTER TABLE "public"."form_questions"
    ADD CONSTRAINT "form_questions_type_check" CHECK (("type" = ANY (ARRAY['short_answer'::"text", 'paragraph'::"text", 'single_select'::"text", 'multi_select'::"text", 'dropdown'::"text", 'date'::"text", 'file_upload'::"text", 'text_block'::"text"])));

-- Banner images reuse the public "assets" bucket, mirroring the flyers/
-- and team-images/ path-scoped policies already on that bucket. Public read
-- is already covered by the bucket-wide assets_public_read policy.
CREATE POLICY "assets_form_banners_insert_authenticated" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'assets'::"text") AND ("name" ~~ 'form-banners/%'::"text")));

CREATE POLICY "assets_form_banners_update_authenticated" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'assets'::"text") AND ("name" ~~ 'form-banners/%'::"text"))) WITH CHECK ((("bucket_id" = 'assets'::"text") AND ("name" ~~ 'form-banners/%'::"text")));
