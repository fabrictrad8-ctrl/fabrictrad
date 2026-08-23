import PolicyPage from '@/components/PolicyPage';

const sections = [
  {
    title: 'Seller eligibility and business information',
    bullets: [
      'Provide accurate seller identity, business, pickup, bank and tax information and keep it current.',
      'FabricTrad currently requires a verified GSTIN before a seller may publish live marketplace listings. This is a FabricTrad platform eligibility rule; sellers remain responsible for determining and complying with their own legal tax obligations.',
      'FabricTrad may pause selling, payouts or listing publication when verification expires, information conflicts or fraud risk is detected.',
    ],
  },
  {
    title: 'Catalogue and inventory responsibilities',
    bullets: [
      'You must have authority to sell every product and must provide accurate product name, SKU, textile composition, category, work/finish, colour, width, GSM where known, measurement unit, stock, MOQ, price and dispatch estimate.',
      'Maintain real available inventory and buyer limits. Accepting an order is a commitment to reserve or fulfil the accepted quantity subject to payment.',
      'WhatsApp/AI catalogue assistance may prepare draft data or media, but you remain responsible for the accuracy of the listing. Where admin approval is configured, the product does not become live until that approval is completed.',
      'Do not use false scarcity, fake reviews, misleading rankings or inaccurate product images.',
    ],
  },
  {
    title: 'Orders and prepaid fulfilment',
    bullets: [
      'Review new-order notifications promptly and accept only quantities you can fulfil. Reject unavailable orders with a genuine reason.',
      'Acceptance is not payment. Do not pack for dispatch based only on an accepted status.',
      'FabricTrad marketplace orders are prepaid. Dispatch is permitted only after the order is recorded as fully paid following server-side payment verification.',
      'Cash on Delivery is not supported for FabricTrad marketplace orders unless FabricTrad explicitly introduces a separate compliant product in the future.',
    ],
  },
  {
    title: 'Packing, shipping and RTO',
    bullets: [
      'Use packing suitable for the textile, value, weather and courier method. Seller-side packing costs remain your responsibility unless your commercial plan expressly states otherwise.',
      'Use the shipment record provided by FabricTrad. When an integrated courier is configured, create the courier shipment from the paid order; otherwise record the real courier, AWB/tracking reference and ETA using the supported fallback.',
      'Courier, local-delivery, transporter and Return to Origin charges may be allocated according to the shipment terms and cause of the failed delivery. FabricTrad does not guarantee third-party courier performance.',
      'Do not mark an order fulfilled before the actual shipment/delivery state supports that status.',
    ],
  },
  {
    title: 'Invoices, taxes and statutory deductions',
    bullets: [
      'You are responsible for correct HSN/classification, GST rate, seller invoice information, returns and other seller tax compliance.',
      'Where FabricTrad is legally required to collect GST TCS, deduct income-tax TDS or make another statutory deduction for the applicable marketplace transaction structure, the deduction may be recorded in your payment ledger and settlement statement.',
      'Statutory deductions are not interchangeable with FabricTrad commission or payment-gateway fees. Each should be itemised separately when applicable.',
      'Keep PAN/GST and other compliance information current so exemption, threshold or higher-rate rules can be applied correctly where relevant.',
    ],
  },
  {
    title: 'Platform fees and settlement',
    paragraphs: [
      'FabricTrad may charge transaction commission, subscription fees, courier-handling/platform service charges and clearly disclosed promotional fees. Gateway processing charges and applicable taxes may also affect settlement according to the commercial terms. Seller payable should be derived from the captured transaction and itemised deductions rather than from an undisclosed net figure.',
    ],
  },
  {
    title: 'Returns, exchanges and claims',
    paragraphs: [
      'FabricTrad may operate a no-change-of-mind return policy on eligible textile products. You must nevertheless cooperate with the platform process for damaged, incorrect, deficient, spurious, materially not-as-described or otherwise legally remediable goods. Damage exchanges should be reviewed quickly when the buyer reports within the 24-hour operational window and provides packaging, photographs and an unedited unboxing video where reasonably available.',
    ],
  },
  {
    title: 'Advertising, sponsored placement and ranking integrity',
    bullets: [
      'Paid marketplace placement must be presented as Sponsored, Promoted or with an equivalent clear disclosure.',
      'Do not buy or request a Best Seller, Top Seller or organic Top 10 label that would falsely imply independent marketplace performance.',
      'Subscription and promotional benefits are governed by the plan or campaign terms displayed when purchased.',
    ],
  },
  {
    title: 'Platform role and seller responsibility',
    paragraphs: [
      'FabricTrad provides marketplace, payment-orchestration, catalogue, AI and logistics technology. You remain responsible for your products, product representations, seller taxes, invoices, packing and fulfilment except for a service FabricTrad expressly undertakes itself. Responsibility allocations and liability limitations remain subject to applicable law and do not remove non-waivable obligations.',
    ],
  },
];

export default function SellerAgreementPage() {
  return (
    <PolicyPage
      kicker="Seller terms"
      title="Seller Agreement"
      intro="The seller-side operating agreement for catalogue accuracy, prepaid orders, settlement, shipping, tax responsibilities and marketplace integrity."
      notice="This agreement supplements the Terms of Use and commercial seller plan. FabricTrad should have its marketplace, GST/TCS, income-tax/TDS, payment and logistics model reviewed by Indian counsel and a chartered accountant before production reliance."
      sections={sections}
    />
  );
}
