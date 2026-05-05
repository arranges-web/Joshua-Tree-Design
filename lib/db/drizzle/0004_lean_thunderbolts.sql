CREATE TYPE "public"."equipment_category" AS ENUM('HANDHELD', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('TRUCK', 'TRAILER');--> statement-breakpoint
CREATE TABLE "asset_assignment_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_type" text NOT NULL,
	"asset_id" integer NOT NULL,
	"old_crew_id" integer,
	"new_crew_id" integer,
	"changed_by_user_id" integer,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "asset_status_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_type" text NOT NULL,
	"asset_id" integer NOT NULL,
	"old_status" text NOT NULL,
	"new_status" text NOT NULL,
	"changed_by_user_id" integer,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipment_id" integer NOT NULL,
	"name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_readings" (
	"id" serial PRIMARY KEY NOT NULL,
	"truck_id" integer,
	"equipment_id" integer,
	"mileage" integer,
	"hours" integer,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recorded_by_user_id" integer,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "crews" ADD COLUMN "department_id" integer;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "category" "equipment_category" DEFAULT 'HANDHELD' NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "custom_category_label" text;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "department_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "assigned_crew_id" integer;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "last_assigned_by_user_id" integer;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "last_assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "purchase_price_cents" integer;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "purchase_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "current_hours" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "service_interval_hours" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "equipment" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD COLUMN "logged_by_user_id" integer;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD COLUMN "labor_cost_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD COLUMN "parts_cost_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD COLUMN "mileage_at_service" integer;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD COLUMN "hours_at_service" integer;--> statement-breakpoint
ALTER TABLE "trucks" ADD COLUMN "vehicle_type" "vehicle_type" DEFAULT 'TRUCK' NOT NULL;--> statement-breakpoint
ALTER TABLE "trucks" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "trucks" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "trucks" ADD COLUMN "department_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "trucks" ADD COLUMN "last_assigned_by_user_id" integer;--> statement-breakpoint
ALTER TABLE "trucks" ADD COLUMN "last_assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trucks" ADD COLUMN "purchase_price_cents" integer;--> statement-breakpoint
ALTER TABLE "trucks" ADD COLUMN "purchase_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trucks" ADD COLUMN "current_mileage" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "trucks" ADD COLUMN "service_interval_miles" integer DEFAULT 5000 NOT NULL;--> statement-breakpoint
ALTER TABLE "trucks" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "asset_assignment_log" ADD CONSTRAINT "asset_assignment_log_old_crew_id_crews_id_fk" FOREIGN KEY ("old_crew_id") REFERENCES "public"."crews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_assignment_log" ADD CONSTRAINT "asset_assignment_log_new_crew_id_crews_id_fk" FOREIGN KEY ("new_crew_id") REFERENCES "public"."crews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_assignment_log" ADD CONSTRAINT "asset_assignment_log_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_status_log" ADD CONSTRAINT "asset_status_log_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment_items" ADD CONSTRAINT "equipment_items_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_readings" ADD CONSTRAINT "usage_readings_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_readings" ADD CONSTRAINT "usage_readings_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_readings" ADD CONSTRAINT "usage_readings_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asset_assignment_log_asset_idx" ON "asset_assignment_log" USING btree ("asset_type","asset_id");--> statement-breakpoint
CREATE INDEX "asset_assignment_log_changed_at_idx" ON "asset_assignment_log" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "asset_status_log_asset_idx" ON "asset_status_log" USING btree ("asset_type","asset_id");--> statement-breakpoint
CREATE INDEX "asset_status_log_changed_at_idx" ON "asset_status_log" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "equipment_items_equipment_id_idx" ON "equipment_items" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "usage_readings_truck_id_idx" ON "usage_readings" USING btree ("truck_id");--> statement-breakpoint
CREATE INDEX "usage_readings_equipment_id_idx" ON "usage_readings" USING btree ("equipment_id");--> statement-breakpoint
CREATE INDEX "usage_readings_recorded_at_idx" ON "usage_readings" USING btree ("recorded_at");--> statement-breakpoint
ALTER TABLE "crews" ADD CONSTRAINT "crews_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_assigned_crew_id_crews_id_fk" FOREIGN KEY ("assigned_crew_id") REFERENCES "public"."crews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_last_assigned_by_user_id_users_id_fk" FOREIGN KEY ("last_assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_logged_by_user_id_users_id_fk" FOREIGN KEY ("logged_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trucks" ADD CONSTRAINT "trucks_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trucks" ADD CONSTRAINT "trucks_last_assigned_by_user_id_users_id_fk" FOREIGN KEY ("last_assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "equipment_slug_uq" ON "equipment" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "trucks_slug_uq" ON "trucks" USING btree ("slug");