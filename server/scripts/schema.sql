--
-- PostgreSQL database dump
--

\restrict wac7p0gmTVjyjB0me7R6SAdiwByfNTZ0rMxN9hRwu8cfN3QS2tQPFr36xsvWMXT

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admins (
    id integer NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    fname text,
    lname text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admins_id_seq OWNED BY public.admins.id;


--
-- Name: client_measurements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_measurements (
    id integer NOT NULL,
    client_id integer,
    gender character varying(20),
    activity_level character varying(50),
    date_of_birth date,
    weight numeric(6,2),
    height numeric(6,2),
    neck numeric(6,2),
    waist numeric(6,2),
    hip numeric(6,2),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: client_measurements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.client_measurements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: client_measurements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.client_measurements_id_seq OWNED BY public.client_measurements.id;


--
-- Name: client_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_photos (
    id integer NOT NULL,
    client_id integer,
    photo_type character varying(20) NOT NULL,
    file_path character varying(500) NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now()
);


--
-- Name: client_photos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.client_photos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: client_photos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.client_photos_id_seq OWNED BY public.client_photos.id;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    client_code integer NOT NULL,
    fname character varying(100) NOT NULL,
    lname character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    phone character varying(20),
    workspace_id integer,
    created_at timestamp without time zone DEFAULT now(),
    password character varying(255),
    phones jsonb DEFAULT '[]'::jsonb,
    current_package text,
    subscription_status text DEFAULT 'Active'::text NOT NULL
);


--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- Name: exercise_equipments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exercise_equipments (
    id integer NOT NULL,
    workspace_id integer CONSTRAINT exercise_equipments_coach_id_not_null NOT NULL,
    name text NOT NULL
);


--
-- Name: exercise_equipments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exercise_equipments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exercise_equipments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exercise_equipments_id_seq OWNED BY public.exercise_equipments.id;


--
-- Name: exercise_library; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exercise_library (
    id integer NOT NULL,
    workspace_id integer CONSTRAINT exercise_library_coach_id_not_null NOT NULL,
    name text NOT NULL,
    muscle_group text,
    equipment text,
    youtube_url text,
    video_path text,
    thumbnail_path text,
    instructions text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: exercise_library_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exercise_library_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exercise_library_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exercise_library_id_seq OWNED BY public.exercise_library.id;


--
-- Name: exercise_muscle_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exercise_muscle_groups (
    id integer NOT NULL,
    workspace_id integer CONSTRAINT exercise_muscle_groups_coach_id_not_null NOT NULL,
    name text NOT NULL
);


--
-- Name: exercise_muscle_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exercise_muscle_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exercise_muscle_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exercise_muscle_groups_id_seq OWNED BY public.exercise_muscle_groups.id;


--
-- Name: food_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.food_categories (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    workspace_id integer
);


--
-- Name: food_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.food_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: food_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.food_categories_id_seq OWNED BY public.food_categories.id;


--
-- Name: food_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.food_items (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    calories_per_serving numeric CONSTRAINT food_items_calories_not_null NOT NULL,
    protein_per_serving numeric CONSTRAINT food_items_protein_not_null NOT NULL,
    carbs_per_serving numeric CONSTRAINT food_items_carbs_not_null NOT NULL,
    fats_per_serving numeric CONSTRAINT food_items_fat_not_null NOT NULL,
    workspace_id integer,
    food_category text,
    serving_size numeric,
    serving_unit text
);


--
-- Name: food_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.food_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: food_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.food_items_id_seq OWNED BY public.food_items.id;


--
-- Name: form_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_questions (
    id integer NOT NULL,
    form_id integer NOT NULL,
    label text DEFAULT 'Question'::text NOT NULL,
    type character varying(30) DEFAULT 'text'::character varying NOT NULL,
    required boolean DEFAULT false NOT NULL,
    order_index integer DEFAULT 0 NOT NULL,
    options jsonb,
    placeholder text,
    min_value integer,
    max_value integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT form_questions_type_check CHECK (((type)::text = ANY ((ARRAY['text'::character varying, 'long_text'::character varying, 'number'::character varying, 'scale'::character varying, 'select'::character varying, 'multiselect'::character varying, 'date'::character varying])::text[])))
);


--
-- Name: form_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.form_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: form_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.form_questions_id_seq OWNED BY public.form_questions.id;


--
-- Name: form_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_requests (
    id integer NOT NULL,
    form_id integer,
    client_id integer,
    workspace_id integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    requested_at timestamp without time zone DEFAULT now(),
    submitted_at timestamp without time zone,
    post_action text DEFAULT 'nothing'::text NOT NULL,
    scheduled_at timestamp with time zone,
    action_taken_at timestamp with time zone
);


--
-- Name: form_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.form_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: form_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.form_requests_id_seq OWNED BY public.form_requests.id;


--
-- Name: form_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_responses (
    id integer NOT NULL,
    request_id integer,
    question_id integer,
    answer text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: form_responses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.form_responses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: form_responses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.form_responses_id_seq OWNED BY public.form_responses.id;


--
-- Name: forms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forms (
    id integer NOT NULL,
    workspace_id integer NOT NULL,
    title character varying(255) DEFAULT 'Untitled Form'::character varying NOT NULL,
    description text,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    post_action text DEFAULT 'nothing'::text NOT NULL,
    form_type text DEFAULT 'check-in'::text NOT NULL,
    CONSTRAINT forms_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying])::text[])))
);


