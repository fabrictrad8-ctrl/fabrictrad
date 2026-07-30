import PolicyPage from '@/components/PolicyPage';

const sections = [
  {
    title: 'Using FabricTrad',
    paragraphs: ['By creating an account or using FabricTrad, users agree to provide accurate information, protect their login credentials and use the platform only for lawful textile commerce activities.'],
  },
  {
    title: 'Accounts and verification',
    bullets: [
      'One account may have buying and selling capabilities after the required verification is completed.',
      'Users must keep email, mobile, address, GST, bank and business information current and accurate.',
      'FabricTrad may request additional verification, limit features or suspend access when information is incomplete, inconsistent or appears fraudulent.',
      'Users are responsible for activity performed through their account unless promptly reported as unauthorised.',
    ],
  },
  {
    title: 'Seller responsibilities',
    bullets: [
      'Sellers must have authority to list and sell every product they publish.',
      'Listings must accurately describe composition, colour, width, GSM, work type, quantity, price, MOQ, dispatch time and applicable taxes.',
      'Sellers are responsible for packaging, invoices, GST compliance, shipment handover, customer communication and product quality.',
      'Inventory and order decisions must be updated promptly so buyers are not charged for unavailable goods.',
    ],
  },
  {
    title: 'Buyer responsibilities',
    bullets: [
      'Buyers must review product details, colour variants, quantity, price, MOQ, seller information and delivery terms before payment.',
      'Buyers must provide a complete delivery address and remain available for shipment communication.',
      'Buyer requirements, messages and disputes must be genuine, accurate and related to textile sourcing.',
    ],
  },
  {
    title: 'Orders, payments and fulfilment',
    paragraphs: ['An order request may require seller acceptance before payment. Payment and shipment services can be provided by third-party partners. Transaction status shown in FabricTrad is based on information received from users and integrated providers. Applicable fees, taxes, packing costs and delivery charges should be displayed before confirmation whenever available.'],
  },
  {
    title: 'Cancellations, returns and disputes',
    paragraphs: ['Eligibility depends on the product, seller terms, order stage and applicable law. Damage, shortage or incorrect-product claims may require an unedited unboxing video, photographs, packaging evidence and timely notice. FabricTrad may provide communication and evidence tools but is not automatically the seller of record.'],
  },
  {
    title: 'Prohibited activity',
    bullets: [
      'Fraud, impersonation, payment evasion, manipulated verification documents or false inventory.',
      'Contact-detail sharing intended to bypass platform protections or fees where prohibited by the product flow.',
      'Malware, scraping that harms service reliability, unauthorised access or interference with another account.',
      'Illegal, counterfeit, stolen, infringing or misrepresented products.',
      'Harassment, discriminatory conduct or abusive communication.',
    ],
  },
  {
    title: 'Platform availability and liability',
    paragraphs: ['FabricTrad aims to provide reliable marketplace technology but does not guarantee uninterrupted availability, a particular sales result or the conduct of every buyer, seller, payment provider or courier. Liability limitations must be interpreted subject to applicable law.'],
  },
  {
    title: 'Changes and contact',
    paragraphs: ['FabricTrad may update these terms as features, providers or legal requirements change. Material updates should be communicated through the platform or registered email. Questions can be sent to fabrictrad8@gmail.com.'],
  },
];

export default function TermsPage() {
  return (
    <PolicyPage
      kicker="Platform rules"
      title="Terms of use"
      intro="These terms describe the responsibilities of buyers, sellers and administrators using FabricTrad's marketplace, catalogue, payment and fulfilment tools."
      notice="This is a practical launch draft, not legal advice. FabricTrad should obtain jurisdiction-specific legal review before relying on these terms in production, particularly for payments, returns, consumer protection, taxes and dispute resolution."
      sections={sections}
    />
  );
}
