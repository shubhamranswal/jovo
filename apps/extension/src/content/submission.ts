/**
 * Observational Application Submission Detector
 *
 * Passively detects whether a job application was submitted by observing:
 * 1. Post-submission confirmation URLs (e.g. /thank-you, /confirmation, /applied, /success)
 * 2. Post-submission confirmation text and banners in the DOM
 * 3. User manual submit click / form submit events
 *
 * CRITICAL SAFETY GUARDRAIL:
 * This module is purely observational. It NEVER programmatically clicks buttons
 * or triggers form submissions. Autonomous submission is strictly prohibited.
 */

export interface SubmissionSignal {
  detected: boolean;
  confidence: number;
  signalType: "confirmation_url" | "confirmation_dom_text" | "manual_form_submit_event" | "none";
  message: string;
}

// Known confirmation URL path tokens
const CONFIRMATION_URL_PATTERNS = [
  "thank-you",
  "thankyou",
  "confirmation",
  "applied",
  "application-submitted",
  "application_submitted",
  "submitted",
  "success",
  "post-apply",
  "applicationcomplete",
];

// Known confirmation phrases in DOM headings/banners
const CONFIRMATION_TEXT_PHRASES = [
  "thank you for applying",
  "thanks for applying",
  "application submitted",
  "application has been submitted",
  "application was submitted",
  "we have received your application",
  "we received your application",
  "application received",
  "application complete",
  "your application is submitted",
  "your submission has been received",
];

// Track in-memory manual form submit event within current page lifecycle
let manualSubmitObserved = false;
let manualSubmitTimestamp: number | null = null;

export function initSubmissionObserver(doc: Document): void {
  // Listen for user-initiated submit events on forms
  doc.addEventListener(
    "submit",
    (_event) => {
      manualSubmitObserved = true;
      manualSubmitTimestamp = Date.now();
    },
    { capture: true }
  );
}

/**
 * Evaluates current page state for submission confirmation signals.
 */
export function detectSubmissionSignals(url: string, doc: Document): SubmissionSignal {
  const lowerUrl = url.toLowerCase();

  // 1. Check URL patterns
  for (const token of CONFIRMATION_URL_PATTERNS) {
    if (lowerUrl.includes(token)) {
      return {
        detected: true,
        confidence: 0.95,
        signalType: "confirmation_url",
        message: `Submission confirmed via page URL (${token})`,
      };
    }
  }

  // 2. Check DOM confirmation text in prominent containers
  const prominentElements = doc.querySelectorAll<HTMLElement>(
    "h1, h2, h3, .alert, .banner, .confirmation, [data-automation-id*='thankYou'], [data-automation-id*='submitSuccess'], [data-automation-id*='applicationSubmitted']"
  );

  for (const el of prominentElements) {
    const text = (el.textContent || el.innerText || "").toLowerCase().trim();
    if (!text || text.length > 200) continue;

    for (const phrase of CONFIRMATION_TEXT_PHRASES) {
      if (text.includes(phrase)) {
        return {
          detected: true,
          confidence: 0.92,
          signalType: "confirmation_dom_text",
          message: `Submission confirmed via page confirmation text ("${phrase}")`,
        };
      }
    }
  }

  // 3. Check observed manual submit event within last 120 seconds
  if (manualSubmitObserved && manualSubmitTimestamp) {
    const ageSeconds = (Date.now() - manualSubmitTimestamp) / 1000;
    if (ageSeconds < 120) {
      return {
        detected: true,
        confidence: 0.85,
        signalType: "manual_form_submit_event",
        message: "Manual form submission event observed on page",
      };
    }
  }

  return {
    detected: false,
    confidence: 0.0,
    signalType: "none",
    message: "No submission signals detected yet. Ready to apply.",
  };
}
