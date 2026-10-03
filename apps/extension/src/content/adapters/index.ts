/**
 * Adapter Registry
 * Resolves the best ATS adapter for current page.
 */

import { GenericAdapter } from "./generic";
import type { AtsAdapter } from "./types";
import { WorkdayAdapter } from "./workday";

const adapters: AtsAdapter[] = [
  new WorkdayAdapter(),
  new GenericAdapter(), // Fallback must be last
];

export function resolveAdapter(url: string, document: Document): AtsAdapter {
  for (const adapter of adapters) {
    if (adapter.matches(url, document)) {
      return adapter;
    }
  }
  return new GenericAdapter();
}
