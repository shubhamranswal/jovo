/**
 * Workday ATS Adapter
 *
 * Implements robust semantic matching for Workday application portals:
 * - data-automation-id selectors (Workday's canonical accessibility/test hooks)
 * - Semantic aria-labels and field labels
 * - Nearby text matching
 * - Avoids brittle CSS classes
 */

import type {
  DetectedFormField,
  DetectedQuestion,
  ExtractedJobMetadata,
  SafeFieldType,
} from "../../types";
import type { AtsAdapter } from "./types";

export class WorkdayAdapter implements AtsAdapter {
  name = "Workday";

  matches(url: string, document: Document): boolean {
    const isUrlMatch =
      url.includes("myworkdayjobs.com") ||
      url.includes("workday.com") ||
      url.includes("/job/") ||
      url.includes("/apply");

    const hasWorkdayDom =
      !!document.querySelector("[data-automation-id]") ||
      !!document.querySelector('meta[content*="Workday"]') ||
      !!document.querySelector('[id*="workday"]');

    return isUrlMatch || hasWorkdayDom;
  }

  extractJob(url: string, document: Document): ExtractedJobMetadata {
    // 1. Job Title
    const titleEl =
      document.querySelector('[data-automation-id="jobPostingHeader"]') ||
      document.querySelector('h1[data-automation-id="jobTitle"]') ||
      document.querySelector("h1") ||
      document.querySelector('meta[property="og:title"]');

    let title = "Unknown Title";
    if (titleEl) {
      if (titleEl.tagName === "META") {
        title = (titleEl as HTMLMetaElement).content || "";
      } else {
        const rawText =
          (titleEl as HTMLElement).textContent || (titleEl as HTMLElement).innerText || "";
        title = rawText.trim();
      }
    }

    // 2. Company Name
    // Workday URLs usually formatted: https://{company}.wd1.myworkdayjobs.com/...
    let company = "";
    try {
      const parsedUrl = new URL(url);
      const hostParts = parsedUrl.hostname.split(".");
      const firstPart = hostParts[0];
      const secondPart = hostParts[1];
      if (hostParts.length > 2 && secondPart && secondPart.startsWith("wd") && firstPart) {
        company = firstPart.replace(/[-_]/g, " ");
        company = company.charAt(0).toUpperCase() + company.slice(1);
      }
    } catch {
      // Fallback
    }

    if (!company) {
      const companyEl =
        document.querySelector('[data-automation-id="companyName"]') ||
        document.querySelector('meta[property="og:site_name"]');
      if (companyEl) {
        const rawComp =
          (companyEl as HTMLElement).textContent ||
          (companyEl as HTMLElement).innerText ||
          (companyEl as HTMLMetaElement).content ||
          "";
        company = rawComp.trim();
      }
    }

    if (!company) {
      company = "Company";
    }

    // 3. Location
    const locEl =
      document.querySelector('[data-automation-id="locations"]') ||
      document.querySelector('[data-automation-id="jobPostingLocation"]');
    const location = locEl
      ? ((locEl as HTMLElement).textContent || (locEl as HTMLElement).innerText || "").trim()
      : undefined;

    // 4. Job Posting Description
    const descEl =
      document.querySelector('[data-automation-id="jobPostingDescription"]') ||
      document.querySelector('[data-automation-id="jobDescription"]') ||
      document.querySelector('section[data-automation-id="jobPosting"]');
    const rawDesc = descEl
      ? (descEl as HTMLElement).textContent || (descEl as HTMLElement).innerText || ""
      : document.body?.textContent || document.body?.innerText || "";
    const descriptionSnippet = rawDesc.slice(0, 1000).trim();

    // 5. External ID / Job Req ID
    const reqEl = document.querySelector('[data-automation-id="requisitionId"]');
    const externalId = reqEl
      ? ((reqEl as HTMLElement).textContent || (reqEl as HTMLElement).innerText || "").trim()
      : undefined;

    return {
      url,
      title,
      company,
      location,
      descriptionSnippet,
      externalId,
      isWorkday: true,
    };
  }

