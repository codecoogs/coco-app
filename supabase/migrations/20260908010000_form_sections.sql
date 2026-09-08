-- Sections double as page breaks, matching Google Forms: a form_sections row
-- is a title/description text block, and everything from one section up to
-- the next renders as its own page when filling out the form. Nullable
-- form_questions.section_id means "before any section" (the form's first
-- page). Sections and questions share the same order_index numbering space
-- for a given form - the builder always rewrites every item's order_index
-- together on reorder, so there's no need to enforce cross-table uniqueness.
CREATE TABLE IF NOT EXISTS "public"."form_sections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "order_index" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."form_sections" OWNER TO "postgres";

ALTER TABLE ONLY "public"."form_sections"
    ADD CONSTRAINT "form_sections_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."form_sections"
    ADD CONSTRAINT "form_sections_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE CASCADE;

CREATE INDEX "form_sections_form_id_idx" ON "public"."form_sections" USING "btree" ("form_id");

CREATE OR REPLACE TRIGGER "form_sections_set_updated_at_trg" BEFORE UPDATE ON "public"."form_sections" FOR EACH ROW EXECUTE FUNCTION "public"."forms_set_updated_at"();

ALTER TABLE "public"."form_sections" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "form_sections_delete_manage" ON "public"."form_sections" FOR DELETE TO "authenticated" USING ("public"."current_user_has_permission"('manage_forms'::"text"));

CREATE POLICY "form_sections_insert_manage" ON "public"."form_sections" FOR INSERT TO "authenticated" WITH CHECK ("public"."current_user_has_permission"('manage_forms'::"text"));

CREATE POLICY "form_sections_select" ON "public"."form_sections" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."forms" "f"
  WHERE (("f"."id" = "form_sections"."form_id") AND ("public"."current_user_has_permission"('manage_forms'::"text") OR (("f"."is_active" IS TRUE) AND ("f"."status" = 'published'::"text") AND "public"."current_user_can_view_form"("f"."id")))))));

CREATE POLICY "form_sections_update_manage" ON "public"."form_sections" FOR UPDATE TO "authenticated" USING ("public"."current_user_has_permission"('manage_forms'::"text")) WITH CHECK ("public"."current_user_has_permission"('manage_forms'::"text"));

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_sections" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_sections" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."form_sections" TO "service_role";

ALTER TABLE "public"."form_questions"
    ADD COLUMN "section_id" "uuid";

ALTER TABLE ONLY "public"."form_questions"
    ADD CONSTRAINT "form_questions_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "public"."form_sections"("id") ON DELETE SET NULL;

CREATE INDEX "form_questions_section_id_idx" ON "public"."form_questions" USING "btree" ("section_id");
