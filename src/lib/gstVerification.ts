export const OFFICIAL_GST_SEARCH_URL = 'https://services.gst.gov.in/services/searchtp';

export type GstVerificationMode = 'authorised_api' | 'official_manual';

export const OFFICIAL_GST_PORTAL_REFERENCE = {
  name: 'GST Portal – Search Taxpayer',
  url: OFFICIAL_GST_SEARCH_URL,
  free: true,
  loginRequired: false,
  captchaRequired: true,
} as const;

export const GST_MANUAL_REVIEW_MESSAGE =
  'The GSTIN format and check digit are valid. The official GST Portal lookup is free, but it requires a captcha, so FabricTrad cannot complete that government search automatically. Open the official portal, confirm that the GSTIN is Active, and upload the GST certificate for review.';
