/**
 * Helper for delete mutation onSuccess callbacks.
 *
 * The server's deleteGuard returns 202 with `{ queued: true, ... }`
 * when a non-admin trips the bulk-delete safety cap. customFetch
 * treats 2xx as success, so each mutation's onSuccess receives that
 * payload like any other success body. This helper translates it
 * into the right toast props so every delete site has consistent
 * messaging without copy/pasting an if-else.
 */
export type DeleteResponseLike = {
  ok?: boolean;
  queued?: boolean;
  message?: string;
};

export function deleteOutcomeToast(
  result: unknown,
  successTitle = "Deleted",
): {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
} {
  if (
    result &&
    typeof result === "object" &&
    (result as DeleteResponseLike).queued === true
  ) {
    const r = result as DeleteResponseLike;
    return {
      title: "Awaiting admin approval",
      description:
        r.message ??
        "You've hit the safety cap of 3 deletions per hour. This deletion has been queued for the admin to review.",
    };
  }
  return { title: successTitle };
}
