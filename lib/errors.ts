import { redirect } from "next/navigation";

/**
 * Redirect to the 404 Not Found page
 * Use this when a resource cannot be found
 */
export function notFound(message?: string) {
  redirect("/404");
}

/**
 * Redirect to the 403 Forbidden page
 * Use this when a user doesn't have permission to access a resource
 */
export function forbidden(message?: string) {
  redirect("/403");
}

/**
 * Check if user has permission to access a resource
 * Throws 403 if they don't have permission
 * @param hasPermission - Whether the user has permission
 * @param message - Optional error message for logging
 */
export function requirePermission(hasPermission: boolean, message?: string) {
  if (!hasPermission) {
    if (message) {
      console.warn("[Access Denied]", message);
    }
    forbidden();
  }
}

/**
 * Check if a resource exists
 * Throws 404 if it doesn't
 * @param resource - The resource to check
 * @param message - Optional error message for logging
 */
export function requireResource<T>(resource: T | null | undefined, message?: string): T {
  if (!resource) {
    if (message) {
      console.warn("[Not Found]", message);
    }
    notFound();
  }
  return resource;
}
