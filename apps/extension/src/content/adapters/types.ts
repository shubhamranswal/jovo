/**
 * ATS Adapter Interface & Registry
 */

import type { DetectedFormField, DetectedQuestion, ExtractedJobMetadata } from "../../types";

export interface AtsAdapter {
  name: string;
  matches(url: string, document: Document): boolean;
  extractJob(url: string, document: Document): ExtractedJobMetadata;
  detectFormFields(document: Document): DetectedFormField[];
  detectQuestions(document: Document): DetectedQuestion[];
}
