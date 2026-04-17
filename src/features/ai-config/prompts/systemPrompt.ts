import type { Profile, Observation } from '../../../domain';
import {
  ROLE_DEFINITION,
  STRUCTURE_CONTRACT,
  BOUNDARIES,
  UNCERTAINTY_MARKING,
  PROFILE_OUTPUT_FORMAT,
  proxyExtensionFragment,
} from './promptFragments';
import { extractProfileSummary, formatProfileSummary } from './profileContext';

export interface SystemPromptOptions {
  profile: Profile;
  /**
   * Observations for the profile. Required when `includeProfileSummary` is
   * true so the prompt can reference existing observation themes; ignored
   * otherwise. Pass an empty array when you know there are no observations.
   */
  observations?: Observation[];
  /**
   * Inject a compact summary of the current profile state (name, age,
   * diagnoses, existing observation themes, last update) into the prompt.
   * Default: true. The profile summary helps the AI avoid proposing
   * duplicate observations and route new information to existing themes.
   */
  includeProfileSummary?: boolean;
}

/**
 * Generate the system prompt for an AI chat session.
 *
 * The prompt is the concrete encoding of the "Structure, Never Diagnose"
 * contract: role, structuring model, hard boundaries, uncertainty marking,
 * and (for proxy profiles) caregiver-context extension.
 *
 * Sections are separated by blank lines. No Markdown headers; the model
 * parses the structure from the natural delimiters.
 */
export function generateSystemPrompt(options: SystemPromptOptions): string {
  const { profile, observations = [], includeProfileSummary = true } = options;

  const sections: string[] = [
    ROLE_DEFINITION,
    STRUCTURE_CONTRACT,
    BOUNDARIES,
    UNCERTAINTY_MARKING,
    PROFILE_OUTPUT_FORMAT,
  ];

  if (includeProfileSummary) {
    const summary = extractProfileSummary(profile, observations);
    sections.push(formatProfileSummary(summary));
  }

  if (profile.baseData.profileType === 'proxy') {
    sections.push(proxyExtensionFragment(profile.baseData.managedBy, profile.baseData.name));
  }

  return sections.join('\n\n');
}
