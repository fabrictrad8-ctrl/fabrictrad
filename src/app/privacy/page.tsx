import PolicyPage from '@/components/PolicyPage';

const sections = [
  {
    title: 'Information FabricTrad may collect',
    paragraphs: ['FabricTrad collects information needed to create accounts, verify users and businesses, operate marketplace features and support transactions.'],
    bullets: [
      'Account details such as name, email address, mobile number and authentication records.',
      'Buyer identity references, address details, preferences, wishlists, requirements and order activity.',
      'Seller business details such as GSTIN, PAN reference, bank verification details, catalogue content and fulfilment records.',
      'Technical information such as device, browser, security logs, page activity and error diagnostics.',
      'Messages, support requests and files intentionally submitted through FabricTrad features.',
    ],
  },
  {
    title: 'How information is used',
    bullets: [
      'To authenticate users, prevent duplicate or fraudulent accounts and maintain account security.',
      'To provide product discovery, order requests, payments, shipment tracking, seller tools and admin operations.',
      'To verify seller businesses, review listings and help resolve disputes or support cases.',
      'To improve performance, reliability, accessibility, fraud detection and user experience.',
      'To communicate transactional updates, security notices and account-related information.',
    ],
  },
  {
    title: 'Service providers and data sharing',
    paragraphs: ['FabricTrad may share the minimum information required with infrastructure and transaction providers that support authentication, hosting, storage, payments, shipping, email, analytics or fraud prevention. Buyers and sellers may receive transaction information that is necessary to complete an order. FabricTrad does not sell personal information to advertisers.'],
  },
  {
    title: 'Payments and banking information',
    paragraphs: ['Payment processing is handled through integrated payment providers. FabricTrad should not store full card details. Seller banking information may be processed for verification and payouts, with masked account references displayed wherever practical.'],
  },
  {
    title: 'Cookies and local storage',
    paragraphs: ['FabricTrad may use cookies and browser storage for sessions, preferences, theme, language, security, analytics and essential product functions. Disabling essential storage can prevent login and commerce features from working correctly.'],
  },
  {
    title: 'Retention and security',
    paragraphs: ['Information is retained for as long as needed to operate accounts, complete transactions, meet legal or accounting obligations, prevent abuse and resolve disputes. FabricTrad uses access controls, encrypted connections and account-scoped permissions, but no internet service can guarantee absolute security.'],
  },
  {
    title: 'Your choices and requests',
    bullets: [
      'Update available account, address and preference information from the profile page.',
      'Request access, correction or deletion of eligible personal information.',
      'Contact FabricTrad about privacy, account security or an unauthorised transaction.',
      'Withdraw from optional communications while continuing to receive essential transactional notices.',
    ],
  },
  {
    title: 'Contact',
    paragraphs: ['Privacy and data requests can be sent to fabrictrad8@gmail.com. Include the email address connected to your account and enough information for FabricTrad to verify the request securely.'],
  },
];

export default function PrivacyPage() {
  return (
    <PolicyPage
      kicker="Trust & data"
      title="Privacy policy"
      intro="This page explains the categories of information FabricTrad uses to provide textile marketplace, account, catalogue, order, payment and fulfilment services."
      notice="This policy is an operational draft and is not a substitute for legal advice. It should be reviewed by qualified counsel before public launch and updated to match the final vendors, data flows and jurisdictions used by FabricTrad."
      sections={sections}
    />
  );
}
