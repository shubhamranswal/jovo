/**
 * JobOS Extension Background Service Worker
 * Handles extension lifecycle, message routing, and JobOS backend communication.
 */

import { jobosApi } from "../api";
import { assembleApplicationPayload } from "../content/capture";
import type { ExtensionMessage } from "../types";

chrome.runtime.onInstalled.addListener(() => {
  console.log("JobOS Application Assistant Extension installed.");
});

// Listener for background tasks or popup proxy calls
chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === "DRAFT_QUESTION") {
    (async () => {
      try {
        const { questionText, jobId, profileId } = message.payload;
        const draft = await jobosApi.draftQuestionAnswer({
          career_profile_id: profileId,
          question_text: questionText,
          job_id: jobId,
        });
        sendResponse({ success: true, draft });
      } catch (err: any) {
        sendResponse({ success: false, error: err.message || "Failed to draft answer" });
      }
    })();
    return true; // Keep message channel open for async response
  }

  if (message.type === "CAPTURE_APPLICATION_CONFIRMATION") {
    (async () => {
      try {
        const profile = await jobosApi.getActiveProfile();
        const payload = assembleApplicationPayload(message.payload, profile.user_id);
        const capsule = await jobosApi.createApplication(payload);
        sendResponse({ success: true, capsule });
      } catch (err: any) {
        sendResponse({ success: false, error: err.message || "Failed to capture application" });
      }
    })();
    return true;
  }

  return false;
});
