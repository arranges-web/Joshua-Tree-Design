import type { RoleKey, Job, Customer } from "@workspace/db";

// Strip fields the role isn't allowed to see, even on rows they CAN see.
// Crew leads can see their assigned jobs but not the financial total.
export function shapeJobForRole<T extends Pick<Job, "totalCents"> & object>(
  job: T,
  role: RoleKey,
): Omit<T, "totalCents"> & { totalCents?: number } {
  if (role === "CREW_LEAD") {
    const { totalCents: _ignore, ...rest } = job;
    void _ignore;
    return rest;
  }
  return job;
}

// Crew leads should see the address (so they can drive there) but not
// billing details. SALES and ADMIN see everything.
export function shapeCustomerForRole<
  T extends Pick<Customer, "billingAddress" | "email" | "phone"> & object,
>(
  customer: T,
  role: RoleKey,
): Omit<T, "billingAddress" | "email" | "phone"> & {
  billingAddress?: string | null;
  email?: string | null;
  phone?: string | null;
} {
  if (role === "CREW_LEAD") {
    const { billingAddress: _b, email: _e, phone: _p, ...rest } = customer;
    void _b;
    void _e;
    void _p;
    return rest;
  }
  return customer;
}
