--
-- PostgreSQL database dump
--


-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: enrollment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.enrollment_status AS ENUM (
    'not_started',
    'in_progress',
    'completed',
    'expired',
    'failed'
);


--
-- Name: knowledge_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.knowledge_level AS ENUM (
    '1',
    '2',
    '3'
);


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'pending',
    'paid',
    'failed',
    'refunded',
    'cancelled'
);


--
-- Name: quiz_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.quiz_type AS ENUM (
    'qcm',
    'qcu',
    'true_false',
    'free_text',
    'matching'
);


--
-- Name: quote_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.quote_status AS ENUM (
    'received',
    'in_progress',
    'quote_sent',
    'accepted',
    'refused'
);


--
-- Name: recurrency_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.recurrency_status AS ENUM (
    'ok',
    'due_soon',
    'overdue',
    'not_started'
);


--
-- Name: session_format; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.session_format AS ENUM (
    'in_person',
    'virtual',
    'webinar'
);


--
-- Name: session_reg_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.session_reg_status AS ENUM (
    'registered',
    'attended',
    'cancelled'
);


--
-- Name: session_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.session_status AS ENUM (
    'scheduled',
    'full',
    'completed',
    'cancelled'
);


--
-- Name: subscription_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_type AS ENUM (
    'none',
    'standard',
    'all_inclusive'
);


--
-- Name: training_domain; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.training_domain AS ENUM (
    'b1',
    'b2',
    'b1b2',
    'part66',
    'general',
    'management'
);


--
-- Name: training_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.training_level AS ENUM (
    'beginner',
    'intermediate',
    'advanced'
);


--
-- Name: training_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.training_type AS ENUM (
    'elearning',
    'webinar',
    'qt',
    'seminar',
    'event'
);


--
-- Name: training_variant; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.training_variant AS ENUM (
    'initial',
    'recurrent'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'user',
    'admin',
    'instructor',
    'company_manager'
);


--
-- Name: user_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_status AS ENUM (
    'active',
    'suspended'
);


--
-- Name: webinar_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.webinar_status AS ENUM (
    'scheduled',
    'live',
    'completed',
    'cancelled'
);


--
-- Name: lock_enrollment_course(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_enrollment_course() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE archived timestamp;
BEGIN
 SELECT "archivedAt" INTO archived FROM trainings WHERE id = NEW."trainingId" FOR UPDATE;
 IF archived IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM training_licenses l JOIN orders o ON o.id = l."orderId" WHERE l.id = NEW."trainingLicenseId" AND l."assignedUserId" = NEW."userId" AND l."trainingId" = NEW."trainingId" AND l."revokedAt" IS NULL AND o.status = 'paid'
 ) AND NOT EXISTS (
  SELECT 1 FROM order_items i JOIN orders o ON o.id = i."orderId" WHERE o.id = NEW."orderId" AND o.status = 'paid' AND o."userId" = NEW."userId" AND i."trainingId" = NEW."trainingId" AND i."trainingVersionId" IS NOT NULL
 ) THEN RAISE EXCEPTION 'Archived course does not accept new enrollments'; END IF;
 RETURN NEW;
END; $$;


--
-- Name: pin_enrollment_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pin_enrollment_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE current_version integer;
BEGIN
 IF TG_OP = 'UPDATE' THEN
  IF ROW(NEW."trainingVersionId", NEW."trainingId", NEW."orderId", NEW."trainingLicenseId") IS DISTINCT FROM ROW(OLD."trainingVersionId", OLD."trainingId", OLD."orderId", OLD."trainingLicenseId") THEN RAISE EXCEPTION 'Enrolled curriculum and purchase cannot be changed'; END IF;
 ELSE
  SELECT "publishedVersionId" INTO current_version FROM trainings WHERE id = NEW."trainingId" FOR UPDATE;
  IF NEW."trainingLicenseId" IS NOT NULL THEN
   SELECT l."trainingVersionId" INTO current_version FROM training_licenses l JOIN orders o ON o.id = l."orderId"
    WHERE l.id = NEW."trainingLicenseId" AND l."orderId" = NEW."orderId" AND l."trainingId" = NEW."trainingId" AND l."assignedUserId" = NEW."userId" AND l."revokedAt" IS NULL AND o.status = 'paid';
   IF current_version IS NULL THEN RAISE EXCEPTION 'A paid assigned license is required'; END IF;
  ELSIF NEW."orderId" IS NOT NULL THEN
   SELECT i."trainingVersionId" INTO current_version FROM order_items i JOIN orders o ON o.id = i."orderId"
    WHERE o.id = NEW."orderId" AND o.status = 'paid' AND o."userId" = NEW."userId" AND i."trainingId" = NEW."trainingId" LIMIT 1;
   IF current_version IS NULL THEN RAISE EXCEPTION 'Paid purchase with a curriculum version required'; END IF;
  END IF;
  NEW."trainingVersionId" := current_version;
 END IF;
 RETURN NEW;
END; $$;


