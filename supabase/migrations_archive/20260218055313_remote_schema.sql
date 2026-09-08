


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user_link"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
    existing_phone TEXT;
BEGIN
    -- 1. Find the existing user's phone number by email
    SELECT phone INTO existing_phone 
    FROM public.users 
    WHERE email = NEW.email 
    LIMIT 1;

    -- 2. Update the public.users record (as we did before)
    UPDATE public.users
    SET 
        auth_id = NEW.id,
        discord = COALESCE(
            discord, 
            NEW.raw_user_meta_data->>'full_name', 
            NEW.raw_user_meta_data->>'name',
            NEW.raw_user_meta_data->>'user_name'
        ) 
    WHERE email = NEW.email;

    -- 3. Push the phone number BACK to auth.users if we found one
    IF existing_phone IS NOT NULL AND existing_phone != '' THEN
        UPDATE auth.users
        SET phone = existing_phone
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;$$;


ALTER FUNCTION "public"."handle_new_user_link"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$

BEGIN

    NEW.updated_at = NOW();

    -- auth.uid() captures the ID of the user signed in through Supabase Auth

    NEW.updated_by = auth.uid(); 

    RETURN NEW;

END;

$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."populate_payments_from_users"() RETURNS TABLE("inserted_count" integer, "skipped_count" integer, "error_count" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    user_record RECORD;
    payment_count INTEGER := 0;
    skipped INTEGER := 0;
    errors INTEGER := 0;
    payment_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Loop through all users who have paid=true
    FOR user_record IN 
        SELECT 
            id,
            membership,
            paid,
            created,
            updated
        FROM users
        WHERE paid = true
        ORDER BY created ASC  -- Process oldest first
    LOOP
        BEGIN
            -- Check if payment already exists for this user
            IF NOT EXISTS (
                SELECT 1 FROM payments WHERE user_id = user_record.id
            ) THEN
                -- Determine the payment date (prefer created, fallback to updated, then now)
                payment_date := COALESCE(
                    user_record.created AT TIME ZONE 'UTC',
                    user_record.updated AT TIME ZONE 'UTC',
                    NOW() AT TIME ZONE 'UTC'
                );
                
                -- Insert payment record
                INSERT INTO payments (
                    user_id,
                    stripe_payment_intent_id,
                    status,
                    payment_type,
                    created_at,
                    amount
                ) VALUES (
                    user_record.id,
                    -- Generate a unique stripe_payment_intent_id
                    -- Format: 'migrated_' || user_id || '_' || epoch_timestamp
                    'migrated_' || user_record.id::text || '_' || 
                    EXTRACT(EPOCH FROM payment_date)::bigint::text,
                    'completed', -- Set status to completed since paid=true
                    user_record.membership, -- Use membership type as payment_type (Yearly/Semester)
                    payment_date,
                    NULL -- Amount is not available in users table, set to NULL
                );
                
                payment_count := payment_count + 1;
            ELSE
                skipped := skipped + 1;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but continue processing
                errors := errors + 1;
                RAISE WARNING 'Error processing user %: %', user_record.id, SQLERRM;
        END;
    END LOOP;
    
    RETURN QUERY SELECT payment_count, skipped, errors;
END;
$$;


ALTER FUNCTION "public"."populate_payments_from_users"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_transaction_points"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    -- Look up the point value from the category table if not provided
    if new.points_earned is null then
        select points_value into new.points_earned
        from public.point_categories
        where id = new.category_id;
    end if;

    -- Fallback safety
    if new.points_earned is null then
        new.points_earned := 0;
    end if;

    return new;
end;
$$;


ALTER FUNCTION "public"."set_transaction_points"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_transaction_points_and_year"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
    active_year_id uuid;
    event_points int;
begin
    -- 1. Automatically grab the current active academic year
    select id into active_year_id from public.academic_years where is_current = true limit 1;
    new.academic_year_id := active_year_id;

    -- 2. Logic Hierarchy for Points Earned
    -- Priority 1: Manual Override (If admin provided points_earned, do nothing)
    if new.points_earned is not null then
        return new;
    end if;

    -- Priority 2: Event-Specific Points
    if new.event_id is not null then
        select points_awarded into event_points from public.events where id = new.event_id;
        if event_points is not null then
            new.points_earned := event_points;
            return new;
        end if;
    end if;

    -- Priority 3: Category Default Points
    if new.category_id is not null then
        select points_value into new.points_earned 
        from public.point_categories 
        where id = new.category_id;
    end if;

    -- Fallback
    if new.points_earned is null then
        new.points_earned := 0;
    end if;

    return new;
end;
$$;


ALTER FUNCTION "public"."set_transaction_points_and_year"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_leaderboard_ranks"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
    current_year_id uuid;
begin
    -- Find the active academic year
    select id into current_year_id from public.academic_years where is_current = true limit 1;

    -- 1. Upsert total points ONLY for the active year
    insert into public.leaderboard (user_id, total_points)
    values (
        new.user_id, 
        (select coalesce(sum(points_earned), 0) 
         from public.point_transactions 
         where user_id = new.user_id 
         and academic_year_id = current_year_id)
    )
    on conflict (user_id) do update 
    set total_points = (select coalesce(sum(points_earned), 0) 
                        from public.point_transactions 
                        where user_id = new.user_id 
                        and academic_year_id = current_year_id);

    -- 2. Recalculate ranks based on those current-year totals
    update public.leaderboard
    set current_rank = subquery.new_rank
    from (
        select user_id, rank() over (order by total_points desc) as new_rank
        from public.leaderboard
    ) as subquery
    where public.leaderboard.user_id = subquery.user_id;

    return new;
end;
$$;


ALTER FUNCTION "public"."update_leaderboard_ranks"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."todos_users" (
    "todo_id" bigint NOT NULL,
    "discord_id" "text" NOT NULL
);


ALTER TABLE "public"."todos_users" OWNER TO "postgres";


ALTER TABLE "public"."todos_users" ALTER COLUMN "todo_id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."Todo_User_todo_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."academic_years" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "label" "text" NOT NULL,
    "is_current" boolean DEFAULT false,
    "start_date" "date",
    "end_date" "date"
);


