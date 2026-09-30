-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fname" TEXT,
    "lname" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_discounts" (
    "id" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "save_label" TEXT,
    "discount_percent" INTEGER NOT NULL DEFAULT 0,
    "months" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "billing_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_measurements" (
    "id" TEXT NOT NULL,
    "client_id" TEXT,
    "gender" VARCHAR(20),
    "activity_level" VARCHAR(50),
    "date_of_birth" DATE,
    "weight" DECIMAL(6,2),
    "height" DECIMAL(6,2),
    "neck" DECIMAL(6,2),
    "waist" DECIMAL(6,2),
    "hip" DECIMAL(6,2),
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_observations" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "author_id" TEXT,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_photos" (
    "id" TEXT NOT NULL,
    "client_id" TEXT,
    "photo_type" VARCHAR(20) NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "client_code" INTEGER NOT NULL,
    "fname" VARCHAR(100) NOT NULL,
    "lname" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(20),
    "workspace_id" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "password" VARCHAR(255),
    "phones" JSONB DEFAULT '[]',
    "current_package" TEXT,
    "subscription_status" TEXT NOT NULL DEFAULT 'Active',
    "archived_at" TIMESTAMPTZ(6),
    "archived_by" TEXT,
    "restored_at" TIMESTAMPTZ(6),
    "restored_by" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" TEXT,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_equipments" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT,

    CONSTRAINT "exercise_equipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_library" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "muscle_group" TEXT,
    "equipment" TEXT,
    "youtube_url" TEXT,
    "video_path" TEXT,
    "thumbnail_path" TEXT,
    "instructions_en" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name_ar" TEXT,
    "instructions_ar" TEXT,

    CONSTRAINT "exercise_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_muscle_groups" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT,

    CONSTRAINT "exercise_muscle_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_categories" (
    "id" TEXT NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "workspace_id" TEXT,
    "name_ar" VARCHAR(100),

    CONSTRAINT "food_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "food_items" (
    "id" TEXT NOT NULL,
    "name_en" VARCHAR(255) NOT NULL,
    "calories_per_serving" DECIMAL NOT NULL,
    "protein_per_serving" DECIMAL NOT NULL,
    "carbs_per_serving" DECIMAL NOT NULL,
    "fats_per_serving" DECIMAL NOT NULL,
    "workspace_id" TEXT,
    "food_category" TEXT,
    "serving_size" DECIMAL,
    "serving_unit" TEXT,
    "name_ar" VARCHAR(255),

    CONSTRAINT "food_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_exercise_muscle_groups" (
    "id" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_exercise_muscle_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_exercise_equipments" (
    "id" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_exercise_equipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_exercise_library" (
    "id" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT,
    "muscle_group" TEXT,
    "equipment" TEXT,
    "youtube_url" TEXT,
    "video_path" TEXT,
    "thumbnail_path" TEXT,
    "instructions_en" TEXT,
    "instructions_ar" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_exercise_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_food_categories" (
    "id" TEXT NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "name_ar" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_food_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_food_items" (
    "id" TEXT NOT NULL,
    "name_en" VARCHAR(255) NOT NULL,
    "name_ar" VARCHAR(255),
    "food_category" TEXT,
    "serving_size" DECIMAL,
    "serving_unit" TEXT,
    "calories_per_serving" DECIMAL NOT NULL DEFAULT 0,
    "protein_per_serving" DECIMAL NOT NULL DEFAULT 0,
    "carbs_per_serving" DECIMAL NOT NULL DEFAULT 0,
    "fats_per_serving" DECIMAL NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_food_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_forms" (
    "id" TEXT NOT NULL,
    "title_en" VARCHAR(255) NOT NULL DEFAULT 'Untitled Form',
    "title_ar" VARCHAR(255),
    "description_en" TEXT,
    "description_ar" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "post_action" TEXT NOT NULL DEFAULT 'nothing',
    "form_type" TEXT NOT NULL DEFAULT 'check-in',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_form_questions" (
    "id" TEXT NOT NULL,
    "master_form_id" TEXT NOT NULL,
    "label_en" TEXT NOT NULL DEFAULT 'Question',
    "label_ar" TEXT,
    "type" VARCHAR(30) NOT NULL DEFAULT 'text',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "options_ar" JSONB,
    "placeholder_en" TEXT,
    "placeholder_ar" TEXT,
    "min_value" INTEGER,
    "max_value" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_form_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_questions" (
    "id" TEXT NOT NULL,
    "form_id" TEXT NOT NULL,
    "label_en" TEXT NOT NULL DEFAULT 'Question',
    "type" VARCHAR(30) NOT NULL DEFAULT 'text',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "options" JSONB,
    "placeholder_en" TEXT,
    "min_value" INTEGER,
    "max_value" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label_ar" TEXT,
    "placeholder_ar" TEXT,
    "options_ar" JSONB,
    "metric_id" TEXT,

    CONSTRAINT "form_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_requests" (
    "id" TEXT NOT NULL,
    "form_id" TEXT,
    "client_id" TEXT,
    "workspace_id" TEXT NOT NULL,
    "status" VARCHAR(20) DEFAULT 'pending',
    "requested_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(6),
    "post_action" TEXT NOT NULL DEFAULT 'nothing',
    "scheduled_at" TIMESTAMPTZ(6),
    "action_taken_at" TIMESTAMPTZ(6),
    "assigned_to" TEXT,

    CONSTRAINT "form_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_responses" (
    "id" TEXT NOT NULL,
    "request_id" TEXT,
    "question_id" TEXT,
    "answer" TEXT,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "metric_id" TEXT,

    CONSTRAINT "form_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forms" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "title_en" VARCHAR(255) NOT NULL DEFAULT 'Untitled Form',
    "description_en" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "post_action" TEXT NOT NULL DEFAULT 'nothing',
    "form_type" TEXT NOT NULL DEFAULT 'check-in',
    "title_ar" VARCHAR(255),
    "description_ar" TEXT,

    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "unit" VARCHAR(50),
    "icon" VARCHAR(100),
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "sender_type" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read_by_team_at" TIMESTAMPTZ(6),
    "read_by_client_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_cycles" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Cycle 1',
    "cycle_order" INTEGER NOT NULL DEFAULT 1,
    "goal_calories" INTEGER,
    "goal_protein" INTEGER,
    "goal_carbs" INTEGER,
    "goal_fats" INTEGER,
    "note" TEXT,

    CONSTRAINT "nutrition_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_meal_item_alternatives" (
    "id" TEXT NOT NULL,
    "meal_item_id" TEXT,
    "food_item_id" TEXT,
    "amount" DECIMAL NOT NULL,
    "alt_order" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "nutrition_meal_item_alternatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_meal_items" (
    "id" TEXT NOT NULL,
    "meal_id" TEXT,
    "food_item_id" TEXT,
    "amount" DECIMAL NOT NULL DEFAULT 100,
    "meal_item_order" INTEGER NOT NULL,

    CONSTRAINT "nutrition_meal_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_meals" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT,
    "name" TEXT NOT NULL,
    "meal_order" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,

    CONSTRAINT "nutrition_meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nutrition_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client_id" TEXT,
    "workspace_id" TEXT,
    "status" TEXT DEFAULT 'draft',
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "activated_at" TIMESTAMPTZ(6),
    "created_by" TEXT,

    CONSTRAINT "nutrition_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_variations" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_variations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_access_policies" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "package_id" TEXT,
    "scope" TEXT NOT NULL,
    "keep_portal_access" BOOLEAN NOT NULL DEFAULT true,
    "view_training_plans" BOOLEAN NOT NULL DEFAULT true,
    "view_nutrition_plans" BOOLEAN NOT NULL DEFAULT true,
    "view_progress_history" BOOLEAN NOT NULL DEFAULT true,
    "view_assessments" BOOLEAN NOT NULL DEFAULT true,
    "view_checkins" BOOLEAN NOT NULL DEFAULT true,
    "allow_messaging" BOOLEAN NOT NULL DEFAULT false,
    "allow_submit_checkins" BOOLEAN NOT NULL DEFAULT false,
    "allow_booking_appointments" BOOLEAN NOT NULL DEFAULT false,
    "allow_download_files" BOOLEAN NOT NULL DEFAULT false,
    "grace_period_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_access_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_status_audit" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "client_id" TEXT,
    "actor_type" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "event_type" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_status_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "recipient_type" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "importance" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "actor_type" TEXT,
    "actor_id" TEXT,
    "metadata" JSONB,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdf_settings" (
    "id" TEXT NOT NULL,
    "coach_id" TEXT,
    "coach_name" TEXT NOT NULL DEFAULT 'FitForce',
    "footer_text" TEXT NOT NULL DEFAULT 'Generated by FitForce',
    "primary_color" TEXT NOT NULL DEFAULT '#007AFF',
    "show_notes" BOOLEAN NOT NULL DEFAULT true,
    "show_alternatives" BOOLEAN NOT NULL DEFAULT true,
    "show_macros_summary" BOOLEAN NOT NULL DEFAULT true,
    "show_cycle_totals" BOOLEAN NOT NULL DEFAULT true,
    "show_meal_totals" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "logo_url" TEXT,
    "header_text_color" TEXT NOT NULL DEFAULT '#FFFFFF',
    "show_food_calories" BOOLEAN NOT NULL DEFAULT true,
    "table_header_bg_color" TEXT NOT NULL DEFAULT '#E8E8ED',
    "table_alt_bg_color" TEXT NOT NULL DEFAULT '#F9F9FB',
    "show_food_macros" BOOLEAN NOT NULL DEFAULT true,
    "show_cover_page" BOOLEAN NOT NULL DEFAULT true,
    "show_plan_summary_page" BOOLEAN NOT NULL DEFAULT true,
    "show_meal_summary_page" BOOLEAN NOT NULL DEFAULT true,
    "show_cycle_summary_page" BOOLEAN NOT NULL DEFAULT true,
    "page_bg_image_url" TEXT,
    "cover_image_url" TEXT,
    "cover_title" TEXT NOT NULL DEFAULT 'Nutrition Plan',
    "cover_subtitle" TEXT DEFAULT '',
    "summary_bg_image_url" TEXT,
    "page_width" REAL NOT NULL DEFAULT 595.28,
    "page_height" REAL NOT NULL DEFAULT 841.89,
    "plan_summary_bg_image_url" TEXT,
    "meal_summary_bg_image_url" TEXT,
    "cycle_summary_bg_image_url" TEXT,
    "back_cover_bg_image_url" TEXT,
    "show_back_cover_page" BOOLEAN NOT NULL DEFAULT false,
    "max_meals_per_page" INTEGER NOT NULL DEFAULT 0,
    "meals_content_primary_color" TEXT,
    "plan_summary_primary_color" TEXT,
    "cycle_summary_primary_color" TEXT,

    CONSTRAINT "pdf_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pgmigrations" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "run_on" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "pgmigrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_period_links" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "billing_discount_id" TEXT NOT NULL,
    "payment_link" TEXT,

    CONSTRAINT "plan_period_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "max_team_seats" INTEGER,
    "max_workspaces" INTEGER,
    "features" JSONB NOT NULL DEFAULT '{}',
    "price_monthly" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "trial_days" INTEGER,
    "duration_days" INTEGER NOT NULL DEFAULT 30,
    "payment_link" TEXT,
    "subtitle" TEXT,
    "is_popular" BOOLEAN NOT NULL DEFAULT false,
    "cta_text" TEXT NOT NULL DEFAULT 'Get Started',
    "cta_variant" TEXT NOT NULL DEFAULT 'outline',
    "features_header" TEXT NOT NULL DEFAULT 'What''s included:',
    "features_subheader" TEXT,
    "has_team_counter" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'LE',
    "show_on_landing" BOOLEAN NOT NULL DEFAULT true,
    "price_per_seat" DECIMAL(10,2),
    "min_seat_count" INTEGER NOT NULL DEFAULT 1,
    "max_seat_count" INTEGER NOT NULL DEFAULT 20,
    "max_clients" INTEGER,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_freezes" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "freeze_start_date" DATE NOT NULL,
    "freeze_duration_days" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_freezes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "threads" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_days" (
    "id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "day_order" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "training_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_exercise_alternatives" (
    "id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "exercise_library_id" TEXT NOT NULL,
    "alt_order" INTEGER NOT NULL,

    CONSTRAINT "training_exercise_alternatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_exercises" (
    "id" TEXT NOT NULL,
    "day_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "exercise_order" INTEGER NOT NULL,
    "equipment" TEXT,
    "notes" TEXT,
    "exercise_library_id" TEXT,

    CONSTRAINT "training_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activated_at" TIMESTAMPTZ(6),
    "created_by" TEXT,

    CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_sets" (
    "id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "set_order" INTEGER NOT NULL,
    "reps" TEXT,
    "rest_seconds" INTEGER,
    "tempo" TEXT,
    "rir" INTEGER,

    CONSTRAINT "training_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "transaction_code" INTEGER NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "package_variation" TEXT,
    "payment_method" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "type" TEXT NOT NULL DEFAULT 'subscription',
    "status" TEXT NOT NULL DEFAULT 'completed',
    "notes" TEXT,
    "transaction_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "client_id" TEXT,
    "duration" INTEGER,
    "proof_image" TEXT,
    "subscription_start_date" DATE,
    "start_mode" TEXT NOT NULL DEFAULT 'on_first_plan',

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "fname" VARCHAR(100) NOT NULL,
    "lname" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "default_workspace_id" TEXT,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verification_code" TEXT,
    "verification_code_expires_at" TIMESTAMPTZ(6),
    "phone" TEXT,
    "preferred_language" VARCHAR(10) NOT NULL DEFAULT 'en',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_logs" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "plan_id" TEXT,
    "day_id" TEXT,
    "day_index" INTEGER,
    "date" DATE NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "exercises" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_audit_log" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_invitations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "invited_by_user_id" TEXT NOT NULL,
    "invited_user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ(6),

    CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_payments" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "duration_days" INTEGER NOT NULL,
    "fawaterak_invoice_id" TEXT,
    "fawaterak_payment_url" TEXT,
    "fawaterak_status" TEXT NOT NULL DEFAULT 'pending',
    "fawaterak_raw_webhook" JSONB,
    "notes" TEXT,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_subscriptions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "slug_customized" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clone_status" TEXT NOT NULL DEFAULT 'ready',
    "clone_error" TEXT,
    "client_deletion_strategy" TEXT NOT NULL DEFAULT 'anonymize',

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "billing_discounts_period_key_key" ON "billing_discounts"("period_key");

-- CreateIndex
CREATE UNIQUE INDEX "client_measurements_client_id_key" ON "client_measurements"("client_id");

-- CreateIndex
CREATE INDEX "client_observations_client_id_index" ON "client_observations"("client_id");

-- CreateIndex
CREATE INDEX "client_observations_workspace_id_index" ON "client_observations"("workspace_id");

-- CreateIndex
CREATE INDEX "idx_clients_ws_archived" ON "clients"("workspace_id", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "clients_coach_id_client_code_key" ON "clients"("workspace_id", "client_code");

-- CreateIndex
CREATE UNIQUE INDEX "clients_workspace_id_email_key" ON "clients"("workspace_id", "email");

-- CreateIndex
CREATE INDEX "idx_exercise_equipments_coach" ON "exercise_equipments"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_equipments_coach_id_name_key" ON "exercise_equipments"("workspace_id", "name_en");

-- CreateIndex
CREATE INDEX "idx_exercise_library_coach" ON "exercise_library"("workspace_id");

-- CreateIndex
CREATE INDEX "idx_exercise_muscle_groups_coach" ON "exercise_muscle_groups"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_muscle_groups_coach_id_name_key" ON "exercise_muscle_groups"("workspace_id", "name_en");

-- CreateIndex
CREATE UNIQUE INDEX "master_exercise_muscle_groups_name_en_key" ON "master_exercise_muscle_groups"("name_en");

-- CreateIndex
CREATE UNIQUE INDEX "master_exercise_equipments_name_en_key" ON "master_exercise_equipments"("name_en");

-- CreateIndex
CREATE INDEX "master_exercise_library_name_en_idx" ON "master_exercise_library"("name_en");

-- CreateIndex
CREATE INDEX "master_exercise_library_muscle_group_idx" ON "master_exercise_library"("muscle_group");

-- CreateIndex
CREATE UNIQUE INDEX "master_food_categories_name_en_key" ON "master_food_categories"("name_en");

-- CreateIndex
CREATE INDEX "master_food_items_name_en_idx" ON "master_food_items"("name_en");

-- CreateIndex
CREATE INDEX "master_food_items_food_category_idx" ON "master_food_items"("food_category");

-- CreateIndex
CREATE INDEX "master_forms_form_type_idx" ON "master_forms"("form_type");

-- CreateIndex
CREATE INDEX "master_form_questions_master_form_id_idx" ON "master_form_questions"("master_form_id");

-- CreateIndex
CREATE INDEX "form_questions_metric_id_idx" ON "form_questions"("metric_id");

-- CreateIndex
CREATE INDEX "form_requests_assigned_to_idx" ON "form_requests"("assigned_to");

-- CreateIndex
CREATE INDEX "form_responses_metric_id_idx" ON "form_responses"("metric_id");

-- CreateIndex
CREATE INDEX "form_responses_request_id_metric_id_idx" ON "form_responses"("request_id", "metric_id");

-- CreateIndex
CREATE INDEX "metrics_workspace_id_deleted_at_idx" ON "metrics"("workspace_id", "deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "metrics_workspace_id_name_key" ON "metrics"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "messages_thread_id_idx" ON "messages"("thread_id");

-- CreateIndex
CREATE INDEX "idx_sub_policy_workspace" ON "subscription_access_policies"("workspace_id");

-- CreateIndex
CREATE INDEX "idx_sub_policy_package" ON "subscription_access_policies"("package_id");

-- CreateIndex
CREATE INDEX "idx_sub_audit_workspace" ON "subscription_status_audit"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_sub_audit_client" ON "subscription_status_audit"("client_id");

-- CreateIndex
CREATE INDEX "idx_notifications_recipient" ON "notifications"("recipient_type", "recipient_id", "read_at", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notifications_workspace" ON "notifications"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "pdf_settings_coach_id_key" ON "pdf_settings"("coach_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_period_links_plan_id_billing_discount_id_key" ON "plan_period_links"("plan_id", "billing_discount_id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- CreateIndex
CREATE INDEX "threads_workspace_id_idx" ON "threads"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "threads_workspace_client_unique" ON "threads"("workspace_id", "client_id");

-- CreateIndex
CREATE INDEX "idx_training_days_plan" ON "training_days"("plan_id");

-- CreateIndex
CREATE INDEX "idx_training_alternatives_exercise" ON "training_exercise_alternatives"("exercise_id");

-- CreateIndex
CREATE INDEX "idx_training_exercises_day" ON "training_exercises"("day_id");

-- CreateIndex
CREATE INDEX "idx_training_plans_client" ON "training_plans"("client_id");

-- CreateIndex
CREATE INDEX "idx_training_plans_coach_client" ON "training_plans"("workspace_id", "client_id");

-- CreateIndex
CREATE INDEX "idx_training_sets_exercise" ON "training_sets"("exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_workspace_code_key" ON "transactions"("workspace_id", "transaction_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "workout_logs_client_id_date_index" ON "workout_logs"("client_id", "date");

-- CreateIndex
CREATE INDEX "workout_logs_client_id_index" ON "workout_logs"("client_id");

-- CreateIndex
CREATE INDEX "workout_logs_plan_id_index" ON "workout_logs"("plan_id");

-- CreateIndex
CREATE INDEX "workout_logs_workspace_id_index" ON "workout_logs"("workspace_id");

-- CreateIndex
CREATE INDEX "idx_audit_workspace" ON "workspace_audit_log"("workspace_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_invitations_invited_user" ON "workspace_invitations"("invited_user_id", "status");

-- CreateIndex
CREATE INDEX "idx_invitations_workspace" ON "workspace_invitations"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invitations_workspace_id_invited_user_id_key" ON "workspace_invitations"("workspace_id", "invited_user_id");

-- CreateIndex
CREATE INDEX "idx_workspace_members_user" ON "workspace_members"("user_id");

-- CreateIndex
CREATE INDEX "idx_workspace_members_workspace" ON "workspace_members"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "workspace_payments_fawaterak_invoice_id_idx" ON "workspace_payments"("fawaterak_invoice_id");

-- CreateIndex
CREATE INDEX "workspace_payments_workspace_id_idx" ON "workspace_payments"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_subscriptions_workspace_id_key" ON "workspace_subscriptions"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE INDEX "idx_workspaces_owner" ON "workspaces"("owner_id");

-- CreateIndex
CREATE INDEX "idx_workspaces_slug" ON "workspaces"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "idx_user_sessions_user_id" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_sessions_token_hash" ON "user_sessions"("token_hash");

-- AddForeignKey
ALTER TABLE "client_measurements" ADD CONSTRAINT "client_measurements_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_observations" ADD CONSTRAINT "client_observations_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_observations" ADD CONSTRAINT "client_observations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_observations" ADD CONSTRAINT "client_observations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_photos" ADD CONSTRAINT "client_photos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "fk_clients_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "exercise_equipments" ADD CONSTRAINT "fk_exercise_equipments_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "exercise_library" ADD CONSTRAINT "fk_exercise_library_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "exercise_muscle_groups" ADD CONSTRAINT "fk_exercise_muscle_groups_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "food_categories" ADD CONSTRAINT "fk_food_categories_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "food_items" ADD CONSTRAINT "fk_food_items_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "master_form_questions" ADD CONSTRAINT "master_form_questions_master_form_id_fkey" FOREIGN KEY ("master_form_id") REFERENCES "master_forms"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "form_questions" ADD CONSTRAINT "form_questions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "form_questions" ADD CONSTRAINT "form_questions_metric_id_fkey" FOREIGN KEY ("metric_id") REFERENCES "metrics"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "form_requests" ADD CONSTRAINT "fk_form_requests_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "form_requests" ADD CONSTRAINT "form_requests_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "form_questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "form_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "form_responses" ADD CONSTRAINT "form_responses_metric_id_fkey" FOREIGN KEY ("metric_id") REFERENCES "metrics"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "fk_forms_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nutrition_cycles" ADD CONSTRAINT "nutrition_cycles_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "nutrition_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nutrition_meal_item_alternatives" ADD CONSTRAINT "nutrition_meal_item_alternatives_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nutrition_meal_item_alternatives" ADD CONSTRAINT "nutrition_meal_item_alternatives_meal_item_id_fkey" FOREIGN KEY ("meal_item_id") REFERENCES "nutrition_meal_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nutrition_meal_items" ADD CONSTRAINT "nutrition_meal_items_food_item_id_fkey" FOREIGN KEY ("food_item_id") REFERENCES "food_items"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nutrition_meal_items" ADD CONSTRAINT "nutrition_meal_items_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "nutrition_meals"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nutrition_meals" ADD CONSTRAINT "nutrition_meals_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "nutrition_cycles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nutrition_plans" ADD CONSTRAINT "fk_nutrition_plans_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nutrition_plans" ADD CONSTRAINT "nutrition_plans_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nutrition_plans" ADD CONSTRAINT "nutrition_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "package_variations" ADD CONSTRAINT "package_variations_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "fk_packages_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_access_policies" ADD CONSTRAINT "subscription_access_policies_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_access_policies" ADD CONSTRAINT "subscription_access_policies_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "fk_payment_methods_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pdf_settings" ADD CONSTRAINT "pdf_settings_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "plan_period_links" ADD CONSTRAINT "plan_period_links_billing_discount_id_fkey" FOREIGN KEY ("billing_discount_id") REFERENCES "billing_discounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "plan_period_links" ADD CONSTRAINT "plan_period_links_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscription_freezes" ADD CONSTRAINT "subscription_freezes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "training_days" ADD CONSTRAINT "training_days_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "training_exercise_alternatives" ADD CONSTRAINT "training_exercise_alternatives_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "training_exercises"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "training_exercise_alternatives" ADD CONSTRAINT "training_exercise_alternatives_exercise_library_id_fkey" FOREIGN KEY ("exercise_library_id") REFERENCES "exercise_library"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "training_exercises" ADD CONSTRAINT "training_exercises_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "training_days"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "training_exercises" ADD CONSTRAINT "training_exercises_exercise_library_id_fkey" FOREIGN KEY ("exercise_library_id") REFERENCES "exercise_library"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "training_plans" ADD CONSTRAINT "fk_training_plans_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "training_sets" ADD CONSTRAINT "training_sets_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "training_exercises"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "fk_transactions_workspace" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_default_workspace_id_fkey" FOREIGN KEY ("default_workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "training_days"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "training_plans"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workspace_audit_log" ADD CONSTRAINT "workspace_audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workspace_audit_log" ADD CONSTRAINT "workspace_audit_log_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_user_id_fkey" FOREIGN KEY ("invited_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workspace_payments" ADD CONSTRAINT "workspace_payments_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workspace_payments" ADD CONSTRAINT "workspace_payments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workspace_subscriptions" ADD CONSTRAINT "workspace_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workspace_subscriptions" ADD CONSTRAINT "workspace_subscriptions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "fk_workspaces_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