--
-- Name: preserve_approval_records(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preserve_approval_records() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'Approval evidence and events are append-only'; END;
$$;


--
-- Name: preserve_assignment_origin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preserve_assignment_origin() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF NEW."assignedOrgId" IS DISTINCT FROM OLD."assignedOrgId" OR NEW."assignedBy" IS DISTINCT FROM OLD."assignedBy" THEN RAISE EXCEPTION 'Assignment origin cannot be changed'; END IF;
 RETURN NEW;
END; $$;


--
-- Name: preserve_content_record(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preserve_content_record() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'Archive pedagogical records instead of deleting them'; END; $$;


--
-- Name: preserve_license_revocation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preserve_license_revocation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF OLD."revokedAt" IS NOT NULL AND NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt" THEN RAISE EXCEPTION 'License revocation is immutable'; END IF;
 RETURN NEW;
END; $$;


--
-- Name: preserve_passport_document(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preserve_passport_document() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Passport documents must be archived'; END IF;
 IF OLD."archivedAt" IS NOT NULL OR (to_jsonb(NEW) - 'archivedAt' - 'updatedAt') IS DISTINCT FROM (to_jsonb(OLD) - 'archivedAt' - 'updatedAt') THEN
   RAISE EXCEPTION 'Passport evidence is immutable';
 END IF;
 RETURN NEW;
END; $$;


--
-- Name: preserve_session_registration(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preserve_session_registration() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Session registrations must be retained'; END IF;
 IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') OR (OLD.status <> 'registered' AND NEW.status <> OLD.status) THEN
  RAISE EXCEPTION 'Registration identity and final status are immutable';
 END IF;
 RETURN NEW;
END; $$;


--
-- Name: preserve_subscription_checkout(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preserve_subscription_checkout() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF ROW(NEW.id, NEW."companyId", NEW."requestedBy", NEW.plan, NEW.quantity, NEW.payload, NEW."requestKey", NEW."retryUntil", NEW."createdAt") IS DISTINCT FROM
 ROW(OLD.id, OLD."companyId", OLD."requestedBy", OLD.plan, OLD.quantity, OLD.payload, OLD."requestKey", OLD."retryUntil", OLD."createdAt")
 OR (OLD."sessionId" IS NOT NULL AND NEW."sessionId" IS DISTINCT FROM OLD."sessionId")
 OR (OLD.status <> 'pending' AND NEW.status IS DISTINCT FROM OLD.status)
 THEN RAISE EXCEPTION 'Checkout origin and terminal state cannot be changed'; END IF;
 RETURN NEW;
END; $$;


--
-- Name: preserve_subscription_enrollment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preserve_subscription_enrollment() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF NEW."stripeSubscriptionId" IS DISTINCT FROM OLD."stripeSubscriptionId" OR
 (OLD."stripeSubscriptionId" IS NOT NULL AND (NEW."employeeId" IS DISTINCT FROM OLD."employeeId" OR NEW."userId" IS DISTINCT FROM OLD."userId" OR NEW."trainingId" IS DISTINCT FROM OLD."trainingId"))
 THEN RAISE EXCEPTION 'Subscription enrollment origin cannot be changed'; END IF;
 RETURN NEW;
END; $$;


--
-- Name: preserve_verification_events(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preserve_verification_events() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'Verification events are append-only'; END;
$$;


--
-- Name: protect_archived_content(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_archived_content() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE parent_id integer; archived timestamp;
BEGIN
 IF TG_OP = 'UPDATE' AND OLD."archivedAt" IS NOT NULL THEN RAISE EXCEPTION 'Archived content is locked'; END IF;
 IF TG_TABLE_NAME <> 'trainings' THEN
  parent_id := NEW."trainingId";
  SELECT "archivedAt" INTO archived FROM trainings WHERE id = parent_id FOR UPDATE;
  IF archived IS NOT NULL THEN RAISE EXCEPTION 'Archived course is locked'; END IF;
 END IF;
 RETURN NEW;
END; $$;


--
-- Name: protect_exam_chapter(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_exam_chapter() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF NEW."moduleId" IS DISTINCT FROM OLD."moduleId" THEN RAISE EXCEPTION 'Exam chapter cannot be changed'; END IF;
 RETURN NEW;
END;
$$;


--
-- Name: protect_exam_snapshot(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_exam_snapshot() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF OLD."questionSnapshot" IS NOT NULL AND (
   NEW."questionSnapshot" IS DISTINCT FROM OLD."questionSnapshot" OR
   NEW."passingScoreSnapshot" IS DISTINCT FROM OLD."passingScoreSnapshot" OR
   NEW."questionIds" IS DISTINCT FROM OLD."questionIds" OR
   NEW."userId" IS DISTINCT FROM OLD."userId" OR
   NEW."enrollmentId" IS DISTINCT FROM OLD."enrollmentId" OR
   NEW."trainingId" IS DISTINCT FROM OLD."trainingId"
 ) THEN RAISE EXCEPTION 'An exam snapshot cannot be changed'; END IF;
 RETURN NEW;
END;
$$;


--
-- Name: protect_license_origin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_license_origin() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF ROW(NEW."orderId",NEW."orderItemId",NEW."seatIndex",NEW."trainingId",NEW."trainingVersionId",NEW."ownerUserId",NEW."ownerOrgId") IS DISTINCT FROM ROW(OLD."orderId",OLD."orderItemId",OLD."seatIndex",OLD."trainingId",OLD."trainingVersionId",OLD."ownerUserId",OLD."ownerOrgId") THEN RAISE EXCEPTION 'License origin is immutable'; END IF;
 IF OLD."assignedUserId" IS NOT NULL AND ROW(NEW."assignedUserId",NEW."assignedBy",NEW."assignedAt") IS DISTINCT FROM ROW(OLD."assignedUserId",OLD."assignedBy",OLD."assignedAt") THEN RAISE EXCEPTION 'License assignment is immutable'; END IF;
 IF OLD."enrollmentId" IS NOT NULL AND NEW."enrollmentId" IS DISTINCT FROM OLD."enrollmentId" THEN RAISE EXCEPTION 'License enrollment is immutable'; END IF;
 RETURN NEW;
END; $$;


--
-- Name: reject_content_history_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_content_history_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'Content history is immutable'; END; $$;


--
-- Name: validate_active_content_links(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_active_content_links() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE link_id integer; parent_id integer; linked_parent integer; archived timestamp; row_data jsonb;
BEGIN
 row_data := to_jsonb(NEW);
 IF NEW."archivedAt" IS NOT NULL THEN RETURN NEW; END IF;
 parent_id := NEW."trainingId";
 PERFORM id FROM trainings WHERE id = parent_id FOR UPDATE;
 link_id := (row_data->>'moduleId')::integer;
 IF link_id IS NOT NULL THEN
  SELECT "trainingId", "archivedAt" INTO linked_parent, archived FROM training_modules WHERE id = link_id;
  IF linked_parent IS DISTINCT FROM parent_id OR archived IS NOT NULL THEN RAISE EXCEPTION 'Chapter is unavailable or belongs to another course'; END IF;
 END IF;
 link_id := (row_data->>'objectiveId')::integer;
 IF link_id IS NOT NULL THEN
  SELECT "trainingId", "archivedAt" INTO linked_parent, archived FROM learning_objectives WHERE id = link_id;
  IF linked_parent IS DISTINCT FROM parent_id OR archived IS NOT NULL THEN RAISE EXCEPTION 'Objective is unavailable or belongs to another course'; END IF;
 END IF;
 RETURN NEW;
END; $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: access_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.access_logs (
    id integer NOT NULL,
    "actorId" integer,
    "actorRole" character varying(32),
    "subjectPersonId" integer,
    action character varying(64) NOT NULL,
    "dataAccessed" jsonb,
    justification text,
    "targetOrgId" integer,
    ip character varying(64),
    at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: access_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.access_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: access_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.access_logs_id_seq OWNED BY public.access_logs.id;


--
-- Name: affiliations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.affiliations (
    id integer NOT NULL,
    "personId" integer NOT NULL,
    "orgId" integer NOT NULL,
    "employeeId" integer,
    "proEmail" character varying(320),
    role character varying(16) DEFAULT 'MEMBER'::character varying NOT NULL,
    status character varying(16) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "startedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "endedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: affiliations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.affiliations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: affiliations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.affiliations_id_seq OWNED BY public.affiliations.id;


--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    key character varying(64) NOT NULL,
    value text,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: approval_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_documents (
    id integer NOT NULL,
    kind character varying(24) NOT NULL,
    title character varying(255) NOT NULL,
    revision character varying(64) NOT NULL,
    "fileUrl" character varying(1024) NOT NULL,
    "fileName" character varying(255) NOT NULL,
    "uploadedBy" integer NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: approval_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.approval_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: approval_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.approval_documents_id_seq OWNED BY public.approval_documents.id;


--
-- Name: approval_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_events (
    id integer NOT NULL,
    "actorId" integer NOT NULL,
    action character varying(32) NOT NULL,
    "entityId" integer NOT NULL,
    previous jsonb,
    current jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: approval_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.approval_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: approval_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.approval_events_id_seq OWNED BY public.approval_events.id;


--
-- Name: approval_findings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_findings (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    reference character varying(128) NOT NULL,
    severity character varying(24) NOT NULL,
    description text NOT NULL,
    "ownerId" integer NOT NULL,
    "dueAt" timestamp without time zone NOT NULL,
    status character varying(24) DEFAULT 'open'::character varying NOT NULL,
    "rootCause" text,
    "correctiveAction" text,
    "evidenceId" integer,
    "closureNote" text,
    "closedBy" integer,
    "closedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: approval_findings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.approval_findings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: approval_findings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.approval_findings_id_seq OWNED BY public.approval_findings.id;


--
-- Name: articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.articles (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    excerpt text,
    content text,
    "coverImageUrl" character varying(1024),
    category character varying(64),
    author character varying(128),
    "isPublished" boolean DEFAULT false,
    "publishedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: articles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.articles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: articles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.articles_id_seq OWNED BY public.articles.id;


--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_items (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "trainingId" integer NOT NULL,
    quantity integer DEFAULT 1,
    "addedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: cart_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cart_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cart_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cart_items_id_seq OWNED BY public.cart_items.id;


--
-- Name: certificate_objectives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certificate_objectives (
    id integer NOT NULL,
    "certificateId" integer NOT NULL,
    "objectiveId" integer NOT NULL
);


--
-- Name: certificate_objectives_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.certificate_objectives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: certificate_objectives_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.certificate_objectives_id_seq OWNED BY public.certificate_objectives.id;


--
-- Name: certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.certificates (
    id integer NOT NULL,
    "enrollmentId" integer NOT NULL,
    "userId" integer NOT NULL,
    "trainingId" integer NOT NULL,
    "certificateNumber" character varying(64) NOT NULL,
    "verificationCode" character varying(32) NOT NULL,
    "pdfUrl" character varying(512),
    "issuedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "expiresAt" timestamp without time zone,
    "isValid" boolean DEFAULT true
);


--
-- Name: certificates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.certificates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: certificates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.certificates_id_seq OWNED BY public.certificates.id;


--
-- Name: checkout_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.checkout_attempts (
    "orderId" integer NOT NULL,
    fingerprint character varying(64) NOT NULL,
    "requestKey" character varying(128) NOT NULL,
    payload jsonb NOT NULL,
    "retryUntil" timestamp without time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    siret character varying(20),
    "vatNumber" character varying(32),
    address text,
    country character varying(64) DEFAULT 'FR'::character varying,
    type character varying(16),
    "agreementNumber" character varying(64),
    status character varying(16) DEFAULT 'ACTIVE'::character varying,
    "contactName" character varying(128),
    "contactEmail" character varying(320),
    "contactPhone" character varying(32),
    "subscriptionType" public.subscription_type DEFAULT 'none'::public.subscription_type,
    "subscriptionStatus" character varying(32),
    "subscriptionExpiresAt" timestamp without time zone,
    "stripeCustomerId" character varying(64),
    "stripeSubscriptionId" character varying(64),
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "subscriptionQuantity" integer,
    CONSTRAINT "companies_subscriptionQuantity_check" CHECK ((("subscriptionQuantity" IS NULL) OR ("subscriptionQuantity" > 0)))
);


--
-- Name: companies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.companies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: companies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.companies_id_seq OWNED BY public.companies.id;


--
-- Name: content_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_events (
    id integer NOT NULL,
    "trainingId" integer NOT NULL,
    "actorId" integer,
    "entityType" character varying(32) NOT NULL,
    "entityId" integer NOT NULL,
    action character varying(32) NOT NULL,
    "beforeState" jsonb,
    "afterState" jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: content_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.content_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: content_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.content_events_id_seq OWNED BY public.content_events.id;


--
-- Name: content_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_revisions (
    id integer NOT NULL,
    "trainingId" integer NOT NULL,
    version integer,
    changelog text,
    status character varying(24),
    "byUserId" integer,
    at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: content_revisions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.content_revisions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: content_revisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.content_revisions_id_seq OWNED BY public.content_revisions.id;


--
-- Name: course_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_media (
    id integer NOT NULL,
    "trainingId" integer NOT NULL,
    "createdBy" integer NOT NULL,
    "storageKey" character varying(1024) NOT NULL,
    "contentType" character varying(128) NOT NULL,
    "byteSize" integer NOT NULL,
    sha256 character varying(64) NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    origin character varying(16) DEFAULT 'generated'::character varying NOT NULL,
    CONSTRAINT "course_media_byteSize_check" CHECK ((("byteSize" > 0) AND ("byteSize" <= 52428800))),
    CONSTRAINT course_media_origin_check CHECK (((origin)::text = ANY ((ARRAY['generated'::character varying, 'uploaded'::character varying])::text[])))
);


--
-- Name: course_media_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.course_media_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: course_media_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.course_media_id_seq OWNED BY public.course_media.id;


--
-- Name: course_template_uses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_template_uses (
    "trainingId" integer NOT NULL,
    "templateId" integer NOT NULL,
    "createdBy" integer NOT NULL,
    snapshot jsonb NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: course_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_templates (
    id integer NOT NULL,
    code character varying(64),
    title character varying(255) NOT NULL,
    description text,
    language character varying(8) DEFAULT 'fr'::character varying,
    domain character varying(32),
    structure jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: course_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.course_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: course_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.course_templates_id_seq OWNED BY public.course_templates.id;


--
-- Name: credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credentials (
    id integer NOT NULL,
    "personId" integer NOT NULL,
    "moduleId" integer,
    "trainingId" integer,
    "certificateId" integer,
    "part66Coverage" jsonb,
    label character varying(255),
    provider character varying(255),
    "obtainedAt" timestamp without time zone,
    "expiresAt" timestamp without time zone,
    state character varying(16) DEFAULT 'LIVING'::character varying NOT NULL,
    controller character varying(16) DEFAULT 'PERSON'::character varying NOT NULL,
    origin character varying(16) DEFAULT 'INDEPENDENT'::character varying NOT NULL,
    "affiliationId" integer,
    "surfacedByPersonAt" timestamp without time zone,
    "lockedInOrgViewUntil" timestamp without time zone,
    "frozenSnapshot" jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: credentials_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.credentials_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: credentials_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.credentials_id_seq OWNED BY public.credentials.id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    "companyId" integer NOT NULL,
    "userId" integer,
    "firstName" character varying(128) NOT NULL,
    "lastName" character varying(128) NOT NULL,
    email character varying(320) NOT NULL,
    "jobTitle" character varying(128),
    "licenseNumber" character varying(64),
    "licenseCategories" character varying(128),
    "typeRatings" character varying(255),
    department character varying(128),
    base character varying(128),
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrollments (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "trainingId" integer NOT NULL,
    "orderId" integer,
    "employeeId" integer,
    status public.enrollment_status DEFAULT 'not_started'::public.enrollment_status NOT NULL,
    "progressPercent" integer DEFAULT 0,
    "startedAt" timestamp without time zone,
    "completedAt" timestamp without time zone,
    "expiresAt" timestamp without time zone,
    "lastAccessedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "trainingVersionId" integer,
    "assignedOrgId" integer,
    "assignedBy" integer,
    "trainingLicenseId" integer,
    "stripeSubscriptionId" character varying(255),
    CONSTRAINT subscription_enrollment_origin CHECK ((("stripeSubscriptionId" IS NULL) OR (("assignedOrgId" IS NOT NULL) AND ("employeeId" IS NOT NULL) AND ("orderId" IS NULL) AND ("trainingLicenseId" IS NULL))))
);


--
-- Name: enrollments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.enrollments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: enrollments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.enrollments_id_seq OWNED BY public.enrollments.id;


--
-- Name: exam_finalization_failures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exam_finalization_failures (
    id integer NOT NULL,
    "examSessionId" integer NOT NULL,
    "errorCode" character varying(64) NOT NULL,
    "retryAfter" timestamp without time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: exam_finalization_failures_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exam_finalization_failures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exam_finalization_failures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exam_finalization_failures_id_seq OWNED BY public.exam_finalization_failures.id;


--
-- Name: exam_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exam_sessions (
    id integer NOT NULL,
    "enrollmentId" integer NOT NULL,
    "userId" integer NOT NULL,
    "trainingId" integer NOT NULL,
    "attemptNumber" integer DEFAULT 1,
    "questionIds" jsonb,
    "startedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "expiresAt" timestamp without time zone,
    "submittedAt" timestamp without time zone,
    status character varying(16) DEFAULT 'active'::character varying,
    "questionSnapshot" jsonb,
    "passingScoreSnapshot" integer,
    "savedAnswers" jsonb,
    "answerRevision" integer DEFAULT 0 NOT NULL,
    "answersSavedAt" timestamp without time zone,
    "moduleId" integer
);


--
-- Name: exam_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.exam_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: exam_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.exam_sessions_id_seq OWNED BY public.exam_sessions.id;


--
-- Name: external_trainings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_trainings (
    id integer NOT NULL,
    "employeeId" integer,
    "userId" integer,
    "companyId" integer,
    title character varying(255) NOT NULL,
    provider character varying(255),
    category character varying(128),
    "completedAt" timestamp without time zone,
    "expiresAt" timestamp without time zone,
    "certNumber" character varying(128),
    "docUrl" character varying(1024),
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: external_trainings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.external_trainings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: external_trainings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.external_trainings_id_seq OWNED BY public.external_trainings.id;


--
-- Name: faq_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faq_items (
    id integer NOT NULL,
    language character varying(8) DEFAULT 'fr'::character varying NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    "sortOrder" integer DEFAULT 0,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: faq_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.faq_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: faq_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.faq_items_id_seq OWNED BY public.faq_items.id;


--
-- Name: learning_objectives; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_objectives (
    id integer NOT NULL,
    "trainingId" integer NOT NULL,
    "moduleId" integer,
    code character varying(32),
    title character varying(255) NOT NULL,
    description text,
    "knowledgeLevel" public.knowledge_level DEFAULT '1'::public.knowledge_level,
    "isRequired" boolean DEFAULT true,
    "sortOrder" integer DEFAULT 0,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "archivedAt" timestamp without time zone
);


--
-- Name: learning_objectives_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.learning_objectives_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: learning_objectives_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.learning_objectives_id_seq OWNED BY public.learning_objectives.id;


--
-- Name: legacy_course_media_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legacy_course_media_links (
    "storageKey" character varying(1024) NOT NULL,
    "trainingId" integer NOT NULL,
    "capturedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: live_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_messages (
    id integer NOT NULL,
    "roomType" character varying(16) NOT NULL,
    "roomId" integer NOT NULL,
    "userId" integer NOT NULL,
    kind character varying(8) DEFAULT 'chat'::character varying NOT NULL,
    content text NOT NULL,
    "isAnswered" boolean DEFAULT false,
    "answeredByUserId" integer,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: live_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.live_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: live_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.live_messages_id_seq OWNED BY public.live_messages.id;


--
-- Name: live_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_participants (
    id integer NOT NULL,
    "roomType" character varying(16) NOT NULL,
    "roomId" integer NOT NULL,
    "userId" integer NOT NULL,
    "joinedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "lastSeenAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: live_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.live_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: live_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.live_participants_id_seq OWNED BY public.live_participants.id;


--
-- Name: live_poll_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_poll_votes (
    id integer NOT NULL,
    "pollId" integer NOT NULL,
    "userId" integer NOT NULL,
    choices jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: live_poll_votes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.live_poll_votes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: live_poll_votes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.live_poll_votes_id_seq OWNED BY public.live_poll_votes.id;


--
-- Name: live_polls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_polls (
    id integer NOT NULL,
    "roomType" character varying(16) NOT NULL,
    "roomId" integer NOT NULL,
    kind character varying(8) DEFAULT 'poll'::character varying NOT NULL,
    question text NOT NULL,
    options jsonb,
    correct jsonb,
    "isOpen" boolean DEFAULT true,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: live_polls_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.live_polls_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: live_polls_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.live_polls_id_seq OWNED BY public.live_polls.id;


--
-- Name: live_presence_intervals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_presence_intervals (
    id integer NOT NULL,
    "roomType" character varying(16) NOT NULL,
    "roomId" integer NOT NULL,
    "userId" integer NOT NULL,
    "startedAt" timestamp without time zone NOT NULL,
    "endedAt" timestamp without time zone NOT NULL,
    "creditedMilliseconds" integer NOT NULL,
    CONSTRAINT live_presence_intervals_check CHECK (("endedAt" > "startedAt")),
    CONSTRAINT "live_presence_intervals_creditedMilliseconds_check" CHECK ((("creditedMilliseconds" >= 0) AND ("creditedMilliseconds" <= 45000)))
);


--
-- Name: live_presence_intervals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.live_presence_intervals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: live_presence_intervals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.live_presence_intervals_id_seq OWNED BY public.live_presence_intervals.id;


--
-- Name: live_video_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_video_tickets (
    id character varying(64) NOT NULL,
    "userId" integer NOT NULL,
    "roomType" character varying(16) NOT NULL,
    "roomId" integer NOT NULL,
    moderator boolean NOT NULL,
    "expiresAt" timestamp without time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "live_video_tickets_roomType_check" CHECK ((("roomType")::text = ANY ((ARRAY['session'::character varying, 'webinar'::character varying])::text[])))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id integer NOT NULL,
    "quoteRequestId" integer,
    "ticketId" integer,
    "fromUserId" integer NOT NULL,
    "toUserId" integer,
    subject character varying(255),
    content text NOT NULL,
    "isRead" boolean DEFAULT false,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: module_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.module_progress (
    id integer NOT NULL,
    "enrollmentId" integer NOT NULL,
    "moduleId" integer NOT NULL,
    "isCompleted" boolean DEFAULT false,
    "timeSpentMinutes" integer DEFAULT 0,
    "completedAt" timestamp without time zone
);


--
-- Name: module_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.module_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: module_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.module_progress_id_seq OWNED BY public.module_progress.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    type character varying(48) NOT NULL,
    title character varying(255) NOT NULL,
    body text,
    link character varying(512),
    "isRead" boolean DEFAULT false,
    "dedupeKey" character varying(128),
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: objective_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.objective_progress (
    id integer NOT NULL,
    "enrollmentId" integer NOT NULL,
    "objectiveId" integer NOT NULL,
    "isCompleted" boolean DEFAULT false,
    "completedAt" timestamp without time zone
);


--
-- Name: objective_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.objective_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: objective_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.objective_progress_id_seq OWNED BY public.objective_progress.id;


--
-- Name: offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offers (
    id integer NOT NULL,
    language character varying(8) DEFAULT 'fr'::character varying NOT NULL,
    name character varying(128) NOT NULL,
    price character varying(128),
    description text,
    features jsonb DEFAULT '[]'::jsonb,
    "ctaLabel" character varying(128),
    "ctaHref" character varying(255) DEFAULT '/devis'::character varying,
    highlight boolean DEFAULT false,
    "sortOrder" integer DEFAULT 0,
    "isActive" boolean DEFAULT true,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: offers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.offers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: offers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.offers_id_seq OWNED BY public.offers.id;


--
-- Name: operator_approval; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operator_approval (
    id integer NOT NULL,
    "legalName" character varying(255) NOT NULL,
    authority character varying(255) NOT NULL,
    reference character varying(128),
    status character varying(24) DEFAULT 'preparation'::character varying NOT NULL,
    scope text NOT NULL,
    locations text NOT NULL,
    "accountableManagerId" integer NOT NULL,
    "trainingManagerId" integer NOT NULL,
    "qualityManagerId" integer NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "approvalDocumentId" integer,
    "mtoeDocumentId" integer,
    CONSTRAINT operator_responsibilities_independent CHECK (("trainingManagerId" <> "qualityManagerId"))
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    "orderId" integer NOT NULL,
    "trainingId" integer NOT NULL,
    quantity integer DEFAULT 1,
    "unitPriceHt" numeric(10,2) NOT NULL,
    "unitPriceTtc" numeric(10,2) NOT NULL,
    "trainingVersionId" integer
);


--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    "companyId" integer,
    "quoteRequestId" integer,
    status public.order_status DEFAULT 'pending'::public.order_status NOT NULL,
    "totalHt" numeric(10,2) NOT NULL,
    "totalTtc" numeric(10,2) NOT NULL,
    "vatAmount" numeric(10,2),
    "vatRate" numeric(5,2) DEFAULT 20.00,
    "stripePaymentIntentId" character varying(128),
    "stripeSessionId" character varying(128),
    "invoiceNumber" character varying(32),
    "invoiceUrl" character varying(512),
    notes text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "fulfilledAt" timestamp without time zone,
    "refundedAmountCents" integer DEFAULT 0 NOT NULL
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: passport_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.passport_documents (
    id integer NOT NULL,
    "personId" integer NOT NULL,
    kind character varying(32) NOT NULL,
    title character varying(255) NOT NULL,
    issuer character varying(255),
    reference character varying(128),
    country character varying(64),
    "issuedAt" timestamp without time zone,
    "expiresAt" timestamp without time zone,
    "fileUrl" character varying(1024) NOT NULL,
    "fileName" character varying(255),
    "contentType" character varying(128),
    "fileSize" integer,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "archivedAt" timestamp without time zone,
    sha256 character varying(64)
);


--
-- Name: passport_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.passport_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: passport_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.passport_documents_id_seq OWNED BY public.passport_documents.id;


--
-- Name: passport_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.passport_events (
    id integer NOT NULL,
    "personId" integer NOT NULL,
    "documentId" integer,
    "actorId" integer NOT NULL,
    action character varying(32) NOT NULL,
    data jsonb NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: passport_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.passport_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: passport_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.passport_events_id_seq OWNED BY public.passport_events.id;


--
-- Name: payment_reconciliations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_reconciliations (
    id integer NOT NULL,
    "orderId" integer NOT NULL,
    "actorId" integer NOT NULL,
    "sessionId" character varying(255) NOT NULL,
    "sessionStatus" character varying(32) NOT NULL,
    "paymentStatus" character varying(32) NOT NULL,
    "amountCents" integer NOT NULL,
    currency character varying(8) NOT NULL,
    "previousOrderStatus" character varying(32) NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_reconciliations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_reconciliations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_reconciliations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_reconciliations_id_seq OWNED BY public.payment_reconciliations.id;


--
-- Name: pedagogical_decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedagogical_decisions (
    id integer NOT NULL,
    "reviewId" integer NOT NULL,
    "reviewedBy" integer NOT NULL,
    decision character varying(16) NOT NULL,
    note text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT pedagogical_decisions_decision_check CHECK (((decision)::text = ANY ((ARRAY['approved'::character varying, 'rejected'::character varying])::text[])))
);


--
-- Name: pedagogical_decisions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pedagogical_decisions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pedagogical_decisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pedagogical_decisions_id_seq OWNED BY public.pedagogical_decisions.id;


--
-- Name: pedagogical_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedagogical_reviews (
    id integer NOT NULL,
    "trainingId" integer NOT NULL,
    "requestedBy" integer NOT NULL,
    fingerprint character varying(64) NOT NULL,
    snapshot jsonb NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: pedagogical_reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pedagogical_reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pedagogical_reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pedagogical_reviews_id_seq OWNED BY public.pedagogical_reviews.id;


--
-- Name: pedagogical_withdrawals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedagogical_withdrawals (
    id integer NOT NULL,
    "reviewId" integer NOT NULL,
    "withdrawnBy" integer NOT NULL,
    reason text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: pedagogical_withdrawals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pedagogical_withdrawals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pedagogical_withdrawals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pedagogical_withdrawals_id_seq OWNED BY public.pedagogical_withdrawals.id;


--
-- Name: processed_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processed_webhook_events (
    "eventId" character varying(128) NOT NULL,
    "processedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: proctoring_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proctoring_events (
    id integer NOT NULL,
    "sessionId" integer NOT NULL,
    type character varying(32) NOT NULL,
    detail text,
    at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: proctoring_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.proctoring_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: proctoring_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.proctoring_events_id_seq OWNED BY public.proctoring_events.id;


--
-- Name: quiz_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_attempts (
    id integer NOT NULL,
    "enrollmentId" integer NOT NULL,
    "userId" integer NOT NULL,
    "trainingId" integer NOT NULL,
    score integer,
    "maxScore" integer,
    "isPassed" boolean DEFAULT false,
    answers jsonb,
    "startedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "completedAt" timestamp without time zone,
    "attemptNumber" integer DEFAULT 1,
    "moduleId" integer
);


--
-- Name: quiz_attempts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.quiz_attempts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quiz_attempts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.quiz_attempts_id_seq OWNED BY public.quiz_attempts.id;


--
-- Name: quiz_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quiz_questions (
    id integer NOT NULL,
    "trainingId" integer NOT NULL,
    "moduleId" integer,
    "objectiveId" integer,
    question text NOT NULL,
    type public.quiz_type DEFAULT 'qcu'::public.quiz_type NOT NULL,
    options jsonb,
    "correctAnswer" jsonb,
    "optionsRight" jsonb,
    "answerKey" jsonb,
    explanation text,
    points integer DEFAULT 1,
    difficulty character varying(16),
    "sortOrder" integer DEFAULT 0,
    "archivedAt" timestamp without time zone
);


--
-- Name: quiz_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.quiz_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quiz_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.quiz_questions_id_seq OWNED BY public.quiz_questions.id;


--
-- Name: quote_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quote_requests (
    id integer NOT NULL,
    "companyName" character varying(255) NOT NULL,
    siret character varying(20),
    "contactName" character varying(128) NOT NULL,
    "contactEmail" character varying(320) NOT NULL,
    "contactPhone" character varying(32),
    "employeeCount" integer,
    "trainingTypes" character varying(512),
    message text,
    "attachmentUrl" character varying(512),
    status public.quote_status DEFAULT 'received'::public.quote_status NOT NULL,
    "userId" integer,
    "companyId" integer,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: quote_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.quote_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quote_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.quote_requests_id_seq OWNED BY public.quote_requests.id;


--
-- Name: raero_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raero_migrations (
    name text NOT NULL,
    checksum text NOT NULL,
    applied_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: recurrencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurrencies (
    id integer NOT NULL,
    "employeeId" integer NOT NULL,
    "trainingId" integer NOT NULL,
    "companyId" integer NOT NULL,
    "periodMonths" integer NOT NULL,
    "lastCompletedAt" timestamp without time zone,
    "nextDueAt" timestamp without time zone,
    status public.recurrency_status DEFAULT 'not_started'::public.recurrency_status,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: recurrencies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recurrencies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recurrencies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recurrencies_id_seq OWNED BY public.recurrencies.id;


--
-- Name: refund_observations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refund_observations (
    "eventId" character varying(128) NOT NULL,
    "paymentIntentId" character varying(128) NOT NULL,
    "chargeId" character varying(128) NOT NULL,
    "amountCents" integer NOT NULL,
    "refundedCents" integer NOT NULL,
    currency character varying(8) NOT NULL,
    "fullyRefunded" boolean NOT NULL,
    "eventCreated" integer NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: regulatory_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regulatory_changes (
    id integer NOT NULL,
    reference character varying(128),
    summary text,
    "effectiveAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: regulatory_changes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.regulatory_changes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: regulatory_changes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.regulatory_changes_id_seq OWNED BY public.regulatory_changes.id;


--
-- Name: role_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_requirements (
    id integer NOT NULL,
    "companyId" integer,
    label character varying(255),
    "jobTitleContains" character varying(128),
    "licenseCategoryContains" character varying(64),
    "trainingId" integer NOT NULL,
    "periodMonths" integer NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: role_requirements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.role_requirements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: role_requirements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.role_requirements_id_seq OWNED BY public.role_requirements.id;


--
-- Name: session_admission_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_admission_events (
    id integer NOT NULL,
    "sessionId" integer NOT NULL,
    "registrationId" integer NOT NULL,
    "userId" integer NOT NULL,
    action character varying(32) NOT NULL,
    "previousStatus" character varying(32),
    "nextStatus" character varying(32) NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: session_admission_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.session_admission_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: session_admission_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.session_admission_events_id_seq OWNED BY public.session_admission_events.id;


--
-- Name: session_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_registrations (
    id integer NOT NULL,
    "sessionId" integer NOT NULL,
    "userId" integer NOT NULL,
    status public.session_reg_status DEFAULT 'registered'::public.session_reg_status NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: session_registrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.session_registrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: session_registrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.session_registrations_id_seq OWNED BY public.session_registrations.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id integer NOT NULL,
    "trainingId" integer,
    title character varying(255) NOT NULL,
    description text,
    format public.session_format DEFAULT 'in_person'::public.session_format NOT NULL,
    location character varying(255),
    "instructorName" character varying(128),
    "startDate" timestamp without time zone NOT NULL,
    "endDate" timestamp without time zone,
    "durationDays" numeric(4,1),
    seats integer DEFAULT 12,
    "seatsTaken" integer DEFAULT 0,
    "priceHt" numeric(10,2),
    language character varying(8) DEFAULT 'fr'::character varying,
    "cpfEligible" boolean DEFAULT false,
    "meetingUrl" character varying(512),
    "replayUrl" character varying(512),
    "liveRoom" character varying(128),
    status public.session_status DEFAULT 'scheduled'::public.session_status NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sessions_id_seq OWNED BY public.sessions.id;


--
-- Name: signoffs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.signoffs (
    id integer NOT NULL,
    "managerPersonId" integer NOT NULL,
    "subjectPersonId" integer NOT NULL,
    "orgId" integer NOT NULL,
    "affiliationId" integer,
    "credentialId" integer,
    "trainingId" integer,
    scope character varying(64),
    decision character varying(16) DEFAULT 'VALIDATED'::character varying NOT NULL,
    note text,
    "signedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: signoffs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.signoffs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: signoffs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.signoffs_id_seq OWNED BY public.signoffs.id;


--
-- Name: slides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slides (
    id integer NOT NULL,
    "trainingId" integer NOT NULL,
    "moduleId" integer,
    "objectiveId" integer,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    title character varying(255),
    body text,
    "imageUrl" character varying(1024),
    "imagePrompt" text,
    "videoUrl" character varying(1024),
    "audioUrl" character varying(1024),
    "videoCues" jsonb,
    "quizQuestion" text,
    "quizOptions" jsonb,
    "quizCorrect" jsonb,
    "quizExplanation" text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "archivedAt" timestamp without time zone
);


--
-- Name: slides_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.slides_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: slides_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.slides_id_seq OWNED BY public.slides.id;


--
-- Name: subscription_checkout_closures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_checkout_closures (
    "attemptId" character varying(64) NOT NULL,
    "requestedBy" integer NOT NULL,
    "observedStatus" character varying(16) NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "subscription_checkout_closures_observedStatus_check" CHECK ((("observedStatus")::text = ANY ((ARRAY['expired'::character varying, 'complete'::character varying])::text[])))
);


--
-- Name: subscription_checkouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_checkouts (
    id character varying(64) NOT NULL,
    "companyId" integer NOT NULL,
    "requestedBy" integer,
    plan character varying(32) NOT NULL,
    quantity integer NOT NULL,
    payload jsonb NOT NULL,
    "requestKey" character varying(128) NOT NULL,
    "retryUntil" timestamp without time zone NOT NULL,
    "sessionId" character varying(255),
    status character varying(16) DEFAULT 'pending'::character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscription_checkouts_plan_check CHECK (((plan)::text = ANY ((ARRAY['standard'::character varying, 'all_inclusive'::character varying])::text[]))),
    CONSTRAINT subscription_checkouts_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT subscription_checkouts_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'complete'::character varying, 'expired'::character varying])::text[])))
);


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    subject character varying(255) NOT NULL,
    status character varying(16) DEFAULT 'OPEN'::character varying NOT NULL,
    priority character varying(16),
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: support_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.support_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: support_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.support_tickets_id_seq OWNED BY public.support_tickets.id;


--
-- Name: training_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_categories (
    id integer NOT NULL,
    name character varying(128) NOT NULL,
    slug character varying(128) NOT NULL,
    description text,
    icon character varying(64),
    "sortOrder" integer DEFAULT 0
);


--
-- Name: training_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.training_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: training_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.training_categories_id_seq OWNED BY public.training_categories.id;


--
-- Name: training_licenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_licenses (
    id integer NOT NULL,
    "orderId" integer NOT NULL,
    "orderItemId" integer NOT NULL,
    "seatIndex" integer NOT NULL,
    "trainingId" integer NOT NULL,
    "trainingVersionId" integer NOT NULL,
    "ownerUserId" integer NOT NULL,
    "ownerOrgId" integer,
    "assignedUserId" integer,
    "assignedBy" integer,
    "enrollmentId" integer,
    "assignedAt" timestamp without time zone,
    "revokedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: training_licenses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.training_licenses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: training_licenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.training_licenses_id_seq OWNED BY public.training_licenses.id;


--
-- Name: training_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_modules (
    id integer NOT NULL,
    "trainingId" integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    content text,
    "videoUrl" character varying(512),
    "pdfUrl" character varying(512),
    "durationMinutes" integer,
    "sortOrder" integer DEFAULT 0,
    "isRequired" boolean DEFAULT true,
    "objectiveId" integer,
    "quizPassingScore" integer DEFAULT 75 NOT NULL,
    "quizMaxAttempts" integer DEFAULT 3 NOT NULL,
    "quizTimeLimitMin" integer,
    "archivedAt" timestamp without time zone
);


--
-- Name: training_modules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.training_modules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: training_modules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.training_modules_id_seq OWNED BY public.training_modules.id;


--
-- Name: training_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.training_versions (
    id integer NOT NULL,
    "trainingId" integer NOT NULL,
    version integer NOT NULL,
    snapshot jsonb NOT NULL,
    "publishedBy" integer,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "reviewId" integer
);


--
-- Name: training_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.training_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: training_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.training_versions_id_seq OWNED BY public.training_versions.id;


--
-- Name: trainings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trainings (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    description text,
    objectives text,
    prerequisites text,
    "targetAudience" character varying(255),
    "categoryId" integer,
    type public.training_type DEFAULT 'elearning'::public.training_type NOT NULL,
    domain public.training_domain DEFAULT 'general'::public.training_domain,
    language character varying(8) DEFAULT 'fr'::character varying,
    "durationHours" numeric(5,2),
    level public.training_level DEFAULT 'intermediate'::public.training_level,
    "priceHt" numeric(10,2),
    "priceTtc" numeric(10,2),
    "priceEnterprise" numeric(10,2),
    "part147Reference" character varying(128),
    "isPublished" boolean DEFAULT false,
    "isFeatured" boolean DEFAULT false,
    "thumbnailUrl" character varying(512),
    "recurrencyMonths" integer,
    "translationGroupId" character varying(64),
    variant public.training_variant,
    "passingScore" integer DEFAULT 75,
    "maxAttempts" integer DEFAULT 3,
    "examQuestionCount" integer,
    "randomizeQuestions" boolean DEFAULT false,
    "examTimeLimitMin" integer,
    "reviewStatus" character varying(24) DEFAULT 'draft'::character varying,
    version integer DEFAULT 1,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "ownerUserId" integer,
    "ownerOrgId" integer,
    "archivedAt" timestamp without time zone,
    "publishedVersionId" integer
);


--
-- Name: trainings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.trainings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: trainings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.trainings_id_seq OWNED BY public.trainings.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    "openId" character varying(64) NOT NULL,
    name text,
    "firstName" character varying(128),
    "lastName" character varying(128),
    bio text,
    "passportShared" boolean DEFAULT false,
    "resetToken" character varying(64),
    "resetTokenExpiresAt" timestamp without time zone,
    "twoFactorEnabled" boolean DEFAULT false,
    "twoFactorCode" character varying(12),
    "twoFactorExpiresAt" timestamp without time zone,
    email character varying(320),
    "passwordHash" character varying(255),
    "loginMethod" character varying(64),
    "loginEmailIsPersonal" boolean DEFAULT true,
    role public.user_role DEFAULT 'user'::public.user_role NOT NULL,
    status public.user_status DEFAULT 'active'::public.user_status NOT NULL,
    "licenseNumber" character varying(64),
    "licenseCategories" character varying(128),
    "typeRatings" character varying(255),
    "jobTitle" character varying(128),
    "preferredLanguage" character varying(8) DEFAULT 'fr'::character varying,
    timezone character varying(64) DEFAULT 'Europe/Paris'::character varying,
    "marketingOptIn" boolean DEFAULT false,
    "dataProcessingConsentAt" timestamp without time zone,
    "consentUpdatedAt" timestamp without time zone,
    "companyId" integer,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "lastSignedIn" timestamp without time zone DEFAULT now() NOT NULL
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
-- Name: verification_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_cases (
    id integer NOT NULL,
    "subjectKey" character varying(80) NOT NULL,
    kind character varying(8) NOT NULL,
    "personId" integer NOT NULL,
    "companyId" integer,
    status character varying(24) DEFAULT 'draft'::character varying NOT NULL,
    "legalName" character varying(255) NOT NULL,
    country character varying(2) NOT NULL,
    "registrationNumber" character varying(128),
    address text NOT NULL,
    "reviewNote" text,
    "reviewedBy" integer,
    "submittedAt" timestamp without time zone,
    "reviewedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: verification_cases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.verification_cases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: verification_cases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.verification_cases_id_seq OWNED BY public.verification_cases.id;


--
-- Name: verification_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_documents (
    id integer NOT NULL,
    "caseId" integer NOT NULL,
    kind character varying(32) NOT NULL,
    "fileUrl" character varying(1024) NOT NULL,
    "fileName" character varying(255) NOT NULL,
    "contentType" character varying(128) NOT NULL,
    "uploadedBy" integer NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "archivedAt" timestamp without time zone
);


--
-- Name: verification_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.verification_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: verification_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.verification_documents_id_seq OWNED BY public.verification_documents.id;


--
-- Name: verification_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_events (
    id integer NOT NULL,
    "caseId" integer NOT NULL,
    "actorId" integer NOT NULL,
    action character varying(32) NOT NULL,
    previous jsonb,
    current jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: verification_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.verification_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: verification_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.verification_events_id_seq OWNED BY public.verification_events.id;


--
-- Name: webinar_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webinar_registrations (
    id integer NOT NULL,
    "webinarId" integer NOT NULL,
    "userId" integer NOT NULL,
    "registeredAt" timestamp without time zone DEFAULT now() NOT NULL,
    attended boolean DEFAULT false
);


--
-- Name: webinar_registrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.webinar_registrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: webinar_registrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.webinar_registrations_id_seq OWNED BY public.webinar_registrations.id;


--
-- Name: webinars; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webinars (
    id integer NOT NULL,
    "trainingId" integer,
    title character varying(255) NOT NULL,
    description text,
    "instructorName" character varying(128),
    "scheduledAt" timestamp without time zone NOT NULL,
    "durationMinutes" integer,
    "maxParticipants" integer,
    "meetingUrl" character varying(512),
    "replayUrl" character varying(512),
    "liveRoom" character varying(128),
    status public.webinar_status DEFAULT 'scheduled'::public.webinar_status,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: webinars_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.webinars_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: webinars_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.webinars_id_seq OWNED BY public.webinars.id;


--
-- Name: access_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_logs ALTER COLUMN id SET DEFAULT nextval('public.access_logs_id_seq'::regclass);


--
-- Name: affiliations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliations ALTER COLUMN id SET DEFAULT nextval('public.affiliations_id_seq'::regclass);


--
-- Name: approval_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_documents ALTER COLUMN id SET DEFAULT nextval('public.approval_documents_id_seq'::regclass);


--
-- Name: approval_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_events ALTER COLUMN id SET DEFAULT nextval('public.approval_events_id_seq'::regclass);


--
-- Name: approval_findings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_findings ALTER COLUMN id SET DEFAULT nextval('public.approval_findings_id_seq'::regclass);


--
-- Name: articles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles ALTER COLUMN id SET DEFAULT nextval('public.articles_id_seq'::regclass);


--
-- Name: cart_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items ALTER COLUMN id SET DEFAULT nextval('public.cart_items_id_seq'::regclass);


--
-- Name: certificate_objectives id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_objectives ALTER COLUMN id SET DEFAULT nextval('public.certificate_objectives_id_seq'::regclass);


--
-- Name: certificates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates ALTER COLUMN id SET DEFAULT nextval('public.certificates_id_seq'::regclass);


--
-- Name: companies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies ALTER COLUMN id SET DEFAULT nextval('public.companies_id_seq'::regclass);


--
-- Name: content_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_events ALTER COLUMN id SET DEFAULT nextval('public.content_events_id_seq'::regclass);


--
-- Name: content_revisions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_revisions ALTER COLUMN id SET DEFAULT nextval('public.content_revisions_id_seq'::regclass);


--
-- Name: course_media id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_media ALTER COLUMN id SET DEFAULT nextval('public.course_media_id_seq'::regclass);


--
-- Name: course_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_templates ALTER COLUMN id SET DEFAULT nextval('public.course_templates_id_seq'::regclass);


--
-- Name: credentials id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials ALTER COLUMN id SET DEFAULT nextval('public.credentials_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: enrollments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments ALTER COLUMN id SET DEFAULT nextval('public.enrollments_id_seq'::regclass);


--
-- Name: exam_finalization_failures id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_finalization_failures ALTER COLUMN id SET DEFAULT nextval('public.exam_finalization_failures_id_seq'::regclass);


--
-- Name: exam_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_sessions ALTER COLUMN id SET DEFAULT nextval('public.exam_sessions_id_seq'::regclass);


--
-- Name: external_trainings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_trainings ALTER COLUMN id SET DEFAULT nextval('public.external_trainings_id_seq'::regclass);


--
-- Name: faq_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faq_items ALTER COLUMN id SET DEFAULT nextval('public.faq_items_id_seq'::regclass);


--
-- Name: learning_objectives id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_objectives ALTER COLUMN id SET DEFAULT nextval('public.learning_objectives_id_seq'::regclass);


--
-- Name: live_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_messages ALTER COLUMN id SET DEFAULT nextval('public.live_messages_id_seq'::regclass);


--
-- Name: live_participants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_participants ALTER COLUMN id SET DEFAULT nextval('public.live_participants_id_seq'::regclass);


--
-- Name: live_poll_votes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_poll_votes ALTER COLUMN id SET DEFAULT nextval('public.live_poll_votes_id_seq'::regclass);


--
-- Name: live_polls id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_polls ALTER COLUMN id SET DEFAULT nextval('public.live_polls_id_seq'::regclass);


--
-- Name: live_presence_intervals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_presence_intervals ALTER COLUMN id SET DEFAULT nextval('public.live_presence_intervals_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: module_progress id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_progress ALTER COLUMN id SET DEFAULT nextval('public.module_progress_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: objective_progress id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objective_progress ALTER COLUMN id SET DEFAULT nextval('public.objective_progress_id_seq'::regclass);


--
-- Name: offers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers ALTER COLUMN id SET DEFAULT nextval('public.offers_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: passport_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passport_documents ALTER COLUMN id SET DEFAULT nextval('public.passport_documents_id_seq'::regclass);


--
-- Name: passport_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passport_events ALTER COLUMN id SET DEFAULT nextval('public.passport_events_id_seq'::regclass);


--
-- Name: payment_reconciliations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_reconciliations ALTER COLUMN id SET DEFAULT nextval('public.payment_reconciliations_id_seq'::regclass);


--
-- Name: pedagogical_decisions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedagogical_decisions ALTER COLUMN id SET DEFAULT nextval('public.pedagogical_decisions_id_seq'::regclass);


--
-- Name: pedagogical_reviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedagogical_reviews ALTER COLUMN id SET DEFAULT nextval('public.pedagogical_reviews_id_seq'::regclass);


--
-- Name: pedagogical_withdrawals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedagogical_withdrawals ALTER COLUMN id SET DEFAULT nextval('public.pedagogical_withdrawals_id_seq'::regclass);


--
-- Name: proctoring_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proctoring_events ALTER COLUMN id SET DEFAULT nextval('public.proctoring_events_id_seq'::regclass);


--
-- Name: quiz_attempts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_attempts ALTER COLUMN id SET DEFAULT nextval('public.quiz_attempts_id_seq'::regclass);


--
-- Name: quiz_questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_questions ALTER COLUMN id SET DEFAULT nextval('public.quiz_questions_id_seq'::regclass);


--
-- Name: quote_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_requests ALTER COLUMN id SET DEFAULT nextval('public.quote_requests_id_seq'::regclass);


--
-- Name: recurrencies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurrencies ALTER COLUMN id SET DEFAULT nextval('public.recurrencies_id_seq'::regclass);


--
-- Name: regulatory_changes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_changes ALTER COLUMN id SET DEFAULT nextval('public.regulatory_changes_id_seq'::regclass);


--
-- Name: role_requirements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_requirements ALTER COLUMN id SET DEFAULT nextval('public.role_requirements_id_seq'::regclass);


--
-- Name: session_admission_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_admission_events ALTER COLUMN id SET DEFAULT nextval('public.session_admission_events_id_seq'::regclass);


--
-- Name: session_registrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_registrations ALTER COLUMN id SET DEFAULT nextval('public.session_registrations_id_seq'::regclass);


--
-- Name: sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions ALTER COLUMN id SET DEFAULT nextval('public.sessions_id_seq'::regclass);


--
-- Name: signoffs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signoffs ALTER COLUMN id SET DEFAULT nextval('public.signoffs_id_seq'::regclass);


--
-- Name: slides id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slides ALTER COLUMN id SET DEFAULT nextval('public.slides_id_seq'::regclass);


--
-- Name: support_tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets ALTER COLUMN id SET DEFAULT nextval('public.support_tickets_id_seq'::regclass);


--
-- Name: training_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_categories ALTER COLUMN id SET DEFAULT nextval('public.training_categories_id_seq'::regclass);


--
-- Name: training_licenses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_licenses ALTER COLUMN id SET DEFAULT nextval('public.training_licenses_id_seq'::regclass);


--
-- Name: training_modules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_modules ALTER COLUMN id SET DEFAULT nextval('public.training_modules_id_seq'::regclass);


--
-- Name: training_versions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_versions ALTER COLUMN id SET DEFAULT nextval('public.training_versions_id_seq'::regclass);


--
-- Name: trainings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainings ALTER COLUMN id SET DEFAULT nextval('public.trainings_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: verification_cases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_cases ALTER COLUMN id SET DEFAULT nextval('public.verification_cases_id_seq'::regclass);


--
-- Name: verification_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_documents ALTER COLUMN id SET DEFAULT nextval('public.verification_documents_id_seq'::regclass);


--
-- Name: verification_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_events ALTER COLUMN id SET DEFAULT nextval('public.verification_events_id_seq'::regclass);


--
-- Name: webinar_registrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webinar_registrations ALTER COLUMN id SET DEFAULT nextval('public.webinar_registrations_id_seq'::regclass);


--
-- Name: webinars id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webinars ALTER COLUMN id SET DEFAULT nextval('public.webinars_id_seq'::regclass);


--
-- Name: access_logs access_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.access_logs
    ADD CONSTRAINT access_logs_pkey PRIMARY KEY (id);


--
-- Name: affiliations affiliations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.affiliations
    ADD CONSTRAINT affiliations_pkey PRIMARY KEY (id);


--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);


--
-- Name: approval_documents approval_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_documents
    ADD CONSTRAINT approval_documents_pkey PRIMARY KEY (id);


--
-- Name: approval_events approval_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_events
    ADD CONSTRAINT approval_events_pkey PRIMARY KEY (id);


--
-- Name: approval_findings approval_findings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_findings
    ADD CONSTRAINT approval_findings_pkey PRIMARY KEY (id);


--
-- Name: articles articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_pkey PRIMARY KEY (id);


--
-- Name: articles articles_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_slug_unique UNIQUE (slug);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: certificate_objectives certificate_objectives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificate_objectives
    ADD CONSTRAINT certificate_objectives_pkey PRIMARY KEY (id);


--
-- Name: certificates certificates_certificateNumber_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT "certificates_certificateNumber_unique" UNIQUE ("certificateNumber");


--
-- Name: certificates certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT certificates_pkey PRIMARY KEY (id);


--
-- Name: certificates certificates_verificationCode_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.certificates
    ADD CONSTRAINT "certificates_verificationCode_unique" UNIQUE ("verificationCode");


--
-- Name: checkout_attempts checkout_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_attempts
    ADD CONSTRAINT checkout_attempts_pkey PRIMARY KEY ("orderId");


--
-- Name: checkout_attempts checkout_attempts_requestKey_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_attempts
    ADD CONSTRAINT "checkout_attempts_requestKey_key" UNIQUE ("requestKey");


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: content_events content_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_events
    ADD CONSTRAINT content_events_pkey PRIMARY KEY (id);


--
-- Name: content_revisions content_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_revisions
    ADD CONSTRAINT content_revisions_pkey PRIMARY KEY (id);


--
-- Name: course_media course_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_media
    ADD CONSTRAINT course_media_pkey PRIMARY KEY (id);


--
-- Name: course_media course_media_storageKey_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_media
    ADD CONSTRAINT "course_media_storageKey_key" UNIQUE ("storageKey");


--
-- Name: course_template_uses course_template_uses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_template_uses
    ADD CONSTRAINT course_template_uses_pkey PRIMARY KEY ("trainingId");


--
-- Name: course_templates course_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_templates
    ADD CONSTRAINT course_templates_pkey PRIMARY KEY (id);


--
-- Name: credentials credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: enrollments enrollment_license_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollment_license_unique UNIQUE ("trainingLicenseId");


--
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (id);


--
-- Name: exam_finalization_failures exam_finalization_failures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_finalization_failures
    ADD CONSTRAINT exam_finalization_failures_pkey PRIMARY KEY (id);


--
-- Name: exam_sessions exam_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_pkey PRIMARY KEY (id);


--
-- Name: external_trainings external_trainings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_trainings
    ADD CONSTRAINT external_trainings_pkey PRIMARY KEY (id);


--
-- Name: faq_items faq_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faq_items
    ADD CONSTRAINT faq_items_pkey PRIMARY KEY (id);


--
-- Name: learning_objectives learning_objectives_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_objectives
    ADD CONSTRAINT learning_objectives_pkey PRIMARY KEY (id);


--
-- Name: legacy_course_media_links legacy_course_media_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_course_media_links
    ADD CONSTRAINT legacy_course_media_links_pkey PRIMARY KEY ("storageKey", "trainingId");


--
-- Name: live_messages live_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_messages
    ADD CONSTRAINT live_messages_pkey PRIMARY KEY (id);


--
-- Name: live_participants live_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_participants
    ADD CONSTRAINT live_participants_pkey PRIMARY KEY (id);


--
-- Name: live_poll_votes live_poll_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_poll_votes
    ADD CONSTRAINT live_poll_votes_pkey PRIMARY KEY (id);


--
-- Name: live_polls live_polls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_polls
    ADD CONSTRAINT live_polls_pkey PRIMARY KEY (id);


--
-- Name: live_presence_intervals live_presence_intervals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_presence_intervals
    ADD CONSTRAINT live_presence_intervals_pkey PRIMARY KEY (id);


--
-- Name: live_video_tickets live_video_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_video_tickets
    ADD CONSTRAINT live_video_tickets_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: module_progress module_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_progress
    ADD CONSTRAINT module_progress_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: objective_progress objective_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.objective_progress
    ADD CONSTRAINT objective_progress_pkey PRIMARY KEY (id);


--
-- Name: offers offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_pkey PRIMARY KEY (id);


--
-- Name: operator_approval operator_approval_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operator_approval
    ADD CONSTRAINT operator_approval_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: passport_documents passport_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passport_documents
    ADD CONSTRAINT passport_documents_pkey PRIMARY KEY (id);


--
-- Name: passport_events passport_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passport_events
    ADD CONSTRAINT passport_events_pkey PRIMARY KEY (id);


--
-- Name: payment_reconciliations payment_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_reconciliations
    ADD CONSTRAINT payment_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: pedagogical_decisions pedagogical_decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedagogical_decisions
    ADD CONSTRAINT pedagogical_decisions_pkey PRIMARY KEY (id);


--
-- Name: pedagogical_decisions pedagogical_decisions_reviewId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedagogical_decisions
    ADD CONSTRAINT "pedagogical_decisions_reviewId_key" UNIQUE ("reviewId");


--
-- Name: pedagogical_reviews pedagogical_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedagogical_reviews
    ADD CONSTRAINT pedagogical_reviews_pkey PRIMARY KEY (id);


--
-- Name: pedagogical_withdrawals pedagogical_withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedagogical_withdrawals
    ADD CONSTRAINT pedagogical_withdrawals_pkey PRIMARY KEY (id);


--
-- Name: pedagogical_withdrawals pedagogical_withdrawals_reviewId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedagogical_withdrawals
    ADD CONSTRAINT "pedagogical_withdrawals_reviewId_key" UNIQUE ("reviewId");


--
-- Name: processed_webhook_events processed_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processed_webhook_events
    ADD CONSTRAINT processed_webhook_events_pkey PRIMARY KEY ("eventId");


--
-- Name: proctoring_events proctoring_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proctoring_events
    ADD CONSTRAINT proctoring_events_pkey PRIMARY KEY (id);


--
-- Name: quiz_attempts quiz_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_attempts
    ADD CONSTRAINT quiz_attempts_pkey PRIMARY KEY (id);


--
-- Name: quiz_questions quiz_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quiz_questions
    ADD CONSTRAINT quiz_questions_pkey PRIMARY KEY (id);


--
-- Name: quote_requests quote_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quote_requests
    ADD CONSTRAINT quote_requests_pkey PRIMARY KEY (id);


--
-- Name: raero_migrations raero_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raero_migrations
    ADD CONSTRAINT raero_migrations_pkey PRIMARY KEY (name);


--
-- Name: recurrencies recurrencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurrencies
    ADD CONSTRAINT recurrencies_pkey PRIMARY KEY (id);


--
-- Name: refund_observations refund_observations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refund_observations
    ADD CONSTRAINT refund_observations_pkey PRIMARY KEY ("eventId");


--
-- Name: regulatory_changes regulatory_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regulatory_changes
    ADD CONSTRAINT regulatory_changes_pkey PRIMARY KEY (id);


--
-- Name: role_requirements role_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_requirements
    ADD CONSTRAINT role_requirements_pkey PRIMARY KEY (id);


--
-- Name: session_admission_events session_admission_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_admission_events
    ADD CONSTRAINT session_admission_events_pkey PRIMARY KEY (id);


--
-- Name: session_registrations session_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_registrations
    ADD CONSTRAINT session_registrations_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: signoffs signoffs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signoffs
    ADD CONSTRAINT signoffs_pkey PRIMARY KEY (id);


--
-- Name: slides slides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slides
    ADD CONSTRAINT slides_pkey PRIMARY KEY (id);


--
-- Name: subscription_checkout_closures subscription_checkout_closures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_checkout_closures
    ADD CONSTRAINT subscription_checkout_closures_pkey PRIMARY KEY ("attemptId");


--
-- Name: subscription_checkouts subscription_checkouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_checkouts
    ADD CONSTRAINT subscription_checkouts_pkey PRIMARY KEY (id);


--
-- Name: subscription_checkouts subscription_checkouts_requestKey_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_checkouts
    ADD CONSTRAINT "subscription_checkouts_requestKey_key" UNIQUE ("requestKey");


--
-- Name: subscription_checkouts subscription_checkouts_sessionId_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_checkouts
    ADD CONSTRAINT "subscription_checkouts_sessionId_key" UNIQUE ("sessionId");


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: training_categories training_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_categories
    ADD CONSTRAINT training_categories_pkey PRIMARY KEY (id);


--
-- Name: training_categories training_categories_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_categories
    ADD CONSTRAINT training_categories_slug_unique UNIQUE (slug);


--
-- Name: training_licenses training_licenses_orderItemId_seatIndex_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_licenses
    ADD CONSTRAINT "training_licenses_orderItemId_seatIndex_key" UNIQUE ("orderItemId", "seatIndex");


--
-- Name: training_licenses training_licenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_licenses
    ADD CONSTRAINT training_licenses_pkey PRIMARY KEY (id);


--
-- Name: training_modules training_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_modules
    ADD CONSTRAINT training_modules_pkey PRIMARY KEY (id);


--
-- Name: training_versions training_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_versions
    ADD CONSTRAINT training_versions_pkey PRIMARY KEY (id);


--
-- Name: training_versions training_versions_trainingId_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_versions
    ADD CONSTRAINT "training_versions_trainingId_version_key" UNIQUE ("trainingId", version);


--
-- Name: trainings trainings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainings
    ADD CONSTRAINT trainings_pkey PRIMARY KEY (id);


--
-- Name: trainings trainings_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trainings
    ADD CONSTRAINT trainings_slug_unique UNIQUE (slug);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_openId_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_openId_unique" UNIQUE ("openId");


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verification_cases verification_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_cases
    ADD CONSTRAINT verification_cases_pkey PRIMARY KEY (id);


--
-- Name: verification_cases verification_cases_subjectKey_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_cases
    ADD CONSTRAINT "verification_cases_subjectKey_unique" UNIQUE ("subjectKey");


--
-- Name: verification_documents verification_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_documents
    ADD CONSTRAINT verification_documents_pkey PRIMARY KEY (id);


--
-- Name: verification_events verification_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_events
    ADD CONSTRAINT verification_events_pkey PRIMARY KEY (id);


--
-- Name: webinar_registrations webinar_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webinar_registrations
    ADD CONSTRAINT webinar_registrations_pkey PRIMARY KEY (id);


--
-- Name: webinars webinars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webinars
    ADD CONSTRAINT webinars_pkey PRIMARY KEY (id);


--
-- Name: checkout_attempts_fingerprint_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX checkout_attempts_fingerprint_idx ON public.checkout_attempts USING btree (fingerprint);


--
-- Name: content_events_training_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_events_training_idx ON public.content_events USING btree ("trainingId");


--
-- Name: course_media_training_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX course_media_training_idx ON public.course_media USING btree ("trainingId");


--
-- Name: exam_finalization_failures_retry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX exam_finalization_failures_retry_idx ON public.exam_finalization_failures USING btree ("examSessionId", "retryAfter");


--
-- Name: live_presence_room_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX live_presence_room_idx ON public.live_presence_intervals USING btree ("roomType", "roomId", id);


--
-- Name: passport_events_person_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX passport_events_person_idx ON public.passport_events USING btree ("personId", id);


--
-- Name: payment_reconciliations_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_reconciliations_order_idx ON public.payment_reconciliations USING btree ("orderId", id);


--
-- Name: pedagogical_reviews_course_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX pedagogical_reviews_course_idx ON public.pedagogical_reviews USING btree ("trainingId", id);


--
-- Name: refund_observations_intent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX refund_observations_intent_idx ON public.refund_observations USING btree ("paymentIntentId");


--
-- Name: session_admission_events_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX session_admission_events_user_idx ON public.session_admission_events USING btree ("userId", id);


--
-- Name: subscription_checkout_one_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX subscription_checkout_one_pending ON public.subscription_checkouts USING btree ("companyId") WHERE ((status)::text = 'pending'::text);


--
-- Name: training_owner_org_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX training_owner_org_idx ON public.trainings USING btree ("ownerOrgId");


--
-- Name: training_owner_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX training_owner_user_idx ON public.trainings USING btree ("ownerUserId");


--
-- Name: verification_documents_case_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verification_documents_case_idx ON public.verification_documents USING btree ("caseId");


--
-- Name: verification_documents_url_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verification_documents_url_idx ON public.verification_documents USING btree ("fileUrl");


--
-- Name: verification_events_case_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verification_events_case_idx ON public.verification_events USING btree ("caseId");


--
-- Name: learning_objectives active_content_links; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER active_content_links BEFORE INSERT OR UPDATE ON public.learning_objectives FOR EACH ROW EXECUTE FUNCTION public.validate_active_content_links();


--
-- Name: quiz_questions active_content_links; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER active_content_links BEFORE INSERT OR UPDATE ON public.quiz_questions FOR EACH ROW EXECUTE FUNCTION public.validate_active_content_links();


--
-- Name: slides active_content_links; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER active_content_links BEFORE INSERT OR UPDATE ON public.slides FOR EACH ROW EXECUTE FUNCTION public.validate_active_content_links();


--
-- Name: training_modules active_content_links; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER active_content_links BEFORE INSERT OR UPDATE ON public.training_modules FOR EACH ROW EXECUTE FUNCTION public.validate_active_content_links();


--
-- Name: approval_documents approval_documents_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER approval_documents_immutable BEFORE DELETE OR UPDATE OR TRUNCATE ON public.approval_documents FOR EACH STATEMENT EXECUTE FUNCTION public.preserve_approval_records();


--
-- Name: approval_events approval_events_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER approval_events_immutable BEFORE DELETE OR UPDATE OR TRUNCATE ON public.approval_events FOR EACH STATEMENT EXECUTE FUNCTION public.preserve_approval_records();


--
-- Name: learning_objectives archived_content_locked; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER archived_content_locked BEFORE INSERT OR UPDATE ON public.learning_objectives FOR EACH ROW EXECUTE FUNCTION public.protect_archived_content();


--
-- Name: quiz_questions archived_content_locked; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER archived_content_locked BEFORE INSERT OR UPDATE ON public.quiz_questions FOR EACH ROW EXECUTE FUNCTION public.protect_archived_content();


--
-- Name: slides archived_content_locked; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER archived_content_locked BEFORE INSERT OR UPDATE ON public.slides FOR EACH ROW EXECUTE FUNCTION public.protect_archived_content();


--
-- Name: training_modules archived_content_locked; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER archived_content_locked BEFORE INSERT OR UPDATE ON public.training_modules FOR EACH ROW EXECUTE FUNCTION public.protect_archived_content();


--
-- Name: trainings archived_content_locked; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER archived_content_locked BEFORE INSERT OR UPDATE ON public.trainings FOR EACH ROW EXECUTE FUNCTION public.protect_archived_content();


--
-- Name: enrollments assignment_origin_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER assignment_origin_immutable BEFORE UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.preserve_assignment_origin();


--
-- Name: checkout_attempts checkout_attempts_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER checkout_attempts_immutable BEFORE DELETE OR UPDATE ON public.checkout_attempts FOR EACH ROW EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: checkout_attempts checkout_attempts_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER checkout_attempts_no_truncate BEFORE TRUNCATE ON public.checkout_attempts FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: content_events content_events_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER content_events_immutable BEFORE DELETE OR UPDATE OR TRUNCATE ON public.content_events FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: course_media course_media_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER course_media_immutable BEFORE DELETE OR UPDATE ON public.course_media FOR EACH ROW EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: course_media course_media_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER course_media_no_truncate BEFORE TRUNCATE ON public.course_media FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: enrollments enrollment_course_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enrollment_course_lock BEFORE INSERT ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.lock_enrollment_course();


--
-- Name: enrollments enrollment_version_pinned; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER enrollment_version_pinned BEFORE INSERT OR UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.pin_enrollment_version();


--
-- Name: exam_sessions exam_chapter_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER exam_chapter_immutable BEFORE UPDATE ON public.exam_sessions FOR EACH ROW EXECUTE FUNCTION public.protect_exam_chapter();


--
-- Name: exam_finalization_failures exam_finalization_failures_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER exam_finalization_failures_immutable BEFORE DELETE OR UPDATE ON public.exam_finalization_failures FOR EACH ROW EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: exam_finalization_failures exam_finalization_failures_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER exam_finalization_failures_no_truncate BEFORE TRUNCATE ON public.exam_finalization_failures FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: exam_sessions exam_snapshot_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER exam_snapshot_immutable BEFORE UPDATE ON public.exam_sessions FOR EACH ROW EXECUTE FUNCTION public.protect_exam_snapshot();


--
-- Name: legacy_course_media_links legacy_media_links_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER legacy_media_links_immutable BEFORE DELETE OR UPDATE ON public.legacy_course_media_links FOR EACH ROW EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: legacy_course_media_links legacy_media_links_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER legacy_media_links_no_truncate BEFORE TRUNCATE ON public.legacy_course_media_links FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: training_licenses license_origin_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER license_origin_immutable BEFORE UPDATE ON public.training_licenses FOR EACH ROW EXECUTE FUNCTION public.protect_license_origin();


--
-- Name: training_licenses license_revocation_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER license_revocation_immutable BEFORE UPDATE ON public.training_licenses FOR EACH ROW EXECUTE FUNCTION public.preserve_license_revocation();


--
-- Name: training_licenses licenses_no_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER licenses_no_delete BEFORE DELETE OR TRUNCATE ON public.training_licenses FOR EACH STATEMENT EXECUTE FUNCTION public.preserve_content_record();


--
-- Name: live_presence_intervals live_presence_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER live_presence_immutable BEFORE DELETE OR UPDATE ON public.live_presence_intervals FOR EACH ROW EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: live_presence_intervals live_presence_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER live_presence_no_truncate BEFORE TRUNCATE ON public.live_presence_intervals FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: live_video_tickets live_video_ticket_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER live_video_ticket_immutable BEFORE DELETE OR UPDATE ON public.live_video_tickets FOR EACH ROW EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: live_video_tickets live_video_ticket_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER live_video_ticket_no_truncate BEFORE TRUNCATE ON public.live_video_tickets FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: passport_documents passport_documents_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER passport_documents_immutable BEFORE DELETE OR UPDATE ON public.passport_documents FOR EACH ROW EXECUTE FUNCTION public.preserve_passport_document();


--
-- Name: passport_documents passport_documents_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER passport_documents_no_truncate BEFORE TRUNCATE ON public.passport_documents FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: passport_events passport_events_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER passport_events_immutable BEFORE DELETE OR UPDATE ON public.passport_events FOR EACH ROW EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: passport_events passport_events_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER passport_events_no_truncate BEFORE TRUNCATE ON public.passport_events FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: payment_reconciliations payment_reconciliations_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payment_reconciliations_immutable BEFORE DELETE OR UPDATE ON public.payment_reconciliations FOR EACH ROW EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: payment_reconciliations payment_reconciliations_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER payment_reconciliations_no_truncate BEFORE TRUNCATE ON public.payment_reconciliations FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: pedagogical_decisions pedagogical_decisions_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pedagogical_decisions_immutable BEFORE DELETE OR UPDATE ON public.pedagogical_decisions FOR EACH ROW EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: pedagogical_decisions pedagogical_decisions_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pedagogical_decisions_no_truncate BEFORE TRUNCATE ON public.pedagogical_decisions FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: pedagogical_reviews pedagogical_reviews_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pedagogical_reviews_immutable BEFORE DELETE OR UPDATE ON public.pedagogical_reviews FOR EACH ROW EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: pedagogical_reviews pedagogical_reviews_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pedagogical_reviews_no_truncate BEFORE TRUNCATE ON public.pedagogical_reviews FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: pedagogical_withdrawals pedagogical_withdrawals_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pedagogical_withdrawals_immutable BEFORE DELETE OR UPDATE ON public.pedagogical_withdrawals FOR EACH ROW EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: pedagogical_withdrawals pedagogical_withdrawals_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER pedagogical_withdrawals_no_truncate BEFORE TRUNCATE ON public.pedagogical_withdrawals FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: learning_objectives preserve_content; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER preserve_content BEFORE DELETE OR TRUNCATE ON public.learning_objectives FOR EACH STATEMENT EXECUTE FUNCTION public.preserve_content_record();


--
-- Name: quiz_questions preserve_content; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER preserve_content BEFORE DELETE OR TRUNCATE ON public.quiz_questions FOR EACH STATEMENT EXECUTE FUNCTION public.preserve_content_record();


--
-- Name: slides preserve_content; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER preserve_content BEFORE DELETE OR TRUNCATE ON public.slides FOR EACH STATEMENT EXECUTE FUNCTION public.preserve_content_record();


--
-- Name: training_modules preserve_content; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER preserve_content BEFORE DELETE OR TRUNCATE ON public.training_modules FOR EACH STATEMENT EXECUTE FUNCTION public.preserve_content_record();


--
-- Name: trainings preserve_content; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER preserve_content BEFORE DELETE OR TRUNCATE ON public.trainings FOR EACH STATEMENT EXECUTE FUNCTION public.preserve_content_record();


--
-- Name: refund_observations refund_observations_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER refund_observations_immutable BEFORE DELETE OR UPDATE OR TRUNCATE ON public.refund_observations FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: session_admission_events session_admission_events_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER session_admission_events_immutable BEFORE DELETE OR UPDATE ON public.session_admission_events FOR EACH ROW EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: session_admission_events session_admission_events_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER session_admission_events_no_truncate BEFORE TRUNCATE ON public.session_admission_events FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: session_registrations session_registrations_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER session_registrations_no_truncate BEFORE TRUNCATE ON public.session_registrations FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: session_registrations session_registrations_retained; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER session_registrations_retained BEFORE DELETE OR UPDATE ON public.session_registrations FOR EACH ROW EXECUTE FUNCTION public.preserve_session_registration();


--
-- Name: subscription_checkouts subscription_checkout_no_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER subscription_checkout_no_delete BEFORE DELETE ON public.subscription_checkouts FOR EACH ROW EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: subscription_checkouts subscription_checkout_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER subscription_checkout_no_truncate BEFORE TRUNCATE ON public.subscription_checkouts FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: subscription_checkouts subscription_checkout_preserved; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER subscription_checkout_preserved BEFORE UPDATE ON public.subscription_checkouts FOR EACH ROW EXECUTE FUNCTION public.preserve_subscription_checkout();


--
-- Name: subscription_checkout_closures subscription_closure_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER subscription_closure_immutable BEFORE DELETE OR UPDATE ON public.subscription_checkout_closures FOR EACH ROW EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: subscription_checkout_closures subscription_closure_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER subscription_closure_no_truncate BEFORE TRUNCATE ON public.subscription_checkout_closures FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: enrollments subscription_enrollment_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER subscription_enrollment_immutable BEFORE UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION public.preserve_subscription_enrollment();


--
-- Name: course_template_uses template_use_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER template_use_immutable BEFORE DELETE OR UPDATE ON public.course_template_uses FOR EACH ROW EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: course_template_uses template_use_no_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER template_use_no_truncate BEFORE TRUNCATE ON public.course_template_uses FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: training_versions training_versions_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER training_versions_immutable BEFORE DELETE OR UPDATE OR TRUNCATE ON public.training_versions FOR EACH STATEMENT EXECUTE FUNCTION public.reject_content_history_mutation();


--
-- Name: verification_events verification_events_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER verification_events_immutable BEFORE DELETE OR UPDATE OR TRUNCATE ON public.verification_events FOR EACH STATEMENT EXECUTE FUNCTION public.preserve_verification_events();


--
-- Name: checkout_attempts checkout_attempts_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkout_attempts
    ADD CONSTRAINT "checkout_attempts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public.orders(id);


--
-- Name: course_media course_media_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_media
    ADD CONSTRAINT "course_media_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id);


--
-- Name: course_media course_media_trainingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_media
    ADD CONSTRAINT "course_media_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES public.trainings(id);


--
-- Name: course_template_uses course_template_uses_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_template_uses
    ADD CONSTRAINT "course_template_uses_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id);


--
-- Name: course_template_uses course_template_uses_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_template_uses
    ADD CONSTRAINT "course_template_uses_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public.course_templates(id);


--
-- Name: course_template_uses course_template_uses_trainingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_template_uses
    ADD CONSTRAINT "course_template_uses_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES public.trainings(id);


--
-- Name: legacy_course_media_links legacy_course_media_links_trainingId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legacy_course_media_links
    ADD CONSTRAINT "legacy_course_media_links_trainingId_fkey" FOREIGN KEY ("trainingId") REFERENCES public.trainings(id);


--
-- Name: live_video_tickets live_video_tickets_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_video_tickets
    ADD CONSTRAINT "live_video_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- Name: payment_reconciliations payment_reconciliations_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_reconciliations
    ADD CONSTRAINT "payment_reconciliations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public.orders(id);


--
-- Name: pedagogical_decisions pedagogical_decisions_reviewId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedagogical_decisions
    ADD CONSTRAINT "pedagogical_decisions_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES public.pedagogical_reviews(id);


--
-- Name: pedagogical_withdrawals pedagogical_withdrawals_reviewId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedagogical_withdrawals
    ADD CONSTRAINT "pedagogical_withdrawals_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES public.pedagogical_reviews(id);


--
-- Name: subscription_checkout_closures subscription_checkout_closures_attemptId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_checkout_closures
    ADD CONSTRAINT "subscription_checkout_closures_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES public.subscription_checkouts(id);


--
-- Name: subscription_checkout_closures subscription_checkout_closures_requestedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_checkout_closures
    ADD CONSTRAINT "subscription_checkout_closures_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES public.users(id);


--
-- Name: subscription_checkouts subscription_checkouts_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_checkouts
    ADD CONSTRAINT "subscription_checkouts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id);


--
-- Name: subscription_checkouts subscription_checkouts_requestedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_checkouts
    ADD CONSTRAINT "subscription_checkouts_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES public.users(id);


--
-- Name: training_versions training_versions_reviewId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.training_versions
    ADD CONSTRAINT "training_versions_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES public.pedagogical_reviews(id);


--
-- PostgreSQL database dump complete
--


