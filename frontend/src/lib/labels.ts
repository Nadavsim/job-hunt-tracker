import type { Source, Stage } from "./types";

export const STAGE_LABELS: Record<Stage, string> = {
  wishlist: "Wishlist",
  applied: "Applied",
  online_assessment: "Online assessment",
  phone_screen: "Phone screen",
  interview: "Interview(s)",
  offer: "Offer",
  rejected: "Rejected",
  ghosted: "Ghosted",
  withdrawn: "Withdrawn",
};

export const SOURCE_LABELS: Record<Source, string> = {
  linkedin: "LinkedIn",
  referral: "Referral",
  company_site: "Company site",
  other: "Other",
};
