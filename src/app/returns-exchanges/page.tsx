import PolicyPage from '@/components/PolicyPage';

const sections = [
  {
    title: 'Core FabricTrad policy',
    paragraphs: [
      'FabricTrad marketplace products may be sold on a no-change-of-mind return basis where that restriction is clearly disclosed before purchase. FabricTrad nevertheless preserves the dispute, exchange and refund workflows needed for damaged, incorrect, deficient, spurious, materially not-as-described or otherwise legally remediable goods.',
    ],
  },
  {
    title: 'Damage exchange — 24-hour operational window',
    bullets: [
      'Inspect the parcel promptly after delivery.',
      'For visible transit damage, shortage or an incorrect item, open a claim within 24 hours of delivery whenever reasonably possible so the seller and courier evidence can be preserved quickly.',
      'Upload an uninterrupted unboxing video beginning before the outer package is opened, plus clear photographs of the outer package, shipping label, product and defect where reasonably available.',
      'Keep the original product, tags, packaging and courier material until the claim is resolved.',
      'The 24-hour process target is intended to speed evidence review; it does not remove a remedy that applicable law independently requires.',
    ],
  },
  {
    title: 'What is normally not a change-of-mind return',
    bullets: [
      'A buyer simply changes their mind after receiving a product that matches the accepted order.',
      'Minor screen-to-physical colour variation that is within a reasonable textile/photography tolerance and was not misrepresented.',
      'Buyer-selected quantity, measurement or variant errors where the seller supplied exactly the accepted order.',
      'Custom-cut, made-to-order or otherwise personalised textile goods where a lawful no-change-of-mind restriction was disclosed before purchase.',
    ],
  },
  {
    title: 'When an exchange, refund or other remedy can be reviewed',
    bullets: [
      'The product arrives damaged or unusable.',
      'The delivered product or quantity materially differs from the accepted order.',
      'The product is materially not as described or advertised.',
      'The product is counterfeit, spurious or otherwise not lawfully supplied.',
      'Another remedy is required under applicable consumer or contract law.',
    ],
  },
  {
    title: 'How a claim is handled',
    paragraphs: [
      'Open the order-related dispute from the Buyer Dashboard and choose the issue type that best matches the problem. FabricTrad stores the order reference, seller, description and submitted evidence so the buyer, seller and administrator can review one common record. Depending on the case, the outcome may be exchange, replacement, partial refund, refund, rejection with reasons or another lawful resolution.',
    ],
  },
  {
    title: 'Return shipping and collection',
    paragraphs: [
      'Return pickup, reverse logistics and shipping cost depend on the reason for the claim, seller arrangement and courier availability. These costs should be communicated in the applicable dispute/order flow. Do not send goods to an address outside the recorded resolution process unless the seller and FabricTrad have confirmed it.',
    ],
  },
  {
    title: 'Refund timing',
    paragraphs: [
      'Where a refund is approved, it should be initiated through the recorded payment/refund workflow. Actual bank or payment-method credit timing can depend on the payment provider and the buyer’s bank. A refund should not be treated as completed merely because a support message says it was approved.',
    ],
  },
];

export default function ReturnsExchangesPage() {
  return (
    <PolicyPage
      kicker="Order protection"
      title="Returns & Exchanges Policy"
      intro="FabricTrad uses a no-change-of-mind approach for eligible textile orders while keeping evidence-based remedies available for damage, incorrect goods and other legally remediable problems."
      notice="Operational policy — subject to applicable consumer law. Product-specific terms shown before purchase and non-waivable legal rights take precedence over any inconsistent platform wording."
      sections={sections}
    />
  );
}
