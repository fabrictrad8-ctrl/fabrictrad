import PolicyPage from '@/components/PolicyPage';

const sections = [
  {
    title: 'Your buyer account',
    bullets: [
      'Use accurate contact and delivery information and protect your login credentials.',
      'A Personal / Buy for me profile is intended for smaller purchases; a Retail Store / business profile can hold business and tax details for trade purchasing.',
      'Do not impersonate another person or business or submit false sourcing requirements, payment claims or dispute evidence.',
    ],
  },
  {
    title: 'Before placing an order',
    bullets: [
      'Review the live seller, product, variant, measurement unit, quantity limits, stock, price, GST/tax information, dispatch estimate and disclosed delivery or platform charges.',
      'Screen colours, photography and AI previews can differ from the physical textile. Request clarification from the seller where colour, weave, finish or dimensions are critical.',
      'A buyer requirement is a sourcing request, not a paid product order. A direct product order is managed from Buyer Orders.',
    ],
  },
  {
    title: 'Seller acceptance and payment',
    bullets: [
      'A product order can remain Pending until the seller confirms stock and accepts it.',
      'Once accepted, use only the FabricTrad payment action linked to the order. FabricTrad marketplace orders do not use Cash on Delivery.',
      'The order is treated as paid only after the payment provider response has been verified by FabricTrad on the server.',
      'Do not send off-platform payment merely because a seller asks for it. Off-platform payments may not receive FabricTrad transaction protections or records.',
    ],
  },
  {
    title: 'Delivery and inspection',
    bullets: [
      'Keep your delivery address and phone number current and monitor the tracking information attached to the order.',
      'For valuable or damage-sensitive deliveries, record an uninterrupted unboxing video beginning before the outer package is opened and keep the packaging until the order has been checked.',
      'For visible damage, shortage or an incorrect item, open a FabricTrad claim as soon as possible. The operational target for damage-exchange evidence is within 24 hours of delivery.',
    ],
  },
  {
    title: 'Returns, exchanges and refunds',
    paragraphs: [
      'FabricTrad may label textile products as not eligible for change-of-mind return or refund. That policy does not remove remedies that applicable law requires for defective, deficient, spurious, incorrect, materially not-as-described or otherwise legally remediable goods. Damage exchanges are reviewed using the order record, seller response, packaging evidence, photographs and unboxing video where reasonably available.',
    ],
  },
  {
    title: 'AI virtual try-on',
    paragraphs: [
      'Virtual Drape is a visual preview generated from the selected seller textile and, when you choose personal-photo mode, the photo you provide. Only upload a photo you own or have permission to use. AI output is not a guarantee of exact fit, colour, pattern scale, tailoring or physical drape. Any paid AI-generation price must be shown before you authorise that generation.',
    ],
  },
  {
    title: 'Disputes and communication',
    bullets: [
      'Keep order-related communication in FabricTrad where possible so the buyer, seller and administrator can refer to a common transaction record.',
      'Upload genuine evidence only. Edited, misleading or unrelated evidence may result in rejection, investigation or account restriction.',
      'FabricTrad may facilitate a dispute but the seller remains responsible for seller-side obligations unless FabricTrad expressly assumes them.',
    ],
  },
];

export default function BuyerAgreementPage() {
  return (
    <PolicyPage
      kicker="Buyer terms"
      title="Buyer Agreement"
      intro="The buyer-side operating agreement for marketplace orders, prepaid payment, delivery, AI previews and claims on FabricTrad."
      notice="This agreement supplements the Terms of Use and is subject to applicable law. It should receive jurisdiction-specific legal review before production reliance."
      sections={sections}
    />
  );
}
