/**
 * Generic ATS Adapter
 * Fallback for Greenhouse, Lever, standard company careers pages, etc.
 */

import type {
  DetectedFormField,
  DetectedQuestion,
  ExtractedJobMetadata,
  SafeFieldType,
} from "../../types";
import { isElementSensitive, isGenuineApplicationQuestion } from "../security";
import type { AtsAdapter } from "./types";

export class GenericAdapter implements AtsAdapter {
  name = "Generic";

  matches(_url: string, _document: Document): boolean {
    return true; // Always matches as fallback
  }

  extractJob(url: string, document: Document): ExtractedJobMetadata {
    // 1. Job Title
    const titleEl =
      document.querySelector('meta[property="og:title"]') ||
      document.querySelector("h1") ||
      document.querySelector("h2");
    let title = "";
    if (titleEl) {
      title =
        titleEl.tagName === "META"
          ? (titleEl as HTMLMetaElement).content || ""
          : (titleEl as HTMLElement).textContent || (titleEl as HTMLElement).innerText || "";
    }
    if (!title) {
      title = document.title || "Job Application";
    }

    // 2. Company Name
    const companyMeta =
      document.querySelector('meta[property="og:site_name"]') ||
      document.querySelector('meta[name="author"]');
    let company = "";
    if (companyMeta) {
      company = (companyMeta as HTMLMetaElement).content || "";
    }
    if (!company) {
      try {
        const parsed = new URL(url);
        const parts = parsed.hostname.split(".");
        const extracted = parts.length > 1 ? parts[parts.length - 2] : parts[0];
        company = extracted ? extracted.charAt(0).toUpperCase() + extracted.slice(1) : "Company";
      } catch {
        company = "Company";
      }
    }

    // 3. Location
    const locEl =
      document.querySelector('[class*="location"]') || document.querySelector('[id*="location"]');
    const location = locEl
      ? ((locEl as HTMLElement).textContent || (locEl as HTMLElement).innerText || "").trim()
      : undefined;

    // 4. Description snippet
    const descEl =
      document.querySelector('[class*="description"]') ||
      document.querySelector("main") ||
      document.querySelector("article");
    const rawDesc = descEl
      ? (descEl as HTMLElement).textContent || (descEl as HTMLElement).innerText || ""
      : document.body?.textContent || document.body?.innerText || "";
    const descriptionSnippet = rawDesc.slice(0, 1000).trim();

    return {
      url,
      title: title.trim(),
      company: company.trim(),
      location,
      descriptionSnippet,
      isWorkday: false,
    };
  }

  detectFormFields(document: Document): DetectedFormField[] {
    const fields: DetectedFormField[] = [];
    const inputs = document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="password"]):not([type="file"]), select'
    );

    for (const el of inputs) {
      if (isElementSensitive(el)) {
        continue;
      }

      const name = el.getAttribute("name") || "";
      const id = el.id || "";
      const label = this.getLabelForElement(el);
      const type = (el as HTMLInputElement).type || "text";

      const match = this.classifyField(name, id, label, type);
      if (match.fieldType !== "unknown" && match.confidence >= 0.7) {
        const selector = id ? `#${id}` : name ? `${el.tagName.toLowerCase()}[name="${name}"]` : "";

        if (selector && !fields.some((f) => f.selector === selector)) {
          fields.push({
            name: name || id || match.fieldType,
            label: label || name || id,
            fieldType: match.fieldType,
            confidence: match.confidence,
            selector,
            currentValue: el.value,
          });
        }
      }
    }

    return fields;
  }

  detectQuestions(document: Document): DetectedQuestion[] {
    const questions: DetectedQuestion[] = [];
    const textareas = document.querySelectorAll<HTMLTextAreaElement>("textarea");

    let idx = 0;
    for (const ta of textareas) {
      if (isElementSensitive(ta)) {
        continue;
      }

      const label = this.getLabelForElement(ta) || `Application Question #${idx + 1}`;
      if (!isGenuineApplicationQuestion(label)) {
        continue;
      }

      idx++;
      const selector = ta.id
        ? `#${ta.id}`
        : ta.name
          ? `textarea[name="${ta.name}"]`
          : `textarea:nth-of-type(${idx})`;

      questions.push({
        id: `q-${idx}`,
        questionText: label,
        selector,
        currentValue: ta.value,
      });
    }

    return questions;
  }

  private getLabelForElement(el: HTMLElement): string {
    const doc = el.ownerDocument || document;
    if (el.id) {
      const labelEl = doc.querySelector(`label[for="${el.id}"]`);
      if (labelEl) return (labelEl.textContent || (labelEl as HTMLElement).innerText || "").trim();
    }
    const parentLabel = el.closest("label");
    if (parentLabel) return (parentLabel.textContent || parentLabel.innerText || "").trim();

    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel.trim();

    const placeholder = el.getAttribute("placeholder");
    if (placeholder) return placeholder.trim();

    const container = el.parentElement;
    if (container) {
      const labelTag = container.querySelector("label, span, p");
      if (labelTag)
        return (labelTag.textContent || (labelTag as HTMLElement).innerText || "").trim();
    }

    return "";
  }

  private classifyField(
    name: string,
    id: string,
    label: string,
    type: string
  ): { fieldType: SafeFieldType | "unknown"; confidence: number } {
    const text = `${name} ${id} ${label}`.toLowerCase();

    if (type === "email" || text.includes("email")) {
      return { fieldType: "email", confidence: 0.95 };
    }
    if (type === "tel" || text.includes("phone") || text.includes("mobile")) {
      return { fieldType: "phone", confidence: 0.95 };
    }
    if (text.includes("first name") || text.includes("firstname") || text.includes("fname")) {
      return { fieldType: "firstName", confidence: 0.95 };
    }
    if (text.includes("last name") || text.includes("lastname") || text.includes("lname")) {
      return { fieldType: "lastName", confidence: 0.95 };
    }
    if (text.includes("full name") || text.includes("fullname") || text === "name") {
      return { fieldType: "fullName", confidence: 0.9 };
    }
    if (text.includes("linkedin")) {
      return { fieldType: "linkedin", confidence: 0.95 };
    }
    if (text.includes("github")) {
      return { fieldType: "github", confidence: 0.95 };
    }
    if (text.includes("website") || text.includes("portfolio")) {
      return { fieldType: "website", confidence: 0.9 };
    }
    if (text.includes("address line") || text.includes("street")) {
      return { fieldType: "address", confidence: 0.9 };
    }
    if (text.includes("city")) {
      return { fieldType: "city", confidence: 0.9 };
    }
    if (text.includes("postal") || text.includes("zip")) {
      return { fieldType: "postalCode", confidence: 0.9 };
    }

    return { fieldType: "unknown", confidence: 0.0 };
  }
}
