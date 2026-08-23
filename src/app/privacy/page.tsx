import PolicyPage from '@/components/PolicyPage';

const sections = [
  {
    title: 'Information FabricTrad may collect',
    paragraphs: [
      'FabricTrad collects information needed to create accounts, verify users and businesses, operate marketplace features, provide optional AI features and support transactions.',
    ],
    bullets: [
      'Account details such as name, email address, mobile number and authentication records.',
      'Buyer identity references, address details, preferences, wishlists, requirements and order activity.',
      'Seller business details such as GSTIN, PAN reference, bank verification details, catalogue content and fulfilment records.',
      'Technical information such as device, browser, security logs, page activity and error diagnostics.',
      'Messages, support requests and files intentionally submitted through FabricTrad features.',
      'For optional Virtual Drape personal-photo mode, the selfie or body photo you deliberately upload or capture and the generated AI result needed to provide that feature.',
    ],
  },
  {
    title: 'How information is used',
    bullets: [
      'To authenticate users, prevent duplicate or fraudulent accounts and maintain account security.',
      'To provide product discovery, order requests, payments, shipment tracking, seller tools and admin operations.',
      'To verify seller businesses, review listings and help resolve disputes or support cases.',
      'To provide optional AI catalogue and Virtual Drape functionality when the user chooses to invoke it.',
      'To improve performance, reliability, accessibility, fraud detection and user experience.',
      'To communicate transactional updates, security notices and account-related information.',
    ],
  },
  {
    title: 'Virtual Drape photos and AI processing',
    bullets: [
      'Personal-photo Virtual Drape is optional. The user must take an affirmative action to upload/capture a photo and confirm they own it or have permission to use it before generation.',
      'The selected photo and the seller textile references are sent to the configured AI image provider only when the user presses Generate. FabricTrad should not request unrelated contacts, files or device information for this purpose.',
      'The browser may save the current drape session locally on the user’s device so the session can survive navigation or refresh. Resetting/removing the photo in the studio replaces that locally saved session state with the cleared state.',
      'Generated previews are visual estimates and are not identity verification, biometric authentication or guarantees of physical fit, colour or textile behaviour.',
      'FabricTrad should minimise server logging of personal-photo content. Provider-side processing and retention are also subject to the configured provider’s contractual and privacy terms.',
    ],
  },
  {
    title: 'Service providers and data sharing',
    paragraphs: [
      'FabricTrad may share the minimum information required with infrastructure and transaction providers that support authentication, hosting, storage, AI image generation, payments, shipping, email, analytics or fraud prevention. Buyers and sellers may receive transaction information that is necessary to complete an order. FabricTrad does not sell personal information to advertisers.',
    ],
  },
  {
    title: 'Payments and banking information',
    paragraphs: [
      'Payment processing is handled through integrated payment providers. FabricTrad should not store full card details. Seller banking information may be processed for verification and payouts, with masked account references displayed wherever practical.',
    ],
  },
  {
    title: 'Cookies, IndexedDB and local storage',
    paragraphs: [
      'FabricTrad may use cookies and browser storage for sessions, preferences, theme, language, security, analytics and essential product functions. Virtual Drape can use browser IndexedDB to preserve a user-controlled studio session on that device. Disabling essential storage can prevent login and commerce features from working correctly.',
    ],
  },
  {
    title: 'Retention and security',
    paragraphs: [
      'Information is retained for as long as needed to operate accounts, complete transactions, meet legal or accounting obligations, prevent abuse and resolve disputes. Optional AI-photo data should be retained only as long as required for the requested feature, security or a user-controlled saved session. FabricTrad uses access controls, encrypted connections and account-scoped permissions, but no internet service can guarantee absolute security.',
    ],
  },
  {
    title: 'Your choices, consent and requests',
    bullets: [
      'Do not use personal-photo Virtual Drape if you do not want the chosen photo sent to the configured AI provider.',
      'Withdraw from the current Virtual Drape photo session by removing/resetting the photo in the studio; contact FabricTrad for a privacy request relating to server-side personal data.',
      'Update available account, address and preference information from the profile page.',
      'Request access, correction or deletion of eligible personal information.',
      'Contact FabricTrad about privacy, account security or an unauthorised transaction.',
      'Withdraw from optional communications while continuing to receive essential transactional notices.',
    ],
  },
  {
    title: 'Contact',
    paragraphs: [
      'Privacy and data requests can be sent to fabrictrad8@gmail.com. Include the email address connected to your account and enough information for FabricTrad to verify the request securely. FabricTrad should make withdrawal or deletion requests reasonably accessible and should not require unrelated personal information merely to exercise a privacy choice.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PolicyPage
      kicker="Trust & data"
      title="Privacy policy"
      intro="This page explains the categories of information FabricTrad uses to provide textile marketplace, account, catalogue, AI, order, payment and fulfilment services."
      notice="Operational privacy draft — not legal advice. FabricTrad should complete a DPDP compliance review, provider/data-processing inventory, retention schedule and grievance/contact process before production reliance."
      sections={sections}
    />
  );
}
