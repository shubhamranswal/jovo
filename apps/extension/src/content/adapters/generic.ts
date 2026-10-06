/**
 * Generic ATS Adapter
 * Fallback for Greenhouse, Lever, standard company careers pages, etc.
 * Uses semantic classification, excludes non-application forms (search, login, cookie, newsletter).
 */

import type { DetectedFormField, DetectedQuestion, ExtractedJobMetadata } from "../../types";
import { classifyFieldSemantics, extractAccessibleLabel } from "../mapper";
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

    // Find candidate application forms or container
    const applicationForm = this.findApplicationForm(document);
    const scope: Document | HTMLElement = applicationForm || document;

    const inputs = scope.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="password"]):not([type="file"]), select'
    );

    for (const el of inputs) {
      if (isElementSensitive(el)) {
        continue;
      }

      // Skip elements clearly in search or navigation headers
      if (this.isInUnrelatedSection(el)) {
        continue;
      }

      const name = el.getAttribute("name") || "";
      const id = el.id || "";
      const label = extractAccessibleLabel(el, document);
      const type = (el as HTMLInputElement).type || "text";

      const classification = classifyFieldSemantics(label, name, id, "", type);
      if (classification.fieldType !== "unknown" && classification.confidence >= 0.7) {
        const selector = id ? `#${id}` : name ? `${el.tagName.toLowerCase()}[name="${name}"]` : "";

        if (selector && !fields.some((f) => f.selector === selector)) {
          fields.push({
            name: name || id || classification.fieldType,
            label: label || name || id || classification.fieldType,
            fieldType: classification.fieldType,
            confidence: classification.confidence,
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
    const applicationForm = this.findApplicationForm(document);
    const scope: Document | HTMLElement = applicationForm || document;

    const textareas = scope.querySelectorAll<HTMLTextAreaElement>("textarea");

    let idx = 0;
    for (const ta of textareas) {
      if (isElementSensitive(ta) || this.isInUnrelatedSection(ta)) {
        continue;
      }

      const label = extractAccessibleLabel(ta, document) || `Application Question #${idx + 1}`;
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

  /**
   * Identifies primary application form, ignoring login/search/newsletter forms.
   */
  private findApplicationForm(doc: Document): HTMLElement | null {
    const forms = doc.querySelectorAll<HTMLFormElement>("form");
    for (const form of forms) {
      const formText = (
        form.getAttribute("id") +
        " " +
        form.getAttribute("name") +
        " " +
        form.getAttribute("class") +
        " " +
        form.getAttribute("action")
      ).toLowerCase();

      // Skip search forms, login forms, newsletter forms
      if (
        form.getAttribute("role") === "search" ||
        formText.includes("search") ||
        formText.includes("login") ||
        formText.includes("signin") ||
        formText.includes("newsletter") ||
        formText.includes("subscribe") ||
        formText.includes("cookie")
      ) {
        continue;
      }

      // Check if it has email or resume or submit inputs
      const hasJobInputs = form.querySelector(
        'input[type="email"], input[name*="name"], textarea, input[type="file"]'
      );
      if (hasJobInputs) {
        return form;
      }
    }

    return null;
  }

  private isInUnrelatedSection(el: HTMLElement): boolean {
    const parentContainer = el.closest(
      'header, nav, footer, [role="search"], [id*="cookie"], [class*="cookie"], [id*="search"], [id*="newsletter"]'
    );
    return parentContainer !== null;
  }
}
