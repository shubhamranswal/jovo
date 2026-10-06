/**
 * Workday ATS Adapter
 *
 * Implements resilient semantic matching for Workday application portals:
 * - data-automation-id selectors (Workday's canonical accessibility hooks)
 * - Semantic aria-labels, field labels, and accessible names via mapper
 * - Layered company name extraction (DOM attributes first, subdomain fallback)
 * - Excludes sensitive inputs and security fields
 */

import type {
  DetectedFormField,
  DetectedQuestion,
  ExtractedJobMetadata,
  SafeFieldType,
} from "../../types";
import { classifyFieldSemantics, extractAccessibleLabel } from "../mapper";
import { isElementSensitive, isGenuineApplicationQuestion } from "../security";
import type { AtsAdapter } from "./types";

export class WorkdayAdapter implements AtsAdapter {
  name = "Workday";

  matches(url: string, document: Document): boolean {
    const isUrlMatch =
      url.includes("myworkdayjobs.com") ||
      url.includes("workday.com") ||
      (url.includes("/job/") && url.includes("workday")) ||
      url.includes("/apply");

    const hasWorkdayDom =
      !!document.querySelector("[data-automation-id]") ||
      !!document.querySelector('meta[content*="Workday"]') ||
      !!document.querySelector('meta[name="author"][content*="Workday"]') ||
      !!document.querySelector('[id*="workday"]') ||
      !!document.querySelector('[class*="workday"]');

    return isUrlMatch || hasWorkdayDom;
  }

  extractJob(url: string, document: Document): ExtractedJobMetadata {
    // 1. Job Title
    const titleEl =
      document.querySelector('[data-automation-id="jobPostingHeader"] h1') ||
      document.querySelector('h1[data-automation-id="jobTitle"]') ||
      document.querySelector('[data-automation-id="jobPostingHeader"]') ||
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
    // Check explicit Workday DOM element or meta tags first for high fidelity
    let company = "";
    const companyEl =
      document.querySelector('[data-automation-id="companyName"]') ||
      document.querySelector('[data-automation-id="tenantHeader"]') ||
      document.querySelector('[data-automation-id="legalEntity"]') ||
      document.querySelector('meta[property="og:site_name"]');

    if (companyEl) {
      const rawComp =
        companyEl.tagName === "META"
          ? (companyEl as HTMLMetaElement).content
          : (companyEl as HTMLElement).textContent || (companyEl as HTMLElement).innerText || "";
      company = (rawComp || "").trim();
    }

    // Fallback: parse from Workday URL subdomain: https://{company}.wd1.myworkdayjobs.com/...
    if (!company) {
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

    // Canonical Workday automation ID bindings
    const canonicalWorkdaySelectors: Array<{
      selector: string;
      fieldType: SafeFieldType;
      confidence: number;
    }> = [
      {
        selector: '[data-automation-id="legalNameSection_firstName"]',
        fieldType: "firstName",
        confidence: 0.98,
      },
      {
        selector: '[data-automation-id="legalNameSection_lastName"]',
        fieldType: "lastName",
        confidence: 0.98,
      },
      {
        selector: '[data-automation-id="preferredNameSection_firstName"]',
        fieldType: "firstName",
        confidence: 0.95,
      },
      {
        selector: '[data-automation-id="preferredNameSection_lastName"]',
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
        confidence: 0.95,
      },
      {
        selector: '[data-automation-id="githubQuestion"]',
        fieldType: "github",
        confidence: 0.95,
      },
    ];

    for (const mapping of canonicalWorkdaySelectors) {
      const el = document.querySelector(mapping.selector) as
        HTMLInputElement | HTMLSelectElement | null;
      if (el && !isElementSensitive(el)) {
        fields.push({
          name:
            el.getAttribute("name") || el.getAttribute("data-automation-id") || mapping.fieldType,
          label: extractAccessibleLabel(el, document) || mapping.fieldType,
          fieldType: mapping.fieldType,
          confidence: mapping.confidence,
          selector: mapping.selector,
          currentValue: el.value,
        });
      }
    }

    // Dynamic scan: check all visible inputs inside forms
    const allInputs = document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="password"]):not([type="file"]), select'
    );

    for (const input of allInputs) {
      if (isElementSensitive(input)) {
        continue;
      }

      const automationId = input.getAttribute("data-automation-id") || "";
      const name = input.getAttribute("name") || "";
      const id = input.id || "";
      const label = extractAccessibleLabel(input, document);
      const type = (input as HTMLInputElement).type || "text";

      // Skip already matched canonical selectors
      const selector = automationId
        ? `[data-automation-id="${automationId}"]`
        : id
          ? `#${id}`
          : name
            ? `input[name="${name}"]`
            : "";

      if (!selector || fields.some((f) => f.selector === selector)) {
        continue;
      }

      const classification = classifyFieldSemantics(label, name, id, automationId, type);
      if (classification.fieldType !== "unknown" && classification.confidence >= 0.7) {
        fields.push({
          name: name || automationId || id || classification.fieldType,
          label: label || name || automationId || classification.fieldType,
          fieldType: classification.fieldType,
          confidence: classification.confidence,
          selector,
          currentValue: input.value,
        });
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

      const label = extractAccessibleLabel(ta, document) || `Application Question #${idx + 1}`;
      if (!isGenuineApplicationQuestion(label)) {
        continue;
      }

      idx++;
      const automationId = ta.getAttribute("data-automation-id");
      const selector = automationId
        ? `[data-automation-id="${automationId}"]`
        : ta.id
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
}
