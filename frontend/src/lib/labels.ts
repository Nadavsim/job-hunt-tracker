import type { MockKind, OutreachKind, Platform, Source, Stage } from "./types";

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

export const PLATFORM_LABELS: Record<Platform, string> = {
  leetcode: "LeetCode",
  neetcode: "NeetCode",
  other: "Other",
};

export const MOCK_KIND_LABELS: Record<MockKind, string> = {
  technical: "Technical / coding",
  behavioral: "Behavioral",
  system_design: "System design",
  other: "Other",
};

export const OUTREACH_KIND_LABELS: Record<OutreachKind, string> = {
  message: "Message / email",
  coffee_chat: "Coffee chat / call",
  referral_ask: "Asked for a referral",
  follow_up: "Follow-up",
  other: "Other",
};
