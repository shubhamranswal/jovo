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
    exact: [
      "last name",
      "lastname",
      "family name",
      "legal last name",
      "surname",
      "lname",
    ],
    partial: ["last name", "family name", "last_name", "lastname", "surname", "lname"],
  },
  fullName: {
    exact: [
      "full name",
      "fullname",
      "legal name",
      "candidate name",
      "applicant name",
      "your name",
      "complete name",
      "name",
    ],
    partial: ["full name", "fullname", "applicant name", "candidate name"],
  },
  email: {
    exact: [
      "email",
      "email address",
      "contact email",
      "primary email",
      "work email",
      "confirm email",
      "confirm your email",
      "re enter email",
      "retype email",
      "verify email",
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
      "contact",
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
    exact: ["city", "town", "municipality", "city / town", "location city", "current city"],
    partial: ["city", "town"],
  },
  state: {
    exact: ["state", "province", "region", "state / province", "state/province"],
    partial: ["province", "region"],
  },
  country: {
    exact: ["country", "country / region", "nation", "country of residence", "location country"],
    partial: ["country", "nation"],
  },
  postalCode: {
    exact: ["postal code", "zip code", "zip", "postcode", "pin code", "pincode", "postal", "zipcode"],
    partial: ["postal", "postcode", "zip", "pincode"],
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
  resume: {
    exact: [
      "resume",
      "cv",
      "curriculum vitae",
      "upload resume",
      "attach resume",
      "resume cv",
      "choose a file",
      "drop it here",
      "upload cv",
    ],
    partial: ["resume", "cv", "curriculum vitae"],
  },
  coverLetter: {
    exact: [
      "cover letter",
      "cover_letter",
      "coverletter",
      "letter of intent",
      "additional information",
      "note to hiring manager",
      "message to recruiter",
      "why are you interested",
    ],
    partial: ["cover letter", "coverletter", "letter of intent", "note to hiring manager"],
  },
};

/**
 * Normalizes an input string: lowercase, collapses whitespace, strips non-alphanumeric punctuation and requirement disclaimers.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\(required\)|\(optional\)|\(mandatory\)|\*|required|optional/gi, "")
    .replace(/[_\-/:.]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Checks whether a given string is generic boilerplate/disclaimer text rather than a genuine field label.
 */
function isBoilerplateText(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower || lower.length < 2 || lower.length > 80) return true;
  return (
    lower.includes("marked with") ||
    lower.includes("are required") ||
    lower.includes("mandatory") ||
    lower.includes("personal information") ||
    lower.includes("choose an option") ||
    lower.includes("drag and drop") ||
    lower.includes("privacy policy") ||
    lower.includes("terms of service") ||
    lower.includes("all rights reserved")
  );
}

/**
 * Classifies a form field semantically using its accessible label, name, id,
 * data-automation-id, input type, autocomplete, and accept hints.
 */