--
-- Name: forms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.forms_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: forms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.forms_id_seq OWNED BY public.forms.id;


--
-- Name: nutrition_cycles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nutrition_cycles (
    id integer NOT NULL,
    plan_id integer,
    name text DEFAULT 'Cycle 1'::text NOT NULL,
    cycle_order integer DEFAULT 1 NOT NULL,
    goal_calories integer,
    goal_protein integer,
    goal_carbs integer,
    goal_fats integer,
    note text
);


--
-- Name: nutrition_cycles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nutrition_cycles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nutrition_cycles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nutrition_cycles_id_seq OWNED BY public.nutrition_cycles.id;


--
-- Name: nutrition_meal_item_alternatives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nutrition_meal_item_alternatives (
    id integer NOT NULL,
    meal_item_id integer,
    food_item_id integer,
    amount numeric NOT NULL,
    alt_order integer DEFAULT 1 NOT NULL
);


--
-- Name: nutrition_meal_item_alternatives_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nutrition_meal_item_alternatives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nutrition_meal_item_alternatives_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nutrition_meal_item_alternatives_id_seq OWNED BY public.nutrition_meal_item_alternatives.id;


--
-- Name: nutrition_meal_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nutrition_meal_items (
    id integer NOT NULL,
    meal_id integer,
    food_item_id integer,
    amount numeric DEFAULT 100 NOT NULL,
    meal_item_order integer NOT NULL
);


--
-- Name: nutrition_meal_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nutrition_meal_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nutrition_meal_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nutrition_meal_items_id_seq OWNED BY public.nutrition_meal_items.id;


--
-- Name: nutrition_meals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nutrition_meals (
    id integer NOT NULL,
    cycle_id integer,
    name text NOT NULL,
    meal_order integer DEFAULT 1 NOT NULL,
    note text
);


--
-- Name: nutrition_meals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nutrition_meals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nutrition_meals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nutrition_meals_id_seq OWNED BY public.nutrition_meals.id;


--
-- Name: nutrition_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nutrition_plans (
    id integer NOT NULL,
    name text NOT NULL,
    client_id integer,
    workspace_id integer,
    status text DEFAULT 'draft'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    activated_at timestamp with time zone
);


--
-- Name: nutrition_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.nutrition_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: nutrition_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.nutrition_plans_id_seq OWNED BY public.nutrition_plans.id;


