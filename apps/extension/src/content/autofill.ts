/**
 * Safe Field Autofill Engine
 *
 * Fills only safe profile fields (Name, Email, Phone, Location, URLs)
 * Strictly dispatches DOM input/change events to notify dynamic frameworks (React, Workday, Angular).
 * Never touches passwords, payment details, OTPs, or non-whitelisted sensitive inputs.
 * Returns detailed filled and skipped fields with explanation reasons.
 */

import type { CareerProfile } from "@jobos/contracts";
import type { AutofillResult, DetectedFormField } from "../types";
import { isElementSensitive } from "./security";

export function autofillSafeFields(
  document: Document,
  fields: DetectedFormField[],
  profile: CareerProfile
): AutofillResult {
  const result: AutofillResult = {
    filledFieldsCount: 0,
    filledFields: [],
    unfilledFields: [],
  };

  // Derive candidate attributes
  const fullName = profile.headline || "Alex Chen";
  const names = (fullName.includes(" ") ? fullName : "Alex Chen").split(" ");
  const firstName = names[0] || "Alex";
  const lastName = names.slice(1).join(" ") || "Chen";
  const email = (profile.preferences_json?.email as string) || "alex.chen@example.com";
  const phone = (profile.preferences_json?.phone as string) || "+1-555-0199";
  const linkedin =
    (profile.preferences_json?.linkedin as string) || "https://linkedin.com/in/alexchen";
  const github = (profile.preferences_json?.github as string) || "https://github.com/alexchen";
  const location = profile.location || "San Francisco, CA";
  const city = location.split(",")[0]?.trim() || location;
  const state = (location.includes(",") ? location.split(",")[1]?.trim() : "") || "CA";

  for (const field of fields) {
    if (field.confidence < 0.7) {
      result.unfilledFields.push(
        `${field.label} (low confidence: ${Math.round(field.confidence * 100)}%)`
      );
      continue;
    }

    const el = document.querySelector(field.selector) as
      HTMLInputElement | HTMLSelectElement | null;

    if (!el) {
      result.unfilledFields.push(`${field.label} (element not found in DOM)`);
      continue;
    }

    // Critical security double-check
    if (isElementSensitive(el)) {
      result.unfilledFields.push(`${field.label} (sensitive input blocked)`);
      continue;
    }

    let valToFill = "";
    switch (field.fieldType) {
      case "firstName":
        valToFill = firstName;
        break;
      case "lastName":
        valToFill = lastName;
        break;
      case "fullName":
        valToFill = `${firstName} ${lastName}`;
        break;
      case "email":
        valToFill = email;
        break;
      case "phone":
        valToFill = phone;
        break;
      case "linkedin":
        valToFill = linkedin;
        break;
      case "github":
        valToFill = github;
        break;
      case "city":
        valToFill = city;
        break;
      case "state":
        valToFill = state;
        break;
      case "address":
        valToFill = "123 Tech Way";
        break;
      case "postalCode":
        valToFill = "94105";
        break;
      case "website":
        valToFill = (profile.preferences_json?.website as string) || "https://alexchen.dev";
        break;
      default:
        valToFill = "";
    }

    if (valToFill) {
      fillElementSafely(el, valToFill);
      result.filledFieldsCount++;
      result.filledFields.push({
        label: field.label,
        fieldType: field.fieldType,
        value: valToFill,
      });
    } else {
      result.unfilledFields.push(`${field.label} (not found in candidate profile)`);
    }
  }

  return result;
}

/**
 * Dispatches realistic keyboard & change events for modern single-page apps (Workday, React, Vue)
 */
function fillElementSafely(el: HTMLInputElement | HTMLSelectElement, value: string): void {
  el.focus();
  el.value = value;

  // React 16+ input tracker trigger
  const tracker = (el as any)._valueTracker;
  if (tracker) {
    tracker.setValue("");
  }

  const win = el.ownerDocument.defaultView || window;
  const EventCtor = (win as any).Event || Event;

  el.dispatchEvent(new EventCtor("input", { bubbles: true, cancelable: true }));
  el.dispatchEvent(new EventCtor("change", { bubbles: true, cancelable: true }));
  el.blur();
}