ALTER TABLE "public"."academic_years" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."opportunities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "link_url" "text" NOT NULL,
    "category" "text",
    "icon_url" "text",
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "opportunities_category_check" CHECK (("category" = ANY (ARRAY['Internship'::"text", 'Club Role'::"text", 'Project'::"text", 'Sponsor'::"text", 'Other'::"text"])))
);


ALTER TABLE "public"."opportunities" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."active_opportunities" WITH ("security_invoker"='on') AS
 SELECT "id",
    "title",
    "description",
    "link_url",
    "category",
    "icon_url",
    "is_active",
    "display_order",
    "expires_at",
    "created_at",
    "updated_at",
    "created_by",
    "updated_by"
   FROM "public"."opportunities"
  WHERE (("is_active" = true) AND (("expires_at" IS NULL) OR ("expires_at" > "now"())))
  ORDER BY "display_order";


ALTER VIEW "public"."active_opportunities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branches" (
    "id" bigint NOT NULL,
    "name" character varying DEFAULT ''::character varying NOT NULL,
    "description" "text" DEFAULT 'Please add description'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" DEFAULT "gen_random_uuid"(),
    "updated_by" "uuid" DEFAULT "gen_random_uuid"(),
    "is_active" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."branches" OWNER TO "postgres";


ALTER TABLE "public"."branches" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."branches_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" bigint NOT NULL,
    "google_event_id" "text",
    "start_time" timestamp with time zone,
    "location" "text",
    "title" "text" NOT NULL,
    "description" "text",
    "points_awarded" integer DEFAULT 0
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events_attendance" (
    "event_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "attended_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text")
);