--
-- Name: package_variations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.package_variations (
    id integer NOT NULL,
    package_id integer NOT NULL,
    name text NOT NULL,
    description text,
    duration integer NOT NULL,
    price numeric(12,2) NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: package_variations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.package_variations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: package_variations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.package_variations_id_seq OWNED BY public.package_variations.id;


--
-- Name: packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.packages (
    id integer NOT NULL,
    workspace_id integer CONSTRAINT packages_coach_id_not_null NOT NULL,
    name text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: packages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.packages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: packages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.packages_id_seq OWNED BY public.packages.id;


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_methods (
    id integer NOT NULL,
    workspace_id integer CONSTRAINT payment_methods_coach_id_not_null NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_methods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_methods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_methods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_methods_id_seq OWNED BY public.payment_methods.id;


--
-- Name: pdf_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pdf_settings (
    id integer NOT NULL,
    coach_id integer,
    coach_name text DEFAULT 'FitForce'::text NOT NULL,
    footer_text text DEFAULT 'Generated by FitForce'::text NOT NULL,
    primary_color text DEFAULT '#007AFF'::text NOT NULL,
    show_notes boolean DEFAULT true NOT NULL,
    show_alternatives boolean DEFAULT true NOT NULL,
    show_macros_summary boolean DEFAULT true NOT NULL,
    show_cycle_totals boolean DEFAULT true NOT NULL,
    show_meal_totals boolean DEFAULT true NOT NULL,
    updated_at timestamp without time zone DEFAULT now(),
    logo_url text,
    header_text_color text DEFAULT '#FFFFFF'::text NOT NULL,
    show_food_calories boolean DEFAULT true NOT NULL,
    table_header_bg_color text DEFAULT '#E8E8ED'::text NOT NULL,
    table_alt_bg_color text DEFAULT '#F9F9FB'::text NOT NULL,
    show_food_macros boolean DEFAULT true NOT NULL,
    show_cover_page boolean DEFAULT true NOT NULL,
    show_plan_summary_page boolean DEFAULT true NOT NULL,
    show_meal_summary_page boolean DEFAULT true NOT NULL,
    show_cycle_summary_page boolean DEFAULT true NOT NULL,
    page_bg_image_url text,
    cover_image_url text,
    cover_title text DEFAULT 'Nutrition Plan'::text NOT NULL,
    cover_subtitle text DEFAULT ''::text,
    summary_bg_image_url text,
    page_width real DEFAULT 595.28 NOT NULL,
    page_height real DEFAULT 841.89 NOT NULL,
    plan_summary_bg_image_url text,
    meal_summary_bg_image_url text,
    cycle_summary_bg_image_url text,
    back_cover_bg_image_url text,
    show_back_cover_page boolean DEFAULT false NOT NULL,
    max_meals_per_page integer DEFAULT 0 NOT NULL,
    meals_content_primary_color text,
    plan_summary_primary_color text,
    cycle_summary_primary_color text
);


--
-- Name: pdf_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pdf_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pdf_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pdf_settings_id_seq OWNED BY public.pdf_settings.id;


--
-- Name: pgmigrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pgmigrations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    run_on timestamp without time zone NOT NULL
);


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pgmigrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pgmigrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pgmigrations_id_seq OWNED BY public.pgmigrations.id;


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id integer NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    max_team_seats integer,
    max_workspaces integer,
    features jsonb DEFAULT '{}'::jsonb NOT NULL,
    price_monthly numeric(10,2),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.plans_id_seq OWNED BY public.plans.id;


--
-- Name: subscription_freezes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_freezes (
    id integer NOT NULL,
    client_id integer NOT NULL,
    freeze_start_date date NOT NULL,
    freeze_duration_days integer NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: subscription_freezes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscription_freezes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscription_freezes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscription_freezes_id_seq OWNED BY public.subscription_freezes.id;


--
-- Name: training_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_days (
    id integer NOT NULL,
    plan_id integer NOT NULL,
    name text NOT NULL,
    day_order integer NOT NULL,
    notes text
);


--
-- Name: training_days_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.training_days_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: training_days_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.training_days_id_seq OWNED BY public.training_days.id;


--
-- Name: training_exercise_alternatives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_exercise_alternatives (
    id integer NOT NULL,
    exercise_id integer NOT NULL,
    exercise_library_id integer NOT NULL,
    alt_order integer NOT NULL
);


--
-- Name: training_exercise_alternatives_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.training_exercise_alternatives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: training_exercise_alternatives_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.training_exercise_alternatives_id_seq OWNED BY public.training_exercise_alternatives.id;


--
-- Name: training_exercises; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_exercises (
    id integer NOT NULL,
    day_id integer NOT NULL,
    name text NOT NULL,
    exercise_order integer NOT NULL,
    equipment text,
    notes text,
    exercise_library_id integer
);


--
-- Name: training_exercises_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.training_exercises_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: training_exercises_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.training_exercises_id_seq OWNED BY public.training_exercises.id;


--
-- Name: training_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_plans (
    id integer NOT NULL,
    name text NOT NULL,
    client_id integer NOT NULL,
    workspace_id integer CONSTRAINT training_plans_coach_id_not_null NOT NULL,
    status text DEFAULT 'inactive'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    activated_at timestamp with time zone,
    CONSTRAINT training_plans_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: training_plans_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.training_plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: training_plans_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.training_plans_id_seq OWNED BY public.training_plans.id;


--
-- Name: training_sets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_sets (
    id integer NOT NULL,
    exercise_id integer NOT NULL,
    set_order integer NOT NULL,
    reps text,
    rest_seconds integer,
    tempo text,
    rir integer
);


--
-- Name: training_sets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.training_sets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: training_sets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.training_sets_id_seq OWNED BY public.training_sets.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    workspace_id integer CONSTRAINT transactions_coach_id_not_null NOT NULL,
    client_name text NOT NULL,
    package_variation text,
    payment_method text NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'EGP'::text NOT NULL,
    type text DEFAULT 'subscription'::text NOT NULL,
    status text DEFAULT 'completed'::text NOT NULL,
    notes text,
    transaction_date timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    client_id integer,
    duration integer,
    proof_image text,
    subscription_start_date date,
    start_mode text DEFAULT 'on_first_plan'::text NOT NULL
);


--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    fname character varying(100) NOT NULL,
    lname character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    password character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    default_workspace_id integer,
    is_admin boolean DEFAULT false NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: workspace_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_audit_log (
    id integer NOT NULL,
    workspace_id integer NOT NULL,
    actor_user_id integer NOT NULL,
    action text NOT NULL,
    target_type text,
    target_id integer,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workspace_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.workspace_audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workspace_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.workspace_audit_log_id_seq OWNED BY public.workspace_audit_log.id;


--
-- Name: workspace_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_invitations (
    id integer NOT NULL,
    workspace_id integer NOT NULL,
    invited_by_user_id integer NOT NULL,
    invited_user_id integer NOT NULL,
    role text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    responded_at timestamp with time zone,
    CONSTRAINT workspace_invitations_role_check CHECK ((role = ANY (ARRAY['manager'::text, 'trainer'::text, 'nutritionist'::text, 'receptionist'::text, 'viewer'::text]))),
    CONSTRAINT workspace_invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text])))
);


