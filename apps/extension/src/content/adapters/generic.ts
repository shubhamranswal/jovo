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

    // Scan all candidate inputs on the page, including inside Web Components / Shadow Roots
    const inputs = this.collectCandidateElements(document);

    let idx = 0;
    for (const el of inputs) {
      idx++;
      if (isElementSensitive(el)) {
        continue;
      }

      // Skip elements clearly in header, nav, footer, or newsletter
      if (this.isInUnrelatedSection(el)) {
        continue;
      }

      const name = el.getAttribute("name") || "";
      const id = el.id || "";
      const automationId =
        el.getAttribute("data-automation-id") ||
        el.getAttribute("formcontrolname") ||
        el.getAttribute("ng-reflect-name") ||
        "";
      const autocomplete = el.getAttribute("autocomplete") || "";
      const accept = el.getAttribute("accept") || "";
      const label = extractAccessibleLabel(el, document);
      const type = (el as HTMLInputElement).type || el.tagName.toLowerCase();

      const classification = classifyFieldSemantics(
        label,
        name,
        id,
        automationId,
        type,
        autocomplete,
        accept
      );

      if (classification.fieldType !== "unknown" && classification.confidence >= 0.7) {
        const selector = this.generateElementSelector(el, idx);

        if (selector && !fields.some((f) => f.selector === selector)) {
          fields.push({
            name: name || id || classification.fieldType,
            label: label || name || id || classification.fieldType,
            fieldType: classification.fieldType,
            confidence: classification.confidence,
            selector,
            currentValue: (el as HTMLInputElement).value || "",
            element: el,
          });
        }
      }
    }

    return fields;
  }

  /**
   * Recursively gathers form elements across standard Light DOM and Web Component Shadow Roots.
   */
  private collectCandidateElements(
    root: Document | Element | ShadowRoot
  ): Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
    const selector =
      'input:not([type="hidden"]):not([type="submit"]):not([type="password"]):not([type="button"]):not([type="reset"]), select, textarea';
    const found: Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> = [];

    const nodes = root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      selector
    );
    found.push(...Array.from(nodes));

    // Recursively check any shadow roots attached to custom elements
    const allCustom = root.querySelectorAll("*");
    for (const node of allCustom) {
      if ((node as any).shadowRoot) {
        found.push(...this.collectCandidateElements((node as any).shadowRoot));
      }
    }

    return found;
  }

  detectQuestions(document: Document): DetectedQuestion[] {
    const questions: DetectedQuestion[] = [];
    const textareas = document.querySelectorAll<HTMLTextAreaElement>("textarea");

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
      const selector = this.generateElementSelector(ta, idx);

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
   * Generates a resilient, unique CSS selector for any DOM element across modern frameworks.
   */
  private generateElementSelector(el: HTMLElement, index: number): string {
    const escapeAttr = (str: string) => str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

    if (el.id && !el.id.includes(" ")) {
      try {
        const win = el.ownerDocument.defaultView || (globalThis as any);
        const safeId =
          win.CSS && typeof win.CSS.escape === "function"
            ? win.CSS.escape(el.id)
            : el.id.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, "\\$1");
        return `#${safeId}`;
      } catch {
        // Fallback
      }
    }

    const automationId = el.getAttribute("data-automation-id");
    if (automationId) {
      return `[data-automation-id="${escapeAttr(automationId)}"]`;
    }

    const formControl = el.getAttribute("formcontrolname");
    if (formControl) {
      return `[formcontrolname="${escapeAttr(formControl)}"]`;
    }

    const testId = el.getAttribute("data-testid") || el.getAttribute("data-test");
    if (testId) {
      return `[data-testid="${escapeAttr(testId)}"], [data-test="${escapeAttr(testId)}"]`;
    }

    const name = el.getAttribute("name");
    if (name) {
      return `${el.tagName.toLowerCase()}[name="${escapeAttr(name)}"]`;
    }

    const autoComp = el.getAttribute("autocomplete");
    if (autoComp) {
      return `${el.tagName.toLowerCase()}[autocomplete="${escapeAttr(autoComp)}"]`;
    }

    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) {
      return `${el.tagName.toLowerCase()}[aria-label="${escapeAttr(ariaLabel)}"]`;
    }

    // Tag element with persistent unique data attribute to guarantee 100% selector resolution
    if (typeof el.setAttribute === "function") {
      const uid = el.getAttribute("data-jobos-uid") || `j-${index}`;
      if (!el.hasAttribute("data-jobos-uid")) {
        el.setAttribute("data-jobos-uid", uid);
      }
      return `[data-jobos-uid="${uid}"]`;
    }

    const tag = el.tagName.toLowerCase();
    return `${tag}:nth-of-type(${index})`;
  }

  private isInUnrelatedSection(el: HTMLElement): boolean {
    const parentContainer = el.closest(
      'header, nav, footer, header [role="search"], nav [role="search"], form[role="search"], [id*="cookie"], [class*="cookie"], [id*="newsletter"]'
    );
    return parentContainer !== null;
  }
}