  detectFormFields(document: Document): DetectedFormField[] {
    const fields: DetectedFormField[] = [];

    // Semantic map based on data-automation-id or name or label
    const workdayFieldMap: Array<{
      selector: string;
      fieldType: SafeFieldType;
      confidence: number;
    }> = [
      {
        selector: '[data-automation-id="legalNameSection_firstName"]',
        fieldType: "firstName",
        confidence: 0.95,
      },
      {
        selector: '[data-automation-id="legalNameSection_lastName"]',
        fieldType: "lastName",
        confidence: 0.95,
      },
      { selector: '[data-automation-id="email"]', fieldType: "email", confidence: 0.98 },
      { selector: '[data-automation-id="phone-number"]', fieldType: "phone", confidence: 0.95 },
      { selector: '[data-automation-id="phoneNumber"]', fieldType: "phone", confidence: 0.95 },
      {
        selector: '[data-automation-id="addressSection_addressLine1"]',
        fieldType: "address",
        confidence: 0.95,
      },
      {
        selector: '[data-automation-id="addressSection_city"]',
        fieldType: "city",
        confidence: 0.95,
      },
      {
        selector: '[data-automation-id="addressSection_postalCode"]',
        fieldType: "postalCode",
        confidence: 0.95,
      },
      {
        selector: '[data-automation-id="linkedinQuestion"]',
        fieldType: "linkedin",
        confidence: 0.9,
      },
      { selector: '[data-automation-id="githubQuestion"]', fieldType: "github", confidence: 0.9 },
    ];

    for (const mapping of workdayFieldMap) {
      const el = document.querySelector(mapping.selector) as HTMLInputElement | null;
      if (el) {
        fields.push({
          name:
            el.getAttribute("name") || el.getAttribute("data-automation-id") || mapping.fieldType,
          label: this.getLabelForElement(el),
          fieldType: mapping.fieldType,
          confidence: mapping.confidence,
          selector: mapping.selector,
          currentValue: el.value,
        });
      }
    }

    // Also scan all inputs inside forms
    const allInputs = document.querySelectorAll<HTMLInputElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="password"])'
    );
    for (const input of allInputs) {
      const automationId = input.getAttribute("data-automation-id") || "";
      const name = input.getAttribute("name") || "";
      const label = this.getLabelForElement(input);

      // Skip already matched
      if (fields.some((f) => f.selector.includes(automationId) && automationId !== "")) {
        continue;
      }

      const match = this.classifyInputField(automationId, name, label, input.type);
      if (match.fieldType !== "unknown" && match.confidence >= 0.7) {
        const selector = automationId
          ? `[data-automation-id="${automationId}"]`
          : name
            ? `input[name="${name}"]`
            : "";
        if (selector && !fields.some((f) => f.selector === selector)) {
          fields.push({
            name: name || automationId || match.fieldType,
            label: label || name || automationId,
            fieldType: match.fieldType,
            confidence: match.confidence,
            selector,
            currentValue: input.value,
          });
        }
      }
    }

    return fields;
  }

  detectQuestions(document: Document): DetectedQuestion[] {
    const questions: DetectedQuestion[] = [];

    // Workday textareas or question groups
    const textareas = document.querySelectorAll<HTMLTextAreaElement>("textarea");
    let idx = 0;
    for (const ta of textareas) {
      idx++;
      const label = this.getLabelForElement(ta) || `Application Question #${idx}`;
      const automationId = ta.getAttribute("data-automation-id");
      const selector = automationId
        ? `textarea[data-automation-id="${automationId}"]`
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
      if (labelEl) {
        return (labelEl.textContent || (labelEl as HTMLElement).innerText || "").trim();
      }
    }
    const parentLabel = el.closest("label");
    if (parentLabel) {
      return (parentLabel.textContent || parentLabel.innerText || "").trim();
    }

    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel.trim();

    const placeholder = el.getAttribute("placeholder");
    if (placeholder) return placeholder.trim();

    // Check preceding sibling or parent container heading
    const container = el.closest("[data-automation-id]") || el.parentElement;
    if (container) {
      const heading = container.querySelector("label, h2, h3, h4, span");
      if (heading) {
        return (heading.textContent || (heading as HTMLElement).innerText || "").trim();
      }
    }

    return "";
  }

  private classifyInputField(
    automationId: string,
    name: string,
    label: string,
    type: string
  ): { fieldType: SafeFieldType | "unknown"; confidence: number } {
    const text = `${automationId} ${name} ${label}`.toLowerCase();

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
