/**
 * JobOS Extension Popup Controller
 */

import { jobosApi } from "../api";
import { assembleApplicationPayload } from "../content/capture";
import type { CareerProfile, Job, JobMatch } from "@jobos/contracts";
import type {
  AutofillResult,
  DetectedFormField,
  DetectedQuestion,
  ExtractedJobMetadata,
} from "../types";

let currentJob: ExtractedJobMetadata | null = null;
let matchedJob: Job | null = null;
let currentProfile: CareerProfile | null = null;
let detectedFields: DetectedFormField[] = [];
let detectedQuestions: DetectedQuestion[] = [];
const draftAnswers: Record<string, string> = {};

document.addEventListener("DOMContentLoaded", async () => {
  const loadingView = document.getElementById("loadingView")!;
  const mainView = document.getElementById("mainView")!;
  const atsBadge = document.getElementById("atsBadge")!;
  const jobTitle = document.getElementById("jobTitle")!;
  const jobCompany = document.getElementById("jobCompany")!;
  const matchScore = document.getElementById("matchScore")!;
  const matchSub = document.getElementById("matchSub")!;
  const fieldCount = document.getElementById("fieldCount")!;
  const questionCount = document.getElementById("questionCount")!;
  const autofillBtn = document.getElementById("autofillBtn") as HTMLButtonElement;
  const autofillStatus = document.getElementById("autofillStatus")!;
  const questionList = document.getElementById("questionList")!;
  const captureBtn = document.getElementById("captureBtn") as HTMLButtonElement;
  const captureSuccess = document.getElementById("captureSuccess")!;
  const viewCapsuleLink = document.getElementById("viewCapsuleLink") as HTMLAnchorElement;

  try {
    // 1. Fetch active career profile from backend
    currentProfile = await jobosApi.getActiveProfile();

    // 2. Query active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      showError("No active tab found.");
      return;
    }

    // 3. Ask content script to extract page details
    chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PAGE_DATA" }, async (response) => {
      if (!response) {
        showFallbackPageData(tab.url || "", tab.title || "");
        return;
      }

      currentJob = response.job;
      detectedFields = response.fields || [];
      detectedQuestions = response.questions || [];
      atsBadge.innerText =
        response.adapterName || (response.job?.isWorkday ? "Workday" : "Generic");

      renderJobInfo();
      await matchWithJobOS();
      renderFields();
      renderQuestions();

      loadingView.classList.add("hidden");
      mainView.classList.remove("hidden");
    });
  } catch (err: any) {
    showError(err.message || "Failed to initialize JobOS extension");
  }

  function renderJobInfo() {
    if (!currentJob) return;
    jobTitle.innerText = currentJob.title || "Job Application";
    jobCompany.innerText = currentJob.company || "Company";
  }

  async function matchWithJobOS() {
    if (!currentJob || !currentProfile) return;
    try {
      const identifyRes = await jobosApi.identifyJob({
        url: currentJob.url,
        title: currentJob.title,
        company_name: currentJob.company,
        external_id: currentJob.externalId,
      });

      if (identifyRes.matched && identifyRes.job) {
        matchedJob = identifyRes.job;
        const match: JobMatch = await jobosApi.getJobMatch(matchedJob.id, currentProfile.id);
        matchScore.innerText = `${match.overall_score}%`;
        matchSub.innerText = `${match.strengths_json.length} Strengths Verified`;
      } else {
        matchScore.innerText = "--";
        matchSub.innerText = "New Discovery";
      }
    } catch (_e) {
      matchScore.innerText = "--";
      matchSub.innerText = "Ready to Apply";
    }
  }

  function renderFields() {
    fieldCount.innerText = `${detectedFields.length} safe fields`;
  }

  function renderQuestions() {
    questionCount.innerText = `${detectedQuestions.length} found`;
    questionList.innerHTML = "";

    if (detectedQuestions.length === 0) {
      questionList.innerHTML = `<p class="section-desc">No free-text questions detected on this page.</p>`;
      return;
    }

    detectedQuestions.forEach((q) => {
      const item = document.createElement("div");
      item.className = "question-item";
      item.innerHTML = `
        <div class="question-text">${escapeHtml(q.questionText)}</div>
        <button class="btn btn-primary draft-btn" data-selector="${escapeHtml(q.selector)}" data-text="${escapeHtml(q.questionText)}">
          Draft Answer with Evidence
        </button>
        <div class="draft-container hidden"></div>
      `;
      questionList.appendChild(item);
    });

    // Attach question draft handlers
    questionList.querySelectorAll(".draft-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const targetBtn = e.target as HTMLButtonElement;
        const selector = targetBtn.getAttribute("data-selector")!;
        const text = targetBtn.getAttribute("data-text")!;
        const container = targetBtn.nextElementSibling as HTMLElement;

        targetBtn.disabled = true;
        targetBtn.innerText = "Generating Grounded Draft...";

        try {
          const draftRes = await jobosApi.draftQuestionAnswer({
            career_profile_id: currentProfile!.id,
            question_text: text,
            job_id: matchedJob?.id || null,
          });

          draftAnswers[selector] = draftRes.draft_answer;

          container.classList.remove("hidden");
          container.innerHTML = `
            <div class="draft-box">${escapeHtml(draftRes.draft_answer)}</div>
            <button class="btn btn-accent insert-btn">Approve & Insert into Field</button>
          `;

          const insertBtn = container.querySelector(".insert-btn") as HTMLButtonElement;
          insertBtn.addEventListener("click", () => {
            chrome.tabs.query({ active: true, currentWindow: true }, ([t]) => {
              if (t?.id) {
                chrome.tabs.sendMessage(
                  t.id,
                  {
                    type: "INSERT_QUESTION_ANSWER",
                    payload: { selector, answerText: draftRes.draft_answer },
                  },
                  () => {
                    insertBtn.innerText = "✓ Inserted!";
                    insertBtn.disabled = true;
                  }
                );
              }
            });
          });

          targetBtn.classList.add("hidden");
        } catch (_err) {
          targetBtn.disabled = false;
          targetBtn.innerText = "Failed - Retry";
        }
      });
    });
  }

  // Autofill button click
  autofillBtn.addEventListener("click", () => {
    if (!currentProfile) return;
    autofillBtn.disabled = true;
    autofillBtn.innerText = "Autofilling...";

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) return;
      chrome.tabs.sendMessage(
        tab.id,
        { type: "AUTOFILL_SAFE_FIELDS", payload: { profile: currentProfile! } },
        (result: AutofillResult) => {
          autofillBtn.disabled = false;
          autofillBtn.innerText = "Autofill Safe Fields";
          autofillStatus.classList.remove("hidden");
          autofillStatus.innerText = `✓ Successfully filled ${result.filledFieldsCount} safe fields.`;
        }
      );
    });
  });

  // Capture application click
  captureBtn.addEventListener("click", async () => {
    if (!currentProfile || !currentJob) return;

    captureBtn.disabled = true;
    captureBtn.innerText = "Freezing Application Context...";

    // Assemble sanitized capture payload with whitelisted fields and approved questions
    const formFieldsMap: Record<string, string> = {};
    for (const f of detectedFields) {
      if (f.currentValue && f.fieldType !== "unknown") {
        formFieldsMap[f.label || f.name] = f.currentValue;
      }
    }

    // Only capture questions that have genuine content and user approval
    const recordedQuestions = detectedQuestions
      .filter((q) => Boolean(draftAnswers[q.selector] || q.currentValue))
      .map((q) => ({
        questionText: q.questionText,
        answerText: draftAnswers[q.selector] || q.currentValue || "",
        source: draftAnswers[q.selector] ? "jobos_assistant" : "candidate_manual",
        userApproved: true,
      }));

    try {
      const appPayload = assembleApplicationPayload(
        {
          jobId: matchedJob?.id,
          company: currentJob.company,
          title: currentJob.title,
          url: currentJob.url,
          pageTitle: currentJob.title,
          formFields: formFieldsMap,
          rawSnippet: currentJob.descriptionSnippet || "Job application captured from browser.",
          questions: recordedQuestions,
        },
        currentProfile.user_id
      );

      const capsule = await jobosApi.createApplication(appPayload);

      captureBtn.classList.add("hidden");
      captureSuccess.classList.remove("hidden");
      viewCapsuleLink.href = `http://localhost:3000/applications/${capsule.application.id}`;
    } catch (err: any) {
      captureBtn.disabled = false;
      captureBtn.innerText = "Save Application to Capsule";
      alert(`Capture failed: ${err.message}`);
    }
  });

  function showFallbackPageData(url: string, title: string) {
    currentJob = {
      url,
      title: title || "Job Application",
      company: "Company",
      isWorkday: false,
    };
    renderJobInfo();
    loadingView.classList.add("hidden");
    mainView.classList.remove("hidden");
  }

  function showError(msg: string) {
    loadingView.innerHTML = `<div style="color: #ef4444; padding: 12px;"><strong>Error</strong>: ${escapeHtml(msg)}</div>`;
  }

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