--
-- Name: workspace_invitations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.workspace_invitations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workspace_invitations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.workspace_invitations_id_seq OWNED BY public.workspace_invitations.id;


--
-- Name: workspace_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_members (
    id integer NOT NULL,
    workspace_id integer NOT NULL,
    user_id integer NOT NULL,
    role text NOT NULL,
    permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_members_role_check CHECK ((role = ANY (ARRAY['manager'::text, 'trainer'::text, 'nutritionist'::text, 'receptionist'::text, 'viewer'::text])))
);


--
-- Name: workspace_members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.workspace_members_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workspace_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.workspace_members_id_seq OWNED BY public.workspace_members.id;


--
-- Name: workspace_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_subscriptions (
    id integer NOT NULL,
    workspace_id integer NOT NULL,
    plan_id integer NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    starts_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'cancelled'::text])))
);


--
-- Name: workspace_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.workspace_subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workspace_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.workspace_subscriptions_id_seq OWNED BY public.workspace_subscriptions.id;


--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspaces (
    id integer NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    owner_id integer NOT NULL,
    slug_customized boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workspaces_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.workspaces_id_seq
    START WITH 6
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workspaces_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.workspaces_id_seq OWNED BY public.workspaces.id;


--
-- Name: admins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins ALTER COLUMN id SET DEFAULT nextval('public.admins_id_seq'::regclass);


--
-- Name: client_measurements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_measurements ALTER COLUMN id SET DEFAULT nextval('public.client_measurements_id_seq'::regclass);


--
-- Name: client_photos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_photos ALTER COLUMN id SET DEFAULT nextval('public.client_photos_id_seq'::regclass);


--
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- Name: exercise_equipments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercise_equipments ALTER COLUMN id SET DEFAULT nextval('public.exercise_equipments_id_seq'::regclass);


--
-- Name: exercise_library id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercise_library ALTER COLUMN id SET DEFAULT nextval('public.exercise_library_id_seq'::regclass);


--
-- Name: exercise_muscle_groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercise_muscle_groups ALTER COLUMN id SET DEFAULT nextval('public.exercise_muscle_groups_id_seq'::regclass);


--
-- Name: food_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_categories ALTER COLUMN id SET DEFAULT nextval('public.food_categories_id_seq'::regclass);


--
-- Name: food_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_items ALTER COLUMN id SET DEFAULT nextval('public.food_items_id_seq'::regclass);


--
-- Name: form_questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_questions ALTER COLUMN id SET DEFAULT nextval('public.form_questions_id_seq'::regclass);


--
-- Name: form_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_requests ALTER COLUMN id SET DEFAULT nextval('public.form_requests_id_seq'::regclass);


--
-- Name: form_responses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_responses ALTER COLUMN id SET DEFAULT nextval('public.form_responses_id_seq'::regclass);


--
-- Name: forms id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms ALTER COLUMN id SET DEFAULT nextval('public.forms_id_seq'::regclass);


--
-- Name: nutrition_cycles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_cycles ALTER COLUMN id SET DEFAULT nextval('public.nutrition_cycles_id_seq'::regclass);


--
-- Name: nutrition_meal_item_alternatives id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_meal_item_alternatives ALTER COLUMN id SET DEFAULT nextval('public.nutrition_meal_item_alternatives_id_seq'::regclass);


--
-- Name: nutrition_meal_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_meal_items ALTER COLUMN id SET DEFAULT nextval('public.nutrition_meal_items_id_seq'::regclass);


--
-- Name: nutrition_meals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_meals ALTER COLUMN id SET DEFAULT nextval('public.nutrition_meals_id_seq'::regclass);


--
-- Name: nutrition_plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_plans ALTER COLUMN id SET DEFAULT nextval('public.nutrition_plans_id_seq'::regclass);


--
-- Name: package_variations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_variations ALTER COLUMN id SET DEFAULT nextval('public.package_variations_id_seq'::regclass);


--
-- Name: packages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages ALTER COLUMN id SET DEFAULT nextval('public.packages_id_seq'::regclass);


--
-- Name: payment_methods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods ALTER COLUMN id SET DEFAULT nextval('public.payment_methods_id_seq'::regclass);


--
-- Name: pdf_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_settings ALTER COLUMN id SET DEFAULT nextval('public.pdf_settings_id_seq'::regclass);


--
-- Name: pgmigrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations ALTER COLUMN id SET DEFAULT nextval('public.pgmigrations_id_seq'::regclass);


--
-- Name: plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans ALTER COLUMN id SET DEFAULT nextval('public.plans_id_seq'::regclass);


--
-- Name: subscription_freezes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_freezes ALTER COLUMN id SET DEFAULT nextval('public.subscription_freezes_id_seq'::regclass);


--
-- Name: training_days id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_days ALTER COLUMN id SET DEFAULT nextval('public.training_days_id_seq'::regclass);


--
-- Name: training_exercise_alternatives id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_exercise_alternatives ALTER COLUMN id SET DEFAULT nextval('public.training_exercise_alternatives_id_seq'::regclass);


--
-- Name: training_exercises id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_exercises ALTER COLUMN id SET DEFAULT nextval('public.training_exercises_id_seq'::regclass);


--
-- Name: training_plans id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_plans ALTER COLUMN id SET DEFAULT nextval('public.training_plans_id_seq'::regclass);


--
-- Name: training_sets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_sets ALTER COLUMN id SET DEFAULT nextval('public.training_sets_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: workspace_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_audit_log ALTER COLUMN id SET DEFAULT nextval('public.workspace_audit_log_id_seq'::regclass);


--
-- Name: workspace_invitations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations ALTER COLUMN id SET DEFAULT nextval('public.workspace_invitations_id_seq'::regclass);


--
-- Name: workspace_members id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members ALTER COLUMN id SET DEFAULT nextval('public.workspace_members_id_seq'::regclass);


--
-- Name: workspace_subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.workspace_subscriptions_id_seq'::regclass);


--
-- Name: workspaces id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces ALTER COLUMN id SET DEFAULT nextval('public.workspaces_id_seq'::regclass);


--
-- Name: admins admins_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_email_key UNIQUE (email);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- Name: client_measurements client_measurements_client_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_measurements
    ADD CONSTRAINT client_measurements_client_id_key UNIQUE (client_id);


--
-- Name: client_measurements client_measurements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_measurements
    ADD CONSTRAINT client_measurements_pkey PRIMARY KEY (id);


--
-- Name: client_photos client_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_photos
    ADD CONSTRAINT client_photos_pkey PRIMARY KEY (id);


--
-- Name: clients clients_coach_id_client_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_coach_id_client_code_key UNIQUE (workspace_id, client_code);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: clients clients_workspace_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_workspace_id_email_key UNIQUE (workspace_id, email);


--
-- Name: exercise_equipments exercise_equipments_coach_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercise_equipments
    ADD CONSTRAINT exercise_equipments_coach_id_name_key UNIQUE (workspace_id, name);


--
-- Name: exercise_equipments exercise_equipments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercise_equipments
    ADD CONSTRAINT exercise_equipments_pkey PRIMARY KEY (id);


--
-- Name: exercise_library exercise_library_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercise_library
    ADD CONSTRAINT exercise_library_pkey PRIMARY KEY (id);


--
-- Name: exercise_muscle_groups exercise_muscle_groups_coach_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercise_muscle_groups
    ADD CONSTRAINT exercise_muscle_groups_coach_id_name_key UNIQUE (workspace_id, name);


--
-- Name: exercise_muscle_groups exercise_muscle_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercise_muscle_groups
    ADD CONSTRAINT exercise_muscle_groups_pkey PRIMARY KEY (id);


--
-- Name: food_categories food_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_categories
    ADD CONSTRAINT food_categories_pkey PRIMARY KEY (id);


--
-- Name: food_items food_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_items
    ADD CONSTRAINT food_items_pkey PRIMARY KEY (id);


--
-- Name: form_questions form_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_questions
    ADD CONSTRAINT form_questions_pkey PRIMARY KEY (id);


--
-- Name: form_requests form_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_requests
    ADD CONSTRAINT form_requests_pkey PRIMARY KEY (id);


--
-- Name: form_responses form_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_responses
    ADD CONSTRAINT form_responses_pkey PRIMARY KEY (id);


--
-- Name: forms forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms
    ADD CONSTRAINT forms_pkey PRIMARY KEY (id);


--
-- Name: nutrition_cycles nutrition_cycles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_cycles
    ADD CONSTRAINT nutrition_cycles_pkey PRIMARY KEY (id);


--
-- Name: nutrition_meal_item_alternatives nutrition_meal_item_alternatives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_meal_item_alternatives
    ADD CONSTRAINT nutrition_meal_item_alternatives_pkey PRIMARY KEY (id);


--
-- Name: nutrition_meal_items nutrition_meal_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_meal_items
    ADD CONSTRAINT nutrition_meal_items_pkey PRIMARY KEY (id);


--
-- Name: nutrition_meals nutrition_meals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_meals
    ADD CONSTRAINT nutrition_meals_pkey PRIMARY KEY (id);


--
-- Name: nutrition_plans nutrition_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_plans
    ADD CONSTRAINT nutrition_plans_pkey PRIMARY KEY (id);


--
-- Name: package_variations package_variations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_variations
    ADD CONSTRAINT package_variations_pkey PRIMARY KEY (id);


--
-- Name: packages packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT packages_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: pdf_settings pdf_settings_coach_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_settings
    ADD CONSTRAINT pdf_settings_coach_id_key UNIQUE (coach_id);


--
-- Name: pdf_settings pdf_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_settings
    ADD CONSTRAINT pdf_settings_pkey PRIMARY KEY (id);


--
-- Name: pgmigrations pgmigrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pgmigrations
    ADD CONSTRAINT pgmigrations_pkey PRIMARY KEY (id);


--
-- Name: plans plans_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_name_key UNIQUE (name);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: subscription_freezes subscription_freezes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_freezes
    ADD CONSTRAINT subscription_freezes_pkey PRIMARY KEY (id);


--
-- Name: training_days training_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_days
    ADD CONSTRAINT training_days_pkey PRIMARY KEY (id);


--
-- Name: training_exercise_alternatives training_exercise_alternatives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_exercise_alternatives
    ADD CONSTRAINT training_exercise_alternatives_pkey PRIMARY KEY (id);


--
-- Name: training_exercises training_exercises_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_exercises
    ADD CONSTRAINT training_exercises_pkey PRIMARY KEY (id);


--
-- Name: training_plans training_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_plans
    ADD CONSTRAINT training_plans_pkey PRIMARY KEY (id);


--
-- Name: training_sets training_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_sets
    ADD CONSTRAINT training_sets_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: workspace_audit_log workspace_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_audit_log
    ADD CONSTRAINT workspace_audit_log_pkey PRIMARY KEY (id);


--
-- Name: workspace_invitations workspace_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_pkey PRIMARY KEY (id);


--
-- Name: workspace_invitations workspace_invitations_workspace_id_invited_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_workspace_id_invited_user_id_key UNIQUE (workspace_id, invited_user_id);


--
-- Name: workspace_members workspace_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (id);


--
-- Name: workspace_members workspace_members_workspace_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_user_id_key UNIQUE (workspace_id, user_id);


--
-- Name: workspace_subscriptions workspace_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_subscriptions
    ADD CONSTRAINT workspace_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: workspace_subscriptions workspace_subscriptions_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_subscriptions
    ADD CONSTRAINT workspace_subscriptions_workspace_id_key UNIQUE (workspace_id);


--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);


--
-- Name: workspaces workspaces_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_slug_key UNIQUE (slug);


--
-- Name: idx_audit_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_workspace ON public.workspace_audit_log USING btree (workspace_id, created_at DESC);


--
-- Name: idx_exercise_equipments_coach; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exercise_equipments_coach ON public.exercise_equipments USING btree (workspace_id);


--
-- Name: idx_exercise_library_coach; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exercise_library_coach ON public.exercise_library USING btree (workspace_id);


--
-- Name: idx_exercise_muscle_groups_coach; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exercise_muscle_groups_coach ON public.exercise_muscle_groups USING btree (workspace_id);


--
-- Name: idx_invitations_invited_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_invited_user ON public.workspace_invitations USING btree (invited_user_id, status);


--
-- Name: idx_invitations_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invitations_workspace ON public.workspace_invitations USING btree (workspace_id);


--
-- Name: idx_training_alternatives_exercise; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_alternatives_exercise ON public.training_exercise_alternatives USING btree (exercise_id);


--
-- Name: idx_training_days_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_days_plan ON public.training_days USING btree (plan_id);


--
-- Name: idx_training_exercises_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_exercises_day ON public.training_exercises USING btree (day_id);


--
-- Name: idx_training_plans_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_plans_client ON public.training_plans USING btree (client_id);


--
-- Name: idx_training_plans_coach_client; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_plans_coach_client ON public.training_plans USING btree (workspace_id, client_id);


--
-- Name: idx_training_sets_exercise; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_training_sets_exercise ON public.training_sets USING btree (exercise_id);


--
-- Name: idx_workspace_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_user ON public.workspace_members USING btree (user_id);


--
-- Name: idx_workspace_members_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_members_workspace ON public.workspace_members USING btree (workspace_id);


--
-- Name: idx_workspaces_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_archived ON public.workspaces USING btree (archived_at) WHERE (archived_at IS NULL);


--
-- Name: idx_workspaces_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_owner ON public.workspaces USING btree (owner_id);


--
-- Name: idx_workspaces_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspaces_slug ON public.workspaces USING btree (slug);


--
-- Name: client_measurements client_measurements_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_measurements
    ADD CONSTRAINT client_measurements_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: client_photos client_photos_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_photos
    ADD CONSTRAINT client_photos_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: clients fk_clients_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT fk_clients_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: exercise_equipments fk_exercise_equipments_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercise_equipments
    ADD CONSTRAINT fk_exercise_equipments_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: exercise_library fk_exercise_library_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercise_library
    ADD CONSTRAINT fk_exercise_library_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: exercise_muscle_groups fk_exercise_muscle_groups_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exercise_muscle_groups
    ADD CONSTRAINT fk_exercise_muscle_groups_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: food_categories fk_food_categories_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_categories
    ADD CONSTRAINT fk_food_categories_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: food_items fk_food_items_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.food_items
    ADD CONSTRAINT fk_food_items_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: form_requests fk_form_requests_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_requests
    ADD CONSTRAINT fk_form_requests_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: forms fk_forms_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms
    ADD CONSTRAINT fk_forms_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: nutrition_plans fk_nutrition_plans_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_plans
    ADD CONSTRAINT fk_nutrition_plans_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: packages fk_packages_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.packages
    ADD CONSTRAINT fk_packages_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: payment_methods fk_payment_methods_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT fk_payment_methods_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: training_plans fk_training_plans_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_plans
    ADD CONSTRAINT fk_training_plans_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: transactions fk_transactions_workspace; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_transactions_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspaces fk_workspaces_owner; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT fk_workspaces_owner FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE RESTRICT;




--
-- Name: form_questions form_questions_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_questions
    ADD CONSTRAINT form_questions_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.forms(id) ON DELETE CASCADE;


--
-- Name: form_requests form_requests_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_requests
    ADD CONSTRAINT form_requests_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: form_requests form_requests_form_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_requests
    ADD CONSTRAINT form_requests_form_id_fkey FOREIGN KEY (form_id) REFERENCES public.forms(id) ON DELETE CASCADE;


--
-- Name: form_responses form_responses_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_responses
    ADD CONSTRAINT form_responses_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.form_questions(id) ON DELETE CASCADE;


--
-- Name: form_responses form_responses_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_responses
    ADD CONSTRAINT form_responses_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.form_requests(id) ON DELETE CASCADE;


--
-- Name: nutrition_cycles nutrition_cycles_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_cycles
    ADD CONSTRAINT nutrition_cycles_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.nutrition_plans(id) ON DELETE CASCADE;


--
-- Name: nutrition_meal_item_alternatives nutrition_meal_item_alternatives_food_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_meal_item_alternatives
    ADD CONSTRAINT nutrition_meal_item_alternatives_food_item_id_fkey FOREIGN KEY (food_item_id) REFERENCES public.food_items(id) ON DELETE CASCADE;


--
-- Name: nutrition_meal_item_alternatives nutrition_meal_item_alternatives_meal_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_meal_item_alternatives
    ADD CONSTRAINT nutrition_meal_item_alternatives_meal_item_id_fkey FOREIGN KEY (meal_item_id) REFERENCES public.nutrition_meal_items(id) ON DELETE CASCADE;


--
-- Name: nutrition_meal_items nutrition_meal_items_food_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_meal_items
    ADD CONSTRAINT nutrition_meal_items_food_item_id_fkey FOREIGN KEY (food_item_id) REFERENCES public.food_items(id) ON DELETE CASCADE;


--
-- Name: nutrition_meal_items nutrition_meal_items_meal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_meal_items
    ADD CONSTRAINT nutrition_meal_items_meal_id_fkey FOREIGN KEY (meal_id) REFERENCES public.nutrition_meals(id) ON DELETE CASCADE;


--
-- Name: nutrition_meals nutrition_meals_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_meals
    ADD CONSTRAINT nutrition_meals_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.nutrition_cycles(id) ON DELETE CASCADE;


--
-- Name: nutrition_plans nutrition_plans_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nutrition_plans
    ADD CONSTRAINT nutrition_plans_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: package_variations package_variations_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.package_variations
    ADD CONSTRAINT package_variations_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.packages(id) ON DELETE CASCADE;


--
-- Name: pdf_settings pdf_settings_coach_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pdf_settings
    ADD CONSTRAINT pdf_settings_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subscription_freezes subscription_freezes_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_freezes
    ADD CONSTRAINT subscription_freezes_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: training_days training_days_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_days
    ADD CONSTRAINT training_days_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.training_plans(id) ON DELETE CASCADE;


--
-- Name: training_exercise_alternatives training_exercise_alternatives_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_exercise_alternatives
    ADD CONSTRAINT training_exercise_alternatives_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.training_exercises(id) ON DELETE CASCADE;


--
-- Name: training_exercise_alternatives training_exercise_alternatives_exercise_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_exercise_alternatives
    ADD CONSTRAINT training_exercise_alternatives_exercise_library_id_fkey FOREIGN KEY (exercise_library_id) REFERENCES public.exercise_library(id) ON DELETE CASCADE;


--
-- Name: training_exercises training_exercises_day_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_exercises
    ADD CONSTRAINT training_exercises_day_id_fkey FOREIGN KEY (day_id) REFERENCES public.training_days(id) ON DELETE CASCADE;


--
-- Name: training_exercises training_exercises_exercise_library_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_exercises
    ADD CONSTRAINT training_exercises_exercise_library_id_fkey FOREIGN KEY (exercise_library_id) REFERENCES public.exercise_library(id) ON DELETE SET NULL;


--
-- Name: training_sets training_sets_exercise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_sets
    ADD CONSTRAINT training_sets_exercise_id_fkey FOREIGN KEY (exercise_id) REFERENCES public.training_exercises(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: users users_default_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_default_workspace_id_fkey FOREIGN KEY (default_workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;


--
-- Name: workspace_audit_log workspace_audit_log_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_audit_log
    ADD CONSTRAINT workspace_audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspace_audit_log workspace_audit_log_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_audit_log
    ADD CONSTRAINT workspace_audit_log_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_invitations workspace_invitations_invited_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_invited_by_user_id_fkey FOREIGN KEY (invited_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspace_invitations workspace_invitations_invited_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_invited_user_id_fkey FOREIGN KEY (invited_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspace_invitations workspace_invitations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invitations
    ADD CONSTRAINT workspace_invitations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: workspace_members workspace_members_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- Name: workspace_subscriptions workspace_subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_subscriptions
    ADD CONSTRAINT workspace_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: workspace_subscriptions workspace_subscriptions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_subscriptions
    ADD CONSTRAINT workspace_subscriptions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict wac7p0gmTVjyjB0me7R6SAdiwByfNTZ0rMxN9hRwu8cfN3QS2tQPFr36xsvWMXT

