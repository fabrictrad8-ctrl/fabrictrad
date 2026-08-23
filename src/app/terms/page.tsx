import PolicyPage from '@/components/PolicyPage';

const sections = [
  {
    title: 'Using FabricTrad',
    paragraphs: [
      'By creating an account or using FabricTrad, users agree to provide accurate information, protect their login credentials and use the platform only for lawful textile commerce activities. FabricTrad operates marketplace technology and transaction tools connecting buyers and independent sellers; it is not automatically the seller of every product listed on the platform.',
    ],
  },
  {
    title: 'Accounts, roles and verification',
    bullets: [
      'One account may have buying and selling capabilities after the required role-specific verification is completed.',
      'Users must keep email, mobile, address, tax, bank and business information current and accurate.',
      'FabricTrad currently requires a verified GSTIN before a seller may publish live marketplace listings. This is a FabricTrad platform eligibility rule and is not a statement that every person selling online is legally required to hold GST registration in every circumstance.',
      'FabricTrad may request additional verification, limit features or suspend access when information is incomplete, inconsistent or appears fraudulent.',
      'Users are responsible for activity performed through their account unless promptly reported as unauthorised.',
    ],
  },
  {
    title: 'Seller responsibilities',
    bullets: [
      'Sellers must have authority to list and sell every product they publish.',
      'Listings must accurately describe composition, colour, width, GSM, work type, quantity, price, MOQ, dispatch time and applicable taxes.',
      'Sellers are responsible for product accuracy and quality, lawful tax treatment and invoices, packing, dispatch readiness, shipment handover and buyer communication except to the extent FabricTrad expressly undertakes a service itself.',
      'Inventory and order decisions must be updated promptly so buyers are not charged for unavailable goods.',
      'Sellers must not attempt to shift non-waivable legal obligations to a buyer merely by adding contrary wording to a listing or message.',
    ],
  },
  {
    title: 'Buyer responsibilities',
    bullets: [
      'Buyers must review product details, colour variants, quantity, price, MOQ, seller information, taxes, delivery terms and disclosed charges before payment.',
      'Buyers must provide a complete delivery address and remain available for shipment communication.',
      'Buyer requirements, messages and disputes must be genuine, accurate and related to textile sourcing.',
      'For damage, shortage or incorrect-product claims, buyers should preserve the original packaging and upload an unedited unboxing video and supporting photographs where reasonably available.',
    ],
  },
  {
    title: 'Orders, prepaid payments and fulfilment',
    bullets: [
      'FabricTrad does not support Cash on Delivery for marketplace orders. Orders are prepaid through the payment methods enabled by the integrated payment gateway.',
      'A direct product order may require seller acceptance before payment becomes available. Acceptance reserves or confirms stock; it does not mean the order is paid.',
      'Dispatch must not begin until FabricTrad has recorded successful server-side payment verification for the full amount required for dispatch.',
      'Payment and shipment services may be provided by third-party providers. Their fees and service conditions may apply in addition to FabricTrad platform charges.',
      'The checkout or order flow should disclose the total payable amount and compulsory charges available to FabricTrad before the buyer confirms payment.',
    ],
  },
  {
    title: 'Platform charges, payment fees and seller settlement',
    paragraphs: [
      'FabricTrad may charge transaction commissions, courier-handling or platform service charges and other seller fees according to the seller plan or transaction terms then in force. Payment-gateway processing charges and applicable taxes may also be reflected where contractually permitted. Seller settlement is calculated from the captured transaction after recorded refunds, platform charges, gateway charges, applicable taxes or statutory deductions, and other amounts expressly disclosed in the applicable commercial terms.',
    ],
  },
  {
    title: 'Returns, exchanges, refunds and damage claims',
    bullets: [
      'FabricTrad may operate a no-change-of-mind return policy for products identified as such before purchase.',
      'For damaged, incorrect, deficient, spurious or materially not-as-described goods, buyers may open the applicable exchange, refund or dispute process. FabricTrad does not use a platform policy to remove rights that cannot lawfully be excluded.',
      'For the fastest damage-exchange review, buyers should report visible transit damage within 24 hours of delivery and provide an unedited unboxing video, photographs and packaging evidence. The 24-hour workflow target does not override any remedy that applicable law independently requires.',
      'Exchange eligibility, logistics, collection, replacement availability and any return-shipping cost are shown or communicated in the applicable order/dispute flow.',
      'FabricTrad may provide evidence storage, communication and administrative review while the seller remains responsible for seller-side obligations unless FabricTrad has expressly assumed them.',
    ],
  },
  {
    title: 'Taxes and statutory deductions',
    paragraphs: [
      'Sellers remain responsible for their own tax registrations, classification, invoices, returns and tax positions. Where law requires FabricTrad, as an e-commerce operator or payment intermediary in a particular transaction structure, to collect or deduct tax, FabricTrad may calculate, withhold, report and remit the applicable amount and reflect it in the seller transaction ledger. Such deductions must be based on the applicable law, seller status and configured compliance rules rather than a blanket percentage applied to every seller.',
    ],
  },
  {
    title: 'Shipping, packing and Return to Origin',
    paragraphs: [
      'Sellers are responsible for appropriate packing and for seller-side packing costs unless a product or commercial plan expressly states otherwise. Courier, transporter, local-delivery and Return to Origin charges are allocated according to the applicable shipment, seller plan and cause of the failed delivery. FabricTrad provides logistics technology and integrations but does not guarantee a courier’s performance. Nothing in this clause excludes responsibilities that applicable law places directly on FabricTrad.',
    ],
  },
  {
    title: 'Promotions, rankings and advertising',
    bullets: [
      'Any paid search placement, promoted catalogue position or advertisement must be identified as Sponsored, Promoted or an equivalent clear disclosure.',
      'Performance labels such as Best Seller, Top Seller or organic Top 10 should be based on disclosed marketplace signals and must not be sold as though they were independent organic rankings.',
      'FabricTrad may offer paid promotional inventory or subscription benefits under separate commercial terms, but paid placement must not be disguised as ordinary user-generated or organic marketplace content.',
    ],
  },
  {
    title: 'AI, automation and catalogue processing',
    paragraphs: [
      'FabricTrad may use automated systems and AI to parse catalogue submissions, prepare images or metadata, suggest classifications, power virtual try-on and route operational tasks. Automation is intended to reduce manual work, but FabricTrad may retain human approval or exception review for seller verification, listing approval, fraud, disputes, safety, tax exceptions and other high-impact decisions. AI-generated output is a preview or assistance layer and must not be treated as a guarantee of physical colour, fit, texture or production outcome.',
    ],
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
    paragraphs: [
      'FabricTrad aims to provide reliable marketplace technology but does not guarantee uninterrupted availability, a particular sales result or the conduct of every buyer, seller, payment provider or courier. Seller/vendor taxes, product packing, product representations and seller fulfilment remain seller responsibilities unless FabricTrad expressly assumes a particular service. Liability limitations and responsibility allocations are always subject to applicable law and do not waive non-excludable consumer or statutory rights.',
    ],
  },
  {
    title: 'Related agreements and changes',
    paragraphs: [
      'Buyer-specific obligations are described in the Buyer Agreement, seller-specific obligations in the Seller Agreement, privacy and AI-photo processing in the Privacy Policy, and operational return/exchange rules in the Returns & Exchanges Policy. FabricTrad may update these terms as features, providers or legal requirements change. Material updates should be communicated through the platform or registered email. Questions can be sent to fabrictrad8@gmail.com.',
    ],
  },
];

export default function TermsPage() {
  return (
    <PolicyPage
      kicker="Platform rules"
      title="Terms of use"
      intro="These terms describe the responsibilities of buyers, sellers and administrators using FabricTrad's marketplace, catalogue, payment, AI and fulfilment tools."
      notice="Operational launch terms — not legal or tax advice. FabricTrad should have Indian e-commerce, consumer, privacy, GST/TCS and income-tax/TDS clauses reviewed by qualified counsel and a chartered accountant before production reliance."
      sections={sections}
    />
  );
}