export function classifyFieldSemantics(
  label: string,
  name: string,
  id: string,
  automationId: string,
  inputType: string,
  autocomplete: string = "",
  accept: string = ""
): FieldClassificationResult {
  const normLabel = normalizeText(label);
  const normName = normalizeText(name);
  const normId = normalizeText(id);
  const normAuto = normalizeText(automationId);
  const normAutoComp = normalizeText(autocomplete);

  // 1. Check HTML5 standard autocomplete attribute (highest confidence)
  if (normAutoComp) {
    if (normAutoComp === "given name" || normAutoComp === "first name") {
      return { fieldType: "firstName", confidence: 0.99, matchedBy: "attribute_id" };
    }
    if (normAutoComp === "family name" || normAutoComp === "last name") {
      return { fieldType: "lastName", confidence: 0.99, matchedBy: "attribute_id" };
    }
    if (normAutoComp === "name") {
      return { fieldType: "fullName", confidence: 0.95, matchedBy: "attribute_id" };
    }
    if (normAutoComp === "email") {
      return { fieldType: "email", confidence: 0.99, matchedBy: "attribute_id" };
    }
    if (normAutoComp === "tel" || normAutoComp === "tel national") {
      return { fieldType: "phone", confidence: 0.99, matchedBy: "attribute_id" };
    }
    if (normAutoComp === "address level2") {
      return { fieldType: "city", confidence: 0.95, matchedBy: "attribute_id" };
    }
    if (normAutoComp === "address level1") {
      return { fieldType: "state", confidence: 0.95, matchedBy: "attribute_id" };
    }
    if (normAutoComp === "postal code") {
      return { fieldType: "postalCode", confidence: 0.95, matchedBy: "attribute_id" };
    }
    if (normAutoComp === "country" || normAutoComp === "country name") {
      return { fieldType: "country", confidence: 0.95, matchedBy: "attribute_id" };
    }
  }

  // 2. Check exact matches on label (highest confidence)
  for (const [fieldType, synonyms] of Object.entries(FIELD_SYNONYMS) as Array<
    [SafeFieldType, SynonymGroup]
  >) {
    if (synonyms.exact.includes(normLabel)) {
      return { fieldType, confidence: 0.98, matchedBy: "exact_label" };
    }
  }

  // 3. Check exact matches on automationId / name / id
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

  // 4. Check HTML input types
  if (inputType === "email") {
    return { fieldType: "email", confidence: 0.95, matchedBy: "input_type" };
  }
  if (inputType === "tel") {
    return { fieldType: "phone", confidence: 0.95, matchedBy: "input_type" };
  }
  if (inputType === "file") {
    const combinedFile = `${normLabel} ${normName} ${normId} ${normAuto} ${accept}`.toLowerCase();

    // Strictly detect and reject avatar / profile photo / headshot inputs
    const isImageOnly =
      (accept &&
        (accept.includes("image") ||
          accept.includes("png") ||
          accept.includes("jpg") ||
          accept.includes("jpeg")) &&
        !accept.includes("pdf") &&
        !accept.includes("doc")) ||
      combinedFile.includes("avatar") ||
      combinedFile.includes("photo") ||
      combinedFile.includes("picture") ||
      combinedFile.includes("headshot") ||
      combinedFile.includes("profile pic") ||
      combinedFile.includes("profilepic") ||
      combinedFile.includes("profile image");

    if (isImageOnly) {
      return { fieldType: "unknown", confidence: 0.0, matchedBy: "none" };
    }

    if (combinedFile.includes("cover")) {
      return { fieldType: "coverLetter", confidence: 0.95, matchedBy: "input_type" };
    }
    return { fieldType: "resume", confidence: 0.95, matchedBy: "input_type" };
  }

  // 5. Check partial / substring matches on label and identifiers
  const combined = `${normLabel} ${normName} ${normAuto} ${normId}`;

  // Prioritize firstName and lastName before fullName
  if (
    normLabel.includes("first name") ||
    normLabel.includes("given name") ||
    normName.includes("first name") ||
    normName.includes("firstname") ||
    normName.includes("first_name") ||
    normName.includes("given name") ||
    normName.includes("givenname") ||
    normAuto.includes("first name") ||
    normAuto.includes("firstname") ||
    normName === "fname"
  ) {
    return { fieldType: "firstName", confidence: 0.92, matchedBy: "substring" };
  }

  if (
    normLabel.includes("last name") ||
    normLabel.includes("family name") ||
    normLabel.includes("surname") ||
    normName.includes("last name") ||
    normName.includes("lastname") ||
    normName.includes("last_name") ||
    normName.includes("family name") ||
    normName.includes("familyname") ||
    normName.includes("surname") ||
    normAuto.includes("last name") ||
    normAuto.includes("lastname") ||
    normName === "lname"
  ) {
    return { fieldType: "lastName", confidence: 0.92, matchedBy: "substring" };
  }

  // Confirm email or repeat email
  if (
    normLabel.includes("confirm email") ||
    normLabel.includes("confirm your email") ||
    normLabel.includes("re enter email") ||
    normLabel.includes("repeat email") ||
    normName.includes("confirm email") ||
    normName.includes("confirmemail") ||
    normId.includes("confirmemail")
  ) {
    return { fieldType: "email", confidence: 0.95, matchedBy: "substring" };
  }

  // Phone number
  if (
    normLabel.includes("phone") ||
    normLabel.includes("mobile") ||
    normLabel.includes("cell") ||
    normLabel.includes("telephone") ||
    normName.includes("phone") ||
    normName.includes("mobile") ||
    normName.includes("telephone") ||
    normAuto.includes("phone") ||
    normAuto.includes("mobile")
  ) {
    return { fieldType: "phone", confidence: 0.92, matchedBy: "substring" };
  }

  // City
  if (
    normLabel.includes("city") ||
    normLabel.includes("town") ||
    normName.includes("city") ||
    normName.includes("town") ||
    normAuto.includes("city")
  ) {
    return { fieldType: "city", confidence: 0.92, matchedBy: "substring" };
  }

  // State
  if (
    normLabel.includes("state") ||
    normLabel.includes("province") ||
    normName.includes("state") ||
    normName.includes("province") ||
    normAuto.includes("state")
  ) {
    return { fieldType: "state", confidence: 0.92, matchedBy: "substring" };
  }

  // Country (strictly excluding phone country code search filter inputs)
  const isCountrySearchFilter =
    normLabel.includes("search by country") ||
    normLabel.includes("search country") ||
    normLabel.includes("country or code") ||
    normLabel.includes("region or code") ||
    normLabel.includes("filter country") ||
    normName.includes("countrycode") ||
    normName.includes("country_code");

  if (!isCountrySearchFilter) {
    if (
      normLabel.includes("country") ||
      normLabel.includes("nation") ||
      normName.includes("country") ||
      normName.includes("nation") ||
      normAuto.includes("country")
    ) {
      return { fieldType: "country", confidence: 0.92, matchedBy: "substring" };
    }
  }

  // Postal code / Zip
  if (
    normLabel.includes("postal") ||
    normLabel.includes("zip") ||
    normLabel.includes("pincode") ||
    normLabel.includes("postcode") ||
    normName.includes("postal") ||
    normName.includes("zip") ||
    normName.includes("pincode")
  ) {
    return { fieldType: "postalCode", confidence: 0.92, matchedBy: "substring" };
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
 * 1. aria-label / aria-placeholder
 * 2. aria-labelledby
 * 3. label[for="..."]
 * 4. enclosing <label>
 * 5. direct sibling elements (previous or floating next)
 * 6. hierarchical ancestor tree search (up to 4 levels) checking for associated labels & preceding sibling columns
 * 7. placeholder
 * 8. semantic attribute hints (autocomplete, formcontrolname, name, id)
 */
export function extractAccessibleLabel(el: HTMLElement, doc: Document): string {
  // 1. aria-label directly on input
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel && !isBoilerplateText(ariaLabel)) {
    return ariaLabel.trim();
  }

  // 2. aria-placeholder
  const ariaPl = el.getAttribute("aria-placeholder");
  if (ariaPl && !isBoilerplateText(ariaPl)) {
    return ariaPl.trim();
  }

  // 3. aria-labelledby
  const ariaLabelledBy = el.getAttribute("aria-labelledby");
  if (ariaLabelledBy) {
    const labelledEl = doc.getElementById(ariaLabelledBy);
    if (labelledEl) {
      const text = (labelledEl.textContent || (labelledEl as HTMLElement).innerText || "").trim();
      if (!isBoilerplateText(text)) return text;
    }
  }

  // 4. label[for="id"]
  if (el.id) {
    try {
      const safeId = el.id.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, "\\$1");
      const labelEl = doc.querySelector(`label[for="${safeId}"]`);
      if (labelEl) {
        const text = (labelEl.textContent || (labelEl as HTMLElement).innerText || "").trim();
        if (!isBoilerplateText(text)) return text;
      }
    } catch {
      // Fallback
    }
  }

  // 5. Enclosing <label>
  const parentLabel = el.closest("label");
  if (parentLabel) {
    const text = (parentLabel.textContent || parentLabel.innerText || "").trim();
    if (!isBoilerplateText(text)) return text;
  }

  // 6. Direct previous element sibling
  if (el.previousElementSibling) {
    const prev = el.previousElementSibling as HTMLElement;
    const text = (prev.textContent || prev.innerText || "").trim();
    if (!isBoilerplateText(text)) return text;
  }

  // 7. Direct next element sibling (floating label pattern in Material UI / Bootstrap 5)
  if (el.nextElementSibling) {
    const next = el.nextElementSibling as HTMLElement;
    if (next.tagName.toLowerCase() === "label" || next.className?.includes?.("label")) {
      const text = (next.textContent || next.innerText || "").trim();
      if (!isBoilerplateText(text)) return text;
    }
  }

  // 8. Hierarchical Ancestor Tree Search (climb up to 4 levels for SPA form controls)
  let curr: HTMLElement | null = el.parentElement;
  let depth = 0;
  while (curr && depth < 4) {
    // Check preceding element sibling of this ancestor container (e.g. two-column label/input layout)
    if (curr.previousElementSibling) {
      const prevContainer = curr.previousElementSibling as HTMLElement;
      const prevLbl = prevContainer.querySelector("label, legend, span[class*='label'], p[class*='label']");
      const text = (
        (prevLbl ? prevLbl.textContent || (prevLbl as HTMLElement).innerText : prevContainer.textContent || prevContainer.innerText) || ""
      ).trim();
      if (!isBoilerplateText(text)) {
        return text;
      }
    }

    // Check if this container has a dedicated single label
    const labels = curr.querySelectorAll("label, legend, span[class*='label'], p[class*='label']");
    if (labels.length === 1) {
      const text = (labels[0].textContent || (labels[0] as HTMLElement).innerText || "").trim();
      if (!isBoilerplateText(text)) {
        return text;
      }
    }

    if (curr.tagName.toLowerCase() === "label") {
      const text = (curr.textContent || curr.innerText || "").trim();
      if (!isBoilerplateText(text)) {
        return text;
      }
    }

    curr = curr.parentElement;
    depth++;
  }

  // 9. placeholder
  const placeholder = el.getAttribute("placeholder");
  if (placeholder && !isBoilerplateText(placeholder)) {
    return placeholder.trim();
  }

  // 10. Semantic attributes directly on element
  const hints = [
    el.getAttribute("autocomplete"),
    el.getAttribute("formcontrolname"),
    el.getAttribute("ng-reflect-name"),
    el.getAttribute("data-test"),
    el.getAttribute("data-testid"),
    el.getAttribute("name"),
    el.id,
    el.getAttribute("title"),
  ];
  for (const h of hints) {
    if (h && h.trim()) {
      return h.trim();
    }
  }

  return "";
}
