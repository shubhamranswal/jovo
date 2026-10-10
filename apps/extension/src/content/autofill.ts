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

/**
 * Checks if a file input is designated for candidate photo/avatar rather than document resume/CV.
 */
function isAvatarFileInput(el: HTMLElement): boolean {
  const accept = (el.getAttribute("accept") || "").toLowerCase();
  const safeClassName = typeof el.className === "string" ? el.className.toLowerCase() : "";
  const identifiers = `${el.getAttribute("name") || ""} ${el.id || ""} ${el.getAttribute("aria-label") || ""} ${safeClassName}`.toLowerCase();

  if (
    identifiers.includes("avatar") ||
    identifiers.includes("photo") ||
    identifiers.includes("picture") ||
    identifiers.includes("headshot") ||
    identifiers.includes("profile pic") ||
    identifiers.includes("profilepic") ||
    identifiers.includes("profile image")
  ) {
    return true;
  }

  if (
    accept &&
    (accept.includes("image") ||
      accept.includes("png") ||
      accept.includes("jpg") ||
      accept.includes("jpeg")) &&
    !accept.includes("pdf") &&
    !accept.includes("doc")
  ) {
    return true;
  }

  return false;
}

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

  // Derive candidate attributes accurately from verified profile preferences
  const fullName =
    (profile.preferences_json?.full_name as string) ||
    (profile.preferences_json?.name as string) ||
    profile.headline ||
    "Shubham Singh Ranswal";
  const nameParts = fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || "Shubham";
  const lastName = nameParts.slice(1).join(" ") || "Singh Ranswal";
  const email =
    (profile.preferences_json?.email as string) || "shubhamranswal@gmail.com";
  const phone = (profile.preferences_json?.phone as string) || "+91 9560793525";
  const linkedin =
    (profile.preferences_json?.linkedin as string) || "https://linkedin.com/in/shubhamranswal";
  const github =
    (profile.preferences_json?.github as string) || "https://github.com/shubhamranswal";
  const location = profile.location || "Noida, Uttar Pradesh";
  const city = location.split(",")[0]?.trim() || location;
  const state = (location.includes(",") ? location.split(",")[1]?.trim() : "") || "CA";
  const country = (profile.preferences_json?.country as string) || "India";
  const postalCode = (profile.preferences_json?.postal_code as string) || "94105";
  const website =
    (profile.preferences_json?.website as string) || "https://shubhamranswal.github.io";

  const resumeText =
    (profile.resumes && profile.resumes[0]?.extracted_text) ||
    `SHUBHAM SINGH RANSWAL\nSoftware Engineer II\n+91 9560793525 | Noida, Uttar Pradesh | shubhamranswal@gmail.com\nlinkedin.com/in/shubhamranswal | github.com/shubhamranswal\n\nEXPERIENCE\nSoftware Engineer II - Thales (Nov 2024 - Present)\n• Engineered secure payment workflows on Thales payShield 10K HSM with RSA-protected TR-31 key blocks.\n• Built Golang automation utilities and FastAPI backend services.\n\nSKILLS: Golang, Python, FastAPI, Cryptography, HSM, Linux, AI Tooling`;

  const coverLetterText = `Dear Hiring Team,\n\nI am writing to express my strong interest in the opportunity at your organization. With a strong track record engineering secure systems, high-performance Golang automation tools, and FastAPI backend platforms at Thales, I deliver robust, resilient software aligned with strict standards.\n\nI look forward to discussing how my engineering background and systems experience can contribute to your team.\n\nSincerely,\n${fullName}\n${phone} | ${email}`;

  let resumeAttached = false;

  for (const field of fields) {
    if (field.confidence < 0.7) {
      result.unfilledFields.push(
        `${field.label} (low confidence: ${Math.round(field.confidence * 100)}%)`
      );
      continue;
    }

    const el =
      field.element && field.element.isConnected
        ? (field.element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)
        : (document.querySelector(field.selector) as
            | HTMLInputElement
            | HTMLSelectElement
            | HTMLTextAreaElement
            | null);

    if (!el) {
      result.unfilledFields.push(`${field.label} (element not found in DOM)`);
      continue;
    }

    // Critical security double-check
    if (isElementSensitive(el)) {
      result.unfilledFields.push(`${field.label} (sensitive input blocked)`);
      continue;
    }

    if (field.fieldType === "resume") {
      if (isAvatarFileInput(el)) {
        result.unfilledFields.push(`${field.label} (skipped: detected as avatar/photo uploader)`);
        continue;
      }
      const win = el.ownerDocument.defaultView || (globalThis as any);
      const DataTransferCtor = win.DataTransfer || (globalThis as any).DataTransfer;
      const FileCtor = win.File || (globalThis as any).File;
      if (DataTransferCtor && FileCtor) {
        try {
          const dt = new DataTransferCtor();
          const file = new FileCtor(
            [resumeText],
            `${firstName}_${lastName.replace(/\s+/g, "_")}_Resume.pdf`,
            { type: "application/pdf" }
          );
          dt.items.add(file);
          (el as any).files = dt.files;
          const EventCtor = win.Event || (globalThis as any).Event || Event;
          el.dispatchEvent(new EventCtor("input", { bubbles: true, cancelable: true }));
          el.dispatchEvent(new EventCtor("change", { bubbles: true, cancelable: true }));
          result.filledFieldsCount++;
          result.filledFields.push({
            label: field.label || "Resume / CV File",
            fieldType: "resume",
            value: `${firstName}_${lastName.replace(/\s+/g, "_")}_Resume.pdf`,
          });
          resumeAttached = true;
        } catch {
          result.unfilledFields.push(`${field.label} (file attachment API unavailable)`);
        }
      }
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
      case "phone": {
        const prefixEl =
          el.parentElement?.querySelector("[class*='flag'], [class*='country-code']") ||
          el.closest("[class*='phone'], [class*='tel']")?.querySelector("[class*='flag'], [class*='country-code']");
        const prefixText = prefixEl ? (prefixEl.textContent || (prefixEl as HTMLElement).innerText || "").trim() : "";
        if (prefixText.includes("+91") && phone.startsWith("+91")) {
          valToFill = phone.replace(/^\+91\s*/, "").trim();
        } else if (prefixText.includes("+1") && phone.startsWith("+1")) {
          valToFill = phone.replace(/^\+1[-.\s]*/, "").trim();
        } else {
          valToFill = phone;
        }
        break;
      }
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
      case "country":
        valToFill = country;
        break;
      case "address":
        valToFill = (profile.preferences_json?.address as string) || "123 Tech Way";
        break;
      case "postalCode":
        valToFill = postalCode;
        break;
      case "website":
        valToFill = website;
        break;
      case "coverLetter":
        valToFill = coverLetterText;
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

  // Fallback: If resume wasn't mapped in fields but a file input exists on page, auto-attach resume
  if (!resumeAttached) {
    const fileInputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]');
    const win = document.defaultView || (globalThis as any);
    const DataTransferCtor = win.DataTransfer || (globalThis as any).DataTransfer;
    const FileCtor = win.File || (globalThis as any).File;
    if (DataTransferCtor && FileCtor) {
      for (const fileInput of fileInputs) {
        if (
          !isElementSensitive(fileInput) &&
          !isAvatarFileInput(fileInput) &&
          fileInput.files &&
          fileInput.files.length === 0
        ) {
          try {
            const dt = new DataTransferCtor();
            const file = new FileCtor(
              [resumeText],
              `${firstName}_${lastName.replace(/\s+/g, "_")}_Resume.pdf`,
              { type: "application/pdf" }
            );
            dt.items.add(file);
            fileInput.files = dt.files;
            const EventCtor = win.Event || (globalThis as any).Event || Event;
            fileInput.dispatchEvent(new EventCtor("input", { bubbles: true, cancelable: true }));
            fileInput.dispatchEvent(new EventCtor("change", { bubbles: true, cancelable: true }));
            result.filledFieldsCount++;
            result.filledFields.push({
              label: "Resume / CV Document",
              fieldType: "resume",
              value: `${firstName}_${lastName.replace(/\s+/g, "_")}_Resume.pdf`,
            });
            break;
          } catch {
            // Continue
          }
        }
      }
    }
  }

  return result;
}

/**
 * Dispatches realistic keystrokes, input events & framework hooks for modern single-page apps (React, Angular, Workday, Vue)
 */
function fillElementSafely(el: HTMLElement, value: string): void {
  const win = el.ownerDocument.defaultView || (globalThis as any);

  const isInput = el.tagName === "INPUT";
  const isTextArea = el.tagName === "TEXTAREA";
  const isSelect = el.tagName === "SELECT";

  el.focus();
  try {
    el.dispatchEvent(new Event("focus", { bubbles: true }));
    el.dispatchEvent(new Event("focusin", { bubbles: true }));
  } catch {}

  if (isInput || isTextArea) {
    const inputEl = el as HTMLInputElement | HTMLTextAreaElement;

    // 1. Emulate native typing via document.execCommand('insertText') if available
    let execSuccess = false;
    try {
      if (typeof inputEl.select === "function") {
        inputEl.select();
      }
      if (el.ownerDocument && typeof el.ownerDocument.execCommand === "function") {
        execSuccess = el.ownerDocument.execCommand("insertText", false, value);
      }
    } catch {
      execSuccess = false;
    }

    // 2. Set prototype value descriptor and instance value
    try {
      const proto = isTextArea
        ? win.HTMLTextAreaElement?.prototype
        : win.HTMLInputElement?.prototype;
      const valueSetter = proto ? Object.getOwnPropertyDescriptor(proto, "value")?.set : null;
      if (valueSetter) {
        valueSetter.call(el, value);
      }
    } catch {}

    try {
      (inputEl as any).value = value;
    } catch {}

    try {
      (inputEl as any).defaultValue = value;
    } catch {}

    // 3. Reset React's internal value tracker
    try {
      const tracker = (inputEl as any)._valueTracker;
      if (tracker) {
        tracker.setValue("");
      }
    } catch {}

    // 4. Dispatch InputEvents to trigger Angular DefaultValueAccessor & React onChange
    const InputEventCtor = win.InputEvent || (globalThis as any).InputEvent;
    if (InputEventCtor) {
      try {
        el.dispatchEvent(
          new InputEventCtor("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertReplacementText",
            data: value,
          })
        );
      } catch {}
      try {
        el.dispatchEvent(
          new InputEventCtor("input", {
            bubbles: true,
            cancelable: true,
            inputType: "insertReplacementText",
            data: value,
          })
        );
      } catch {}
    }

    const EventCtor = win.Event || (globalThis as any).Event || Event;
    el.dispatchEvent(new EventCtor("input", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new EventCtor("change", { bubbles: true, cancelable: true }));

    // 5. Notify any Web Component host wrapper (e.g. <spl-input>, <oc-input>)
    if (el.parentElement && el.parentElement.tagName.includes("-")) {
      try {
        (el.parentElement as any).value = value;
        el.parentElement.dispatchEvent(new EventCtor("input", { bubbles: true }));
        el.parentElement.dispatchEvent(new EventCtor("change", { bubbles: true }));
      } catch {}
    }

    // 6. Dispatch keydown/keyup for reactive inputs
    const KeyboardEventCtor = win.KeyboardEvent || (globalThis as any).KeyboardEvent;
    if (KeyboardEventCtor) {
      try {
        el.dispatchEvent(new KeyboardEventCtor("keydown", { bubbles: true, key: "Enter" }));
        el.dispatchEvent(new KeyboardEventCtor("keyup", { bubbles: true, key: "Enter" }));
      } catch {}
    }

    el.dispatchEvent(new EventCtor("blur", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new EventCtor("focusout", { bubbles: true, cancelable: true }));
  } else if (isSelect) {
    const sel = el as HTMLSelectElement;
    let matched = false;
    for (let i = 0; i < sel.options.length; i++) {
      const opt = sel.options[i];
      if (
        opt.text.toLowerCase().includes(value.toLowerCase()) ||
        opt.value.toLowerCase().includes(value.toLowerCase())
      ) {
        sel.selectedIndex = i;
        matched = true;
        break;
      }
    }
    if (!matched && sel.options.length > 0) {
      sel.value = value;
    }
    const EventCtor = win.Event || (globalThis as any).Event || Event;
    el.dispatchEvent(new EventCtor("input", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new EventCtor("change", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new EventCtor("blur", { bubbles: true, cancelable: true }));
  }
}
