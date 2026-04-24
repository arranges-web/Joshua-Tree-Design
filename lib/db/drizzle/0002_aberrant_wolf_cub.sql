CREATE TYPE "public"."request_source" AS ENUM('PORTAL', 'PHONE', 'WEB', 'WALKIN');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('NEW', 'CONTACTED', 'QUOTED', 'CONVERTED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('TREE_REMOVAL', 'TRIMMING_PRUNING', 'MANGROVE_CARE', 'STUMP_GRINDING', 'EMERGENCY_STORM', 'CRANE_ASSISTED');--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"property_id" integer,
	"service" "service_type" NOT NULL,
	"notes" text,
	"preferred_window_start" timestamp with time zone,
	"preferred_window_end" timestamp with time zone,
	"status" "request_status" DEFAULT 'NEW' NOT NULL,
	"source" "request_source" DEFAULT 'PORTAL' NOT NULL,
	"converted_quote_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_converted_quote_id_quotes_id_fk" FOREIGN KEY ("converted_quote_id") REFERENCES "public"."quotes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_requests_customer_id_idx" ON "service_requests" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "service_requests_status_idx" ON "service_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "service_requests_created_at_idx" ON "service_requests" USING btree ("created_at");