ALTER TABLE "public"."events_attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events_attending" (
    "event_id" bigint NOT NULL,
    "user_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."events_attending" OWNER TO "postgres";


ALTER TABLE "public"."events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."leaderboard" (
    "user_id" "uuid" NOT NULL,
    "total_points" integer DEFAULT 0,
    "current_rank" integer
);


ALTER TABLE "public"."leaderboard" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leaderboards_teams" (
    "leaderboard_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rank" bigint NOT NULL
);


ALTER TABLE "public"."leaderboards_teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."officer_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bio" "text",
    "linkedin_url" "text",
    "instagram_url" "text",
    "personal_site_url" "text",
    "photo_url" "text",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "user_id" "uuid",
    "officer_role" "uuid" NOT NULL
);


ALTER TABLE "public"."officer_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."officer_profiles" IS 'officers can update thair profiles without changing the users table';



CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_payment_intent_id" "text" NOT NULL,
    "status" "text",
    "payment_type" "text",
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "amount" bigint
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."point_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "points_value" integer NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."point_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."point_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "category_id" "uuid",
    "event_id" bigint,
    "points_earned" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "academic_year_id" "uuid"
);


ALTER TABLE "public"."point_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."points" (
    "user_id" "uuid" NOT NULL,
    "points" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid" DEFAULT "gen_random_uuid"(),
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."points" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."position_permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "position_id" bigint,
    "permission_id" "uuid"
);


ALTER TABLE "public"."position_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."positions" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT 'Enter description about position here'::"text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_on" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "branch_id" bigint,
    "role_id" bigint DEFAULT '3'::bigint,
    "is_admin" boolean DEFAULT false
);


ALTER TABLE "public"."positions" OWNER TO "postgres";


ALTER TABLE "public"."positions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."positions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'active'::"text"
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


ALTER TABLE "public"."projects" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."projects_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


ALTER TABLE "public"."roles" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."roles_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" bigint,
    "title" "text" NOT NULL,
    "description" "text",
    "assigned_to" "uuid",
    "assigned_by" "uuid",
    "due_date" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."tasks" IS 'tasks that executives can assign other members';



CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "points" bigint NOT NULL
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams_leads" (
    "team_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."teams_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams_members" (
    "team_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."teams_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."todos" (
    "id" bigint NOT NULL,
    "title" "text" NOT NULL,
    "deadline" "date" NOT NULL,
    "completed" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."todos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."todo_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."todo_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."todo_id_seq" OWNED BY "public"."todos"."id";



CREATE TABLE IF NOT EXISTS "public"."user_positions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text"),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid",
    "positionTitle" "text"
);


ALTER TABLE "public"."user_positions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" DEFAULT ''::"text" NOT NULL,
    "last_name" "text" DEFAULT ''::"text" NOT NULL,
    "email" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL,
    "classification" "text" DEFAULT ''::"text" NOT NULL,
    "expected_graduation" "text" DEFAULT ''::"text" NOT NULL,
    "discord" "text",
    "major" "text",
    "membership" "text",
    "paid" boolean DEFAULT false NOT NULL,
    "shirt-bought" boolean,
    "created" timestamp without time zone DEFAULT "now"(),
    "updated" timestamp without time zone DEFAULT "now"(),
    "auth_id" "uuid"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_profile" AS
 SELECT "u"."auth_id",
    "up"."user_id",
    "up"."positionTitle",
    "r"."name" AS "role_name",
    "p"."is_admin",
    COALESCE("array_agg"("perm"."name") FILTER (WHERE ("perm"."id" IS NOT NULL)), ARRAY[]::"text"[]) AS "permissions"
   FROM ((((("public"."user_positions" "up"
     JOIN "public"."users" "u" ON (("up"."user_id" = "u"."id")))
     JOIN "public"."positions" "p" ON (("up"."positionTitle" = "p"."title")))
     LEFT JOIN "public"."roles" "r" ON (("p"."role_id" = "r"."id")))
     LEFT JOIN "public"."position_permissions" "pp" ON (("p"."id" = "pp"."position_id")))
     LEFT JOIN "public"."permissions" "perm" ON (("pp"."permission_id" = "perm"."id")))
  GROUP BY "u"."auth_id", "up"."user_id", "up"."positionTitle", "r"."name", "p"."is_admin", "p"."id";


