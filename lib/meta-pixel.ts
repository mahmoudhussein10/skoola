"use client";

// Ensure fbq is added to the window object for TypeScript
declare global {
  interface Window {
    fbq?: (...args: (string | Record<string, unknown> | undefined | boolean)[]) => void;
  }
}

const isBrowser = typeof window !== "undefined";

/**
 * Helper to safely call the fbq function if it exists.
 */
const safeFbq = (...args: (string | Record<string, unknown> | undefined | boolean)[]) => {
  if (isBrowser && window.fbq) {
    window.fbq(...args);
  }
};

/**
 * Track a page view.
 */
export const pageView = () => {
  safeFbq("track", "PageView");
};

/**
 * Track when a user views a key content page.
 */
export const viewContent = (parameters?: { content_name?: string; [key: string]: unknown }) => {
  safeFbq("track", "ViewContent", parameters);
};

/**
 * Track when a user successfully completes registration.
 */
export const completeRegistration = (parameters?: { content_name?: string; status?: boolean; [key: string]: unknown }) => {
  safeFbq("track", "CompleteRegistration", parameters);
};

/**
 * Track when a user starts a trial.
 */
export const startTrial = (parameters?: { content_name?: string; currency?: string; value?: number; [key: string]: unknown }) => {
  safeFbq("track", "StartTrial", parameters);
};

/**
 * Track a successful purchase/activation.
 */
export const purchase = (parameters?: { content_name?: string; currency?: string; value?: number; [key: string]: unknown }) => {
  safeFbq("track", "Purchase", parameters);
};

/**
 * Track any custom event.
 */
export const trackCustom = (eventName: string, parameters?: Record<string, unknown>) => {
  safeFbq("trackCustom", eventName, parameters);
};
