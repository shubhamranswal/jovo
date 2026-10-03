/**
 * JobOS Extension Content Script Entrypoint
 * Bridges page DOM with popup and background worker.
 */

import { resolveAdapter } from "./adapters";
import { autofillSafeFields } from "./autofill";
import type { ExtensionMessage } from "../types";

function initContentScript(): void {
  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    switch (message.type) {
      case "EXTRACT_PAGE_DATA": {
        const adapter = resolveAdapter(window.location.href, document);
        const job = adapter.extractJob(window.location.href, document);
        const fields = adapter.detectFormFields(document);
        const questions = adapter.detectQuestions(document);

        sendResponse({
          job,
          fields,
          questions,
          adapterName: adapter.name,
        });
        return true;
      }

      case "AUTOFILL_SAFE_FIELDS": {
        const adapter = resolveAdapter(window.location.href, document);
        const fields = adapter.detectFormFields(document);
        const result = autofillSafeFields(document, fields, message.payload.profile);
        sendResponse(result);
        return true;
      }

      case "INSERT_QUESTION_ANSWER": {
        const { selector, answerText } = message.payload;
        const targetEl = document.querySelector(selector) as
          HTMLTextAreaElement | HTMLInputElement | null;
        if (targetEl) {
          targetEl.focus();
          targetEl.value = answerText;
          targetEl.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
          targetEl.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
          targetEl.blur();
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: `Selector ${selector} not found` });
        }
        return true;
      }

      default:
        break;
    }
    return false;
  });
}

initContentScript();