ALTER VIEW "public"."user_profile" OWNER TO "postgres";


ALTER TABLE ONLY "public"."todos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."todo_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."events_attending"
    ADD CONSTRAINT "Event_Attending_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."leaderboards_teams"
    ADD CONSTRAINT "Leaderboard_Team_pkey" PRIMARY KEY ("leaderboard_id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "Payment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "Role_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teams_leads"
    ADD CONSTRAINT "Team_Lead_pkey" PRIMARY KEY ("team_id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "Team_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."todos_users"
    ADD CONSTRAINT "Todo_User_pkey" PRIMARY KEY ("todo_id");



ALTER TABLE ONLY "public"."todos_users"
    ADD CONSTRAINT "Todo_User_todo_id_key" UNIQUE ("todo_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."academic_years"
    ADD CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events_attendance"
    ADD CONSTRAINT "events_attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_type_key" UNIQUE ("google_event_id");



ALTER TABLE ONLY "public"."leaderboard"
    ADD CONSTRAINT "leaderboard_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."officer_profiles"
    ADD CONSTRAINT "officer_profiles_OfficerAssignment_key" UNIQUE ("officer_role");



ALTER TABLE ONLY "public"."officer_profiles"
    ADD CONSTRAINT "officer_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_payee_key" UNIQUE ("stripe_payment_intent_id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."point_categories"
    ADD CONSTRAINT "point_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."point_categories"
    ADD CONSTRAINT "point_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."points"
    ADD CONSTRAINT "points_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."points"
    ADD CONSTRAINT "points_pkey" PRIMARY KEY ("user_id", "id");



ALTER TABLE ONLY "public"."position_permissions"
    ADD CONSTRAINT "position_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."position_permissions"
    ADD CONSTRAINT "position_permissions_position_id_permission_id_key" UNIQUE ("position_id", "permission_id");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_title_key" UNIQUE ("title");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_id_key" UNIQUE ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_role_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teams_members"
    ADD CONSTRAINT "teams_members_pkey" PRIMARY KEY ("team_id", "user_id");



ALTER TABLE ONLY "public"."teams_members"
    ADD CONSTRAINT "teams_members_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."todos"
    ADD CONSTRAINT "todo_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_positions"
    ADD CONSTRAINT "user_roles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."user_positions"
    ADD CONSTRAINT "users_roles_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_users_auth_id" ON "public"."users" USING "btree" ("auth_id");



CREATE OR REPLACE TRIGGER "on_points_earned" AFTER INSERT OR DELETE OR UPDATE ON "public"."point_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_leaderboard_ranks"();



CREATE OR REPLACE TRIGGER "on_user_roles_updated" BEFORE UPDATE ON "public"."user_positions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "tr_set_points_on_insert" BEFORE INSERT ON "public"."point_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_transaction_points"();



CREATE OR REPLACE TRIGGER "tr_smart_point_insertion" BEFORE INSERT ON "public"."point_transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_transaction_points_and_year"();



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."branches"
    ADD CONSTRAINT "branches_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."events_attendance"
    ADD CONSTRAINT "events_attended_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events_attendance"
    ADD CONSTRAINT "events_attended_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leaderboard"
    ADD CONSTRAINT "leaderboard_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."officer_profiles"
    ADD CONSTRAINT "officer_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."officer_profiles"
    ADD CONSTRAINT "officer_profiles_officer_role_fkey" FOREIGN KEY ("officer_role") REFERENCES "public"."user_positions"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."officer_profiles"
    ADD CONSTRAINT "officer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."opportunities"
    ADD CONSTRAINT "opportunities_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id");



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."point_categories"("id");



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."points"
    ADD CONSTRAINT "points_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE SET DEFAULT;



ALTER TABLE ONLY "public"."points"
    ADD CONSTRAINT "points_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE RESTRICT ON DELETE SET NULL;



ALTER TABLE ONLY "public"."points"
    ADD CONSTRAINT "points_user_id_fkey1" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."position_permissions"
    ADD CONSTRAINT "position_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."position_permissions"
    ADD CONSTRAINT "position_permissions_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON UPDATE CASCADE ON DELETE SET DEFAULT;



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_positions"
    ADD CONSTRAINT "public_users_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams_members"
    ADD CONSTRAINT "teams_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON UPDATE CASCADE ON DELETE SET DEFAULT;



ALTER TABLE ONLY "public"."teams_members"
    ADD CONSTRAINT "teams_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."todos_users"
    ADD CONSTRAINT "todos_users_todo_id_fkey" FOREIGN KEY ("todo_id") REFERENCES "public"."todos"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_positions"
    ADD CONSTRAINT "user_roles_positionTitle_fkey" FOREIGN KEY ("positionTitle") REFERENCES "public"."positions"("title") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_positions"
    ADD CONSTRAINT "users_roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_positions"
    ADD CONSTRAINT "users_roles_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE "public"."academic_years" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."branches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events_attendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events_attending" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leaderboard" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leaderboards_teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."officer_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."opportunities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."point_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."point_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."points" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."position_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."positions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams_leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."todos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."todos_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_positions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."handle_new_user_link"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_link"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_link"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_payments_from_users"() TO "anon";
GRANT ALL ON FUNCTION "public"."populate_payments_from_users"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_payments_from_users"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_transaction_points"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_transaction_points"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_transaction_points"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_transaction_points_and_year"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_transaction_points_and_year"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_transaction_points_and_year"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_leaderboard_ranks"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_leaderboard_ranks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_leaderboard_ranks"() TO "service_role";
























GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."todos_users" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."todos_users" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."todos_users" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Todo_User_todo_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Todo_User_todo_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Todo_User_todo_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."academic_years" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."academic_years" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."academic_years" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."opportunities" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."opportunities" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."opportunities" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."active_opportunities" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."active_opportunities" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."active_opportunities" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."branches" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."branches" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."branches" TO "service_role";



GRANT ALL ON SEQUENCE "public"."branches_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."branches_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."branches_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."events" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."events" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."events_attendance" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."events_attendance" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."events_attendance" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."events_attending" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."events_attending" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."events_attending" TO "service_role";



GRANT ALL ON SEQUENCE "public"."events_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."events_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."events_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leaderboard" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leaderboard" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leaderboard" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leaderboards_teams" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leaderboards_teams" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."leaderboards_teams" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."officer_profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."officer_profiles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."officer_profiles" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."payments" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."payments" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."payments" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."permissions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."permissions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."permissions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."point_categories" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."point_categories" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."point_categories" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."point_transactions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."point_transactions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."point_transactions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."points" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."points" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."points" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."position_permissions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."position_permissions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."position_permissions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."positions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."positions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."positions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."positions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."positions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."positions_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."projects" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."projects" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON SEQUENCE "public"."projects_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."projects_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."projects_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."roles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."roles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."roles_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."tasks" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."tasks" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."tasks" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teams" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teams" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teams" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teams_leads" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teams_leads" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teams_leads" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teams_members" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teams_members" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."teams_members" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."todos" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."todos" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."todos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."todo_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."todo_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."todo_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_positions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_positions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_positions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."users" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."users" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."users" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_profile" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_profile" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_profile" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "service_role";































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_link();


