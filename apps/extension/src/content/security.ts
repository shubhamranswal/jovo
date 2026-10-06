/**
 * Security & Data Sanitization Rules for JobOS Extension
 *
 * Enforces strict allowlisting and blocklisting:
 * - Never captures passwords, tokens, cookies, auth headers, payment details, or government IDs.
 * - Filters inputs based on type, autocomplete attribute, name, id, and aria/label text.
 * - Ensures only genuine application fields and application-specific Q&A are captured.
 */

import type { SafeFieldType } from "../types";

// Whitelist of valid safe field types JobOS cares about
export const ALLOWED_SAFE_FIELD_TYPES: ReadonlySet<SafeFieldType> = new Set<SafeFieldType>([
  "firstName",
  "lastName",
  "fullName",
  "email",
  "phone",
  "address",
  "city",
  "state",
  "postalCode",
  "linkedin",
  "github",
  "website",
]);

// Sensitive keywords that immediately trigger an element blocklist
const SENSITIVE_KEYWORDS = [
  "password",
  "passwd",
  "pwd",
  "secret",
  "token",
  "auth",
  "csrf",
  "session",
  "cookie",
  "ssn",
  "socialsecurity",
  "social_security",
  "aadhaar",
  "national_id",
  "nationalid",
  "tax_id",
  "taxid",
  "passport",
  "driver_license",
  "drivers_license",
  "card",
  "creditcard",
  "cvv",
  "cvc",
  "bank",
  "routing",
  "account_number",
  "pin",
  "otp",
  "security_code",
];

// Blocklisted autocomplete values (standard browser autocomplete specs)
const BLOCKLISTED_AUTOCOMPLETE = new Set([
  "current-password",
  "new-password",
  "one-time-code",
  "cc-name",
  "cc-given-name",
  "cc-additional-name",
  "cc-family-name",
  "cc-number",
  "cc-exp",
  "cc-exp-month",
  "cc-exp-year",
  "cc-csc",
  "cc-type",
  "transaction-currency",
  "transaction-amount",
]);

/**
 * Checks if an element is dangerous or sensitive (passwords, tokens, payment, government ID).
 * Returns true if the element MUST be blocked.
 */
export function isElementSensitive(el: HTMLElement): boolean {
  // 1. Check element tag/type
  const tagName = el.tagName ? el.tagName.toUpperCase() : "";
  if (tagName === "INPUT") {
    const inputType = (el.getAttribute("type") || (el as any).type || "text").toLowerCase();
    if (inputType === "password" || inputType === "hidden") {
      return true;
    }
  }

  // 2. Check autocomplete attribute
  const autocomplete = (el.getAttribute("autocomplete") || "").toLowerCase().trim();
  if (BLOCKLISTED_AUTOCOMPLETE.has(autocomplete)) {
    return true;
  }

  // 3. Inspect semantic identifiers (name, id, automationId, placeholder, aria-label, class)
  const identifiers = [
    el.getAttribute("name"),
    el.id,
    el.getAttribute("data-automation-id"),
    el.getAttribute("aria-label"),
    el.getAttribute("placeholder"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const kw of SENSITIVE_KEYWORDS) {
    if (identifiers.includes(kw)) {
      return true;
    }
  }

  return false;
}

/**
 * Sanitizes form fields map before sending or storing:
 * - Only includes explicitly allowed, safe field types.
 * - Strips anything containing sensitive keywords or suspicious keys.
 */
export function sanitizeCapturedFormFields(
  fields: Record<string, string>,
  allowedLabelsOrNames: Set<string>
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, val] of Object.entries(fields)) {
    if (!val || typeof val !== "string") continue;

    const lowerKey = key.toLowerCase();

    // Check sensitive keyword block
    const isSensitive = SENSITIVE_KEYWORDS.some((kw) => lowerKey.includes(kw));
    if (isSensitive) continue;

    // Check against allowed set of known safe detected field labels
    if (allowedLabelsOrNames.has(key)) {
      sanitized[key] = val.trim();
    }
  }

  return sanitized;
}

/**
 * Validates whether a detected question is a genuine application question.
 * Filters out authentication prompts, CAPTCHA hints, or arbitrary empty fields.
 */
export function isGenuineApplicationQuestion(questionText: string): boolean {
  if (!questionText || questionText.trim().length < 5) {
    return false;
  }

  const lower = questionText.toLowerCase();

  // Must not be a password/login/security question
  for (const kw of SENSITIVE_KEYWORDS) {
    if (lower.includes(kw)) {
      return false;
    }
  }

  // Filter out site search bars, cookie banners, navigation textareas
  const nonQuestionKeywords = [
    "search",
    "cookie",
    "privacy policy",
    "terms of service",
    "subscribe to newsletter",
    "leave a comment",
    "feedback on our website",
  ];

  for (const nq of nonQuestionKeywords) {
    if (lower.includes(nq)) {
      return false;
    }
  }

  return true;
}
