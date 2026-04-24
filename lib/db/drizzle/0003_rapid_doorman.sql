CREATE TABLE "customer_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"phone_e164" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "phone_e164" text;--> statement-breakpoint
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_sessions_token_hash_uq" ON "customer_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "customer_sessions_customer_id_idx" ON "customer_sessions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_sessions_expires_at_idx" ON "customer_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "otp_codes_phone_e164_idx" ON "otp_codes" USING btree ("phone_e164");--> statement-breakpoint
CREATE INDEX "otp_codes_expires_at_idx" ON "otp_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customers_phone_e164_uq" ON "customers" USING btree ("phone_e164");