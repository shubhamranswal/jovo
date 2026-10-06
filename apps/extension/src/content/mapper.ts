/**
 * Semantic Field Mapper for JobOS Extension
 *
 * Maps form inputs to verified CareerProfile fields using semantic dictionaries,
 * HTML attributes, and confidence scoring.
 * Enforces confidence threshold >= 0.70.
 */

import type { SafeFieldType } from "../types";

export interface FieldClassificationResult {
  fieldType: SafeFieldType | "unknown";
  confidence: number;
  matchedBy: "exact_label" | "attribute_id" | "input_type" | "substring" | "none";
}

// Canonical semantic dictionary: normalized search term -> SafeFieldType
interface SynonymGroup {
  exact: string[];
  partial: string[];
}

const FIELD_SYNONYMS: Record<SafeFieldType, SynonymGroup> = {
  firstName: {
    exact: [
      "first name",
      "firstname",
      "given name",
      "legal first name",
      "preferred first name",
      "forename",
      "fname",
    ],
    partial: ["first name", "given name", "first_name", "firstname", "fname"],
  },
  lastName: {
    exact: ["last name", "lastname", "family name", "legal last name", "surname", "lname"],
    partial: ["last name", "family name", "last_name", "lastname", "surname", "lname"],
  },
  fullName: {
    exact: [
      "full name",
      "fullname",
      "legal name",
      "candidate name",
      "your name",
      "complete name",
      "name",
    ],
    partial: ["full name", "fullname", "applicant name"],
  },
  email: {
    exact: [
      "email",
      "email address",
      "contact email",
      "primary email",
      "work email",
      "e-mail",
      "mail",
    ],
    partial: ["email", "e-mail"],
  },
  phone: {
    exact: [
      "phone",
      "phone number",
      "mobile",
      "mobile number",
      "cell phone",
      "cell",
      "telephone",
      "contact number",
      "primary phone",
      "tel",
    ],
    partial: ["phone", "mobile", "telephone", "cellphone"],
  },
  address: {
    exact: [
      "address",
      "street address",
      "address line 1",
      "address line",
      "physical address",
      "mailing address",
      "street",
      "home address",
    ],
    partial: ["address line", "street address", "address_1"],
  },
  city: {
    exact: ["city", "town", "municipality", "city / town", "location city"],
    partial: ["city", "town"],
  },
  state: {
    exact: ["state", "province", "region", "state / province", "state/province"],
    partial: ["province", "region"],
  },
  postalCode: {
    exact: ["postal code", "zip code", "zip", "postcode", "pin code", "postal", "zipcode"],
    partial: ["postal", "postcode", "zip"],
  },
  linkedin: {
    exact: ["linkedin", "linkedin url", "linkedin profile", "linkedin link", "linkedin account"],
    partial: ["linkedin"],
  },
  github: {
    exact: ["github", "github url", "github profile", "github link", "github account"],
    partial: ["github"],
  },
  website: {
    exact: [
      "website",
      "portfolio",
      "personal website",
      "portfolio url",
      "personal site",
      "blog",
      "personal url",
      "website url",
    ],
    partial: ["portfolio", "website", "blog"],
  },
};

/**
 * Normalizes an input string: lowercase, collapses whitespace, strips non-alphanumeric punctuation.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[_\-/:]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Classifies a form field semantically using its accessible label, name, id,
 * data-automation-id, and input type.
 */
export function classifyFieldSemantics(
  label: string,
  name: string,
  id: string,
  automationId: string,
  inputType: string
): FieldClassificationResult {
  const normLabel = normalizeText(label);
  const normName = normalizeText(name);
  const normId = normalizeText(id);
  const normAuto = normalizeText(automationId);

  // 1. Check exact matches on label (highest confidence)
  for (const [fieldType, synonyms] of Object.entries(FIELD_SYNONYMS) as Array<
    [SafeFieldType, SynonymGroup]
  >) {
    if (synonyms.exact.includes(normLabel)) {
      return { fieldType, confidence: 0.98, matchedBy: "exact_label" };
    }
  }

  // 2. Check exact matches on automationId / name / id
  for (const [fieldType, synonyms] of Object.entries(FIELD_SYNONYMS) as Array<
    [SafeFieldType, SynonymGroup]
  >) {
    if (
      synonyms.exact.includes(normAuto) ||
      synonyms.exact.includes(normName) ||
      synonyms.exact.includes(normId)
    ) {
      return { fieldType, confidence: 0.95, matchedBy: "attribute_id" };
    }
  }

  // 3. Check HTML input types
  if (inputType === "email") {
    return { fieldType: "email", confidence: 0.95, matchedBy: "input_type" };
  }
  if (inputType === "tel") {
    return { fieldType: "phone", confidence: 0.95, matchedBy: "input_type" };
  }

  // 4. Check partial / substring matches on label and identifiers
  const combined = `${normLabel} ${normName} ${normAuto} ${normId}`;

  // Prioritize firstName and lastName before fullName
  if (
    normLabel.includes("first name") ||
    normLabel.includes("given name") ||
    normName.includes("firstname") ||
    normAuto.includes("firstname") ||
    normName === "fname"
  ) {
    return { fieldType: "firstName", confidence: 0.92, matchedBy: "substring" };
  }

  if (
    normLabel.includes("last name") ||
    normLabel.includes("family name") ||
    normLabel.includes("surname") ||
    normName.includes("lastname") ||
    normAuto.includes("lastname") ||
    normName === "lname"
  ) {
    return { fieldType: "lastName", confidence: 0.92, matchedBy: "substring" };
  }

  for (const [fieldType, synonyms] of Object.entries(FIELD_SYNONYMS) as Array<
    [SafeFieldType, SynonymGroup]
  >) {
    for (const p of synonyms.partial) {
      if (combined.includes(p)) {
        return { fieldType, confidence: 0.85, matchedBy: "substring" };
      }
    }
  }

  return { fieldType: "unknown", confidence: 0.0, matchedBy: "none" };
}

/**
 * Extracts accessible label for an input element with layered fallbacks:
 * 1. label[for="..."]
 * 2. enclosing <label>
 * 3. aria-labelledby
 * 4. aria-label
 * 5. placeholder
 * 6. nearby preceding text or container heading
 */
export function extractAccessibleLabel(el: HTMLElement, doc: Document): string {
  // 1. label[for="id"]
  if (el.id) {
    const labelEl = doc.querySelector(`label[for="${el.id}"]`);
    if (labelEl) {
      const text = (labelEl.textContent || (labelEl as HTMLElement).innerText || "").trim();
      if (text) return text;
    }
  }

  // 2. Enclosing <label>
  const parentLabel = el.closest("label");
  if (parentLabel) {
    const text = (parentLabel.textContent || parentLabel.innerText || "").trim();
    if (text) return text;
  }

  // 3. aria-labelledby
  const ariaLabelledBy = el.getAttribute("aria-labelledby");
  if (ariaLabelledBy) {
    const labelledEl = doc.getElementById(ariaLabelledBy);
    if (labelledEl) {
      const text = (labelledEl.textContent || (labelledEl as HTMLElement).innerText || "").trim();
      if (text) return text;
    }
  }

  // 4. aria-label
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel && ariaLabel.trim()) {
    return ariaLabel.trim();
  }

  // 5. placeholder
  const placeholder = el.getAttribute("placeholder");
  if (placeholder && placeholder.trim()) {
    return placeholder.trim();
  }

  // 6. Nearby heading or preceding label in container
  const container = el.closest("[data-automation-id], .form-group, .form-row, fieldset, div");
  if (container) {
    const heading = container.querySelector("label, legend, span.label, span, h3, h4");
    if (heading && heading !== el) {
      const text = (heading.textContent || (heading as HTMLElement).innerText || "").trim();
      if (text && text.length < 80) return text;
    }
  }

  return "";
}
