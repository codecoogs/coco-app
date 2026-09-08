-- Lets a text_block question carry an optional image alongside its message
-- (e.g. an image under a "Thank you for Applying" block).

ALTER TABLE "public"."form_questions"
    ADD COLUMN "image_url" "text";

-- Mirrors the form-banners/ policy pattern added in
-- 20260909000000_form_banners_and_text_blocks.sql. Public read is already
-- covered by the bucket-wide assets_public_read policy.
CREATE POLICY "assets_form_question_images_insert_authenticated" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'assets'::"text") AND ("name" ~~ 'form-question-images/%'::"text")));

CREATE POLICY "assets_form_question_images_update_authenticated" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'assets'::"text") AND ("name" ~~ 'form-question-images/%'::"text"))) WITH CHECK ((("bucket_id" = 'assets'::"text") AND ("name" ~~ 'form-question-images/%'::"text")));
