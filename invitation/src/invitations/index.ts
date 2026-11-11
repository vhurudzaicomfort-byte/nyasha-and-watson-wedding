import type { Invitation } from "./types";
import { ourLoveStory } from "./our-love-story";

/**
 * Invitation registry.
 *
 * Today: a static map keyed by slug. Tomorrow (eGuest): swap `getInvitation`
 * for a database/API call – every page already receives data through it.
 */
const registry: Record<string, Invitation> = {
  [ourLoveStory.slug]: ourLoveStory,
};

export const DEFAULT_INVITATION_SLUG =
  process.env.DEFAULT_INVITATION_SLUG || ourLoveStory.slug;

export function getInvitation(slug: string): Invitation | null {
  return registry[slug] ?? null;
}

export function getDefaultInvitation(): Invitation {
  return registry[DEFAULT_INVITATION_SLUG] ?? ourLoveStory;
}

export function listInvitationSlugs(): string[] {
  return Object.keys(registry);
}
