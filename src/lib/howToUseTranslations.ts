'use client';

import type { SupportedLanguageCode } from '@/lib/india';

export type GuideRole = 'buyer' | 'seller';
export type GuideScreen =
  | 'account'
  | 'discover'
  | 'product'
  | 'order'
  | 'payment'
  | 'tracking'
  | 'verify'
  | 'catalogue'
  | 'inventory'
  | 'fulfilment';

export type LocalizedGuideStep = {
  title: string;
  action: string;
  detail: string;
  icon: string;
  screen: GuideScreen;
};

type GuideOptionCopy = {
  eyebrow: string;
  title: string;
  description: string;
  bullets: [string, string, string];
  button: string;
};

export type HowToUseCopy = {
  start: {
    publicBadge: string;
    eyebrow: string;
    title: string;
    intro: string;
    buyer: GuideOptionCopy;
    seller: GuideOptionCopy;
    noAccountData: string;
    safePreview: string;
    helpCentre: string;
  };
  guide: {
    eyebrow: string;
    title: string;
    intro: string;
    buyer: string;
    seller: string;
    chooseWalkthrough: string;
    walkthrough: string;
    step: string;
    of: string;
    play: string;
    pause: string;
    playWalkthrough: string;
    pauseWalkthrough: string;
    previous: string;
    nextStep: string;
    signIn: string;
    createAccount: string;
    interactivePreview: string;
    view: string;
    buyerSidebar: [string, string, string];
    sellerSidebar: [string, string, string];
    liveInteractionPreview: string;
    noLiveData: string;
    buyOnFabricTrad: string;
    sellOnFabricTrad: string;
    roleAwareSetup: string;
    verificationShown: string;
    searchPlaceholder: string;
    filters: [string, string, string, string];
    sellerProvidedMedia: string;
    productFacts: [string, string, string, string];
    drapeSupported: string;
    addProduct: string;
    updateStock: string;
    tableHeaders: [string, string, string, string];
    yourProduct: string;
    current: string;
    orderCreated: string;
    sellerDecision: string;
    sellerConfirmation: string;
    dispatchTracking: string;
    recordCarriesStatus: string;
    secureCheckout: string;
    paymentTiedToOrder: string;
    continueToPayment: string;
    buyerSteps: LocalizedGuideStep[];
    sellerSteps: LocalizedGuideStep[];
  };
};

const en: HowToUseCopy = {
  start: {
    publicBadge: 'Public guides · no sign-in required',
    eyebrow: 'How to use FabricTrad',
    title: 'Choose how you want to use FabricTrad.',
    intro: 'Select Buyer or Seller to watch the relevant guided walkthrough. You do not need an account and you do not need to log in to view either guide.',
    buyer: {
      eyebrow: 'For buyers', title: 'How to buy on FabricTrad',
      description: 'Learn how to set up buying, find fabrics, inspect listings, place an order, pay securely and track fulfilment.',
      bullets: ['Search and compare products', 'Order and payment flow', 'Shipment tracking'],
      button: 'Watch buyer guide',
    },
    seller: {
      eyebrow: 'For sellers', title: 'How to sell on FabricTrad',
      description: 'Learn seller activation, business verification, catalogue creation, inventory, incoming orders and fulfilment.',
      bullets: ['Business and GST verification', 'Products and inventory', 'Orders and fulfilment'],
      button: 'Watch seller guide',
    },
    noAccountData: 'No account data is loaded', safePreview: 'Safe public preview', helpCentre: 'Open help centre',
  },
  guide: {
    eyebrow: 'How to use FabricTrad', title: 'Learn by watching the interface move.',
    intro: 'This public walkthrough works before sign-in. Choose Buyer or Seller, then play the guided flow or move through each screen yourself. The preview uses interface placeholders only and does not show fake products, reviews, ratings or transactions.',
    buyer: 'Buyer', seller: 'Seller', chooseWalkthrough: 'Choose walkthrough', walkthrough: 'walkthrough', step: 'Step', of: 'of', play: 'Play', pause: 'Pause', playWalkthrough: 'Play walkthrough', pauseWalkthrough: 'Pause walkthrough', previous: 'Previous', nextStep: 'Next step', signIn: 'Sign in', createAccount: 'Create account', interactivePreview: 'interactive preview', view: 'view',
    buyerSidebar: ['Marketplace', 'Orders', 'Tracking'], sellerSidebar: ['Dashboard', 'Products', 'Orders'], liveInteractionPreview: 'Live interaction preview', noLiveData: 'No live data', buyOnFabricTrad: 'Buy on FabricTrad', sellOnFabricTrad: 'Sell on FabricTrad', roleAwareSetup: 'Role-aware setup keeps the path focused on the tools you actually need.', verificationShown: 'Verification status is shown here', searchPlaceholder: 'Search fabrics, colours, GSM, vendors or SKU', filters: ['Fabric type', 'GSM', 'Width', 'MOQ'], sellerProvidedMedia: 'Seller-provided media', productFacts: ['Variants', 'Stock', 'MOQ', 'Dispatch'], drapeSupported: 'Drape-On appears when supported', addProduct: 'Add product', updateStock: 'Update stock', tableHeaders: ['Product', 'Variants', 'Stock', 'Status'], yourProduct: 'Your product', current: 'Current', orderCreated: 'Order created', sellerDecision: 'Seller decision / stock confirmation', sellerConfirmation: 'Seller confirmation', dispatchTracking: 'Dispatch & tracking', recordCarriesStatus: 'The real order record carries this status.', secureCheckout: 'Secure checkout', paymentTiedToOrder: 'Payment is tied to the FabricTrad order.', continueToPayment: 'Continue to payment',
    buyerSteps: [
      { title: 'Choose how you buy', action: 'Create one account and select the buyer setup that fits you.', detail: 'Individuals can shop retail-enabled listings. Business buyers can complete business verification for trade purchasing features.', icon: 'UserCircleIcon', screen: 'account' },
      { title: 'Find the right fabric', action: 'Search and filter the live marketplace.', detail: 'Use category, colour, GSM, width, MOQ, price, dispatch and seller information to narrow the catalogue.', icon: 'MagnifyingGlassIcon', screen: 'discover' },
      { title: 'Inspect before ordering', action: 'Open a product and review the seller-provided listing details.', detail: 'Check variants, stock, specifications, dispatch information and available media. Use Drape-On where the listing supports it.', icon: 'SparklesIcon', screen: 'product' },
      { title: 'Place the order request', action: 'Choose the variant and quantity, then proceed through the order flow.', detail: 'The seller confirms availability before payment where seller acceptance is required.', icon: 'ShoppingBagIcon', screen: 'order' },
      { title: 'Pay securely', action: 'Complete payment only through the FabricTrad checkout.', detail: 'The payment flow uses the order record and server-side verification before the order moves forward.', icon: 'CreditCardIcon', screen: 'payment' },
      { title: 'Track fulfilment', action: 'Follow the paid order from dispatch to delivery.', detail: 'Order status, shipment information, documents and support actions stay connected to the same order.', icon: 'TruckIcon', screen: 'tracking' },
    ],
    sellerSteps: [
      { title: 'Activate selling', action: 'Use the same FabricTrad account to enable seller capabilities.', detail: 'Complete the seller business profile and required verification instead of creating a second login.', icon: 'BuildingStorefrontIcon', screen: 'verify' },
      { title: 'Complete verification', action: 'Submit the required business details and GST information.', detail: 'Your seller readiness and verification status should be visible from the seller workflow before you publish products.', icon: 'ShieldCheckIcon', screen: 'verify' },
      { title: 'Build your catalogue', action: 'Add products with accurate seller-provided information.', detail: 'Upload product media, variants, colour-level stock, pricing, MOQ, specifications and dispatch details.', icon: 'PlusCircleIcon', screen: 'catalogue' },
      { title: 'Control inventory', action: 'Keep availability and variants current.', detail: 'Use the seller workspace to manage product status, stock, pricing and catalogue updates from one place.', icon: 'ArchiveBoxIcon', screen: 'inventory' },
      { title: 'Review incoming orders', action: 'Accept, reject or confirm available quantity from the real order record.', detail: 'Buyer payment opens according to the order flow after the seller-side confirmation step when required.', icon: 'ClipboardDocumentListIcon', screen: 'order' },
      { title: 'Fulfil paid orders', action: 'Dispatch, attach tracking and keep the order updated.', detail: 'Payments, invoices, shipment status and fulfilment actions remain tied to the same transaction record.', icon: 'TruckIcon', screen: 'fulfilment' },
    ],
  },
};

const hi: HowToUseCopy = {
  start: {
    publicBadge: 'सार्वजनिक मार्गदर्शिकाएँ · साइन इन की आवश्यकता नहीं', eyebrow: 'FabricTrad का उपयोग कैसे करें', title: 'चुनें कि आप FabricTrad का उपयोग कैसे करना चाहते हैं।', intro: 'संबंधित निर्देशित वॉकथ्रू देखने के लिए खरीदार या विक्रेता चुनें। किसी भी मार्गदर्शिका को देखने के लिए खाता या लॉगिन आवश्यक नहीं है।',
    buyer: { eyebrow: 'खरीदारों के लिए', title: 'FabricTrad पर कैसे खरीदें', description: 'खरीदारी सेटअप, कपड़े खोजने, लिस्टिंग जाँचने, ऑर्डर देने, सुरक्षित भुगतान करने और फ़ुलफ़िलमेंट ट्रैक करने का तरीका जानें।', bullets: ['उत्पाद खोजें और तुलना करें', 'ऑर्डर और भुगतान प्रक्रिया', 'शिपमेंट ट्रैकिंग'], button: 'खरीदार मार्गदर्शिका देखें' },
    seller: { eyebrow: 'विक्रेताओं के लिए', title: 'FabricTrad पर कैसे बेचें', description: 'विक्रेता सक्रियण, व्यवसाय सत्यापन, कैटलॉग बनाना, इन्वेंटरी, आने वाले ऑर्डर और फ़ुलफ़िलमेंट समझें।', bullets: ['व्यवसाय और GST सत्यापन', 'उत्पाद और इन्वेंटरी', 'ऑर्डर और फ़ुलफ़िलमेंट'], button: 'विक्रेता मार्गदर्शिका देखें' },
    noAccountData: 'कोई खाता डेटा लोड नहीं होता', safePreview: 'सुरक्षित सार्वजनिक प्रीव्यू', helpCentre: 'सहायता केंद्र खोलें',
  },
  guide: {
    eyebrow: 'FabricTrad का उपयोग कैसे करें', title: 'इंटरफ़ेस को चलते हुए देखकर सीखें।', intro: 'यह सार्वजनिक वॉकथ्रू साइन इन से पहले भी काम करता है। खरीदार या विक्रेता चुनें, फिर निर्देशित प्रवाह चलाएँ या हर स्क्रीन स्वयं देखें। प्रीव्यू में केवल इंटरफ़ेस प्लेसहोल्डर हैं; नकली उत्पाद, समीक्षाएँ, रेटिंग या लेनदेन नहीं दिखाए जाते।', buyer: 'खरीदार', seller: 'विक्रेता', chooseWalkthrough: 'वॉकथ्रू चुनें', walkthrough: 'वॉकथ्रू', step: 'चरण', of: 'में से', play: 'चलाएँ', pause: 'रोकें', playWalkthrough: 'वॉकथ्रू चलाएँ', pauseWalkthrough: 'वॉकथ्रू रोकें', previous: 'पिछला', nextStep: 'अगला चरण', signIn: 'साइन इन', createAccount: 'खाता बनाएँ', interactivePreview: 'इंटरैक्टिव प्रीव्यू', view: 'दृश्य',
    buyerSidebar: ['मार्केटप्लेस', 'ऑर्डर', 'ट्रैकिंग'], sellerSidebar: ['डैशबोर्ड', 'उत्पाद', 'ऑर्डर'], liveInteractionPreview: 'लाइव इंटरैक्शन प्रीव्यू', noLiveData: 'कोई लाइव डेटा नहीं', buyOnFabricTrad: 'FabricTrad पर खरीदें', sellOnFabricTrad: 'FabricTrad पर बेचें', roleAwareSetup: 'भूमिका-आधारित सेटअप आपको केवल उन टूल पर केंद्रित रखता है जिनकी वास्तव में आवश्यकता है।', verificationShown: 'सत्यापन स्थिति यहाँ दिखाई जाती है', searchPlaceholder: 'कपड़े, रंग, GSM, विक्रेता या SKU खोजें', filters: ['कपड़े का प्रकार', 'GSM', 'चौड़ाई', 'MOQ'], sellerProvidedMedia: 'विक्रेता द्वारा दिया गया मीडिया', productFacts: ['वैरिएंट', 'स्टॉक', 'MOQ', 'डिस्पैच'], drapeSupported: 'समर्थित होने पर Drape-On दिखाई देता है', addProduct: 'उत्पाद जोड़ें', updateStock: 'स्टॉक अपडेट करें', tableHeaders: ['उत्पाद', 'वैरिएंट', 'स्टॉक', 'स्थिति'], yourProduct: 'आपका उत्पाद', current: 'वर्तमान', orderCreated: 'ऑर्डर बनाया गया', sellerDecision: 'विक्रेता निर्णय / स्टॉक पुष्टि', sellerConfirmation: 'विक्रेता पुष्टि', dispatchTracking: 'डिस्पैच और ट्रैकिंग', recordCarriesStatus: 'वास्तविक ऑर्डर रिकॉर्ड में यही स्थिति रहती है।', secureCheckout: 'सुरक्षित चेकआउट', paymentTiedToOrder: 'भुगतान FabricTrad ऑर्डर से जुड़ा रहता है।', continueToPayment: 'भुगतान के लिए आगे बढ़ें',
    buyerSteps: [
      { title: 'खरीदारी का तरीका चुनें', action: 'एक खाता बनाएँ और अपने लिए सही खरीदार सेटअप चुनें।', detail: 'व्यक्तिगत खरीदार रिटेल-सक्षम लिस्टिंग खरीद सकते हैं। व्यावसायिक खरीदार ट्रेड खरीद सुविधाओं के लिए व्यवसाय सत्यापन पूरा कर सकते हैं।', icon: 'UserCircleIcon', screen: 'account' },
      { title: 'सही कपड़ा खोजें', action: 'लाइव मार्केटप्लेस में खोजें और फ़िल्टर लगाएँ।', detail: 'कैटलॉग सीमित करने के लिए श्रेणी, रंग, GSM, चौड़ाई, MOQ, कीमत, डिस्पैच और विक्रेता जानकारी का उपयोग करें।', icon: 'MagnifyingGlassIcon', screen: 'discover' },
      { title: 'ऑर्डर से पहले जाँचें', action: 'उत्पाद खोलें और विक्रेता द्वारा दी गई लिस्टिंग जानकारी देखें।', detail: 'वैरिएंट, स्टॉक, विनिर्देश, डिस्पैच जानकारी और उपलब्ध मीडिया जाँचें। जहाँ समर्थित हो वहाँ Drape-On का उपयोग करें।', icon: 'SparklesIcon', screen: 'product' },
      { title: 'ऑर्डर अनुरोध भेजें', action: 'वैरिएंट और मात्रा चुनकर ऑर्डर प्रक्रिया में आगे बढ़ें।', detail: 'जहाँ विक्रेता स्वीकृति आवश्यक है, वहाँ भुगतान से पहले विक्रेता उपलब्धता की पुष्टि करता है।', icon: 'ShoppingBagIcon', screen: 'order' },
      { title: 'सुरक्षित भुगतान करें', action: 'भुगतान केवल FabricTrad चेकआउट से पूरा करें।', detail: 'ऑर्डर आगे बढ़ने से पहले भुगतान प्रक्रिया ऑर्डर रिकॉर्ड और सर्वर-साइड सत्यापन का उपयोग करती है।', icon: 'CreditCardIcon', screen: 'payment' },
      { title: 'फ़ुलफ़िलमेंट ट्रैक करें', action: 'भुगतान किए गए ऑर्डर को डिस्पैच से डिलीवरी तक ट्रैक करें।', detail: 'ऑर्डर स्थिति, शिपमेंट जानकारी, दस्तावेज़ और सहायता कार्रवाइयाँ उसी ऑर्डर से जुड़ी रहती हैं।', icon: 'TruckIcon', screen: 'tracking' },
    ],
    sellerSteps: [
      { title: 'बिक्री सक्रिय करें', action: 'उसी FabricTrad खाते से विक्रेता सुविधाएँ सक्रिय करें।', detail: 'दूसरा लॉगिन बनाने के बजाय विक्रेता व्यवसाय प्रोफ़ाइल और आवश्यक सत्यापन पूरा करें।', icon: 'BuildingStorefrontIcon', screen: 'verify' },
      { title: 'सत्यापन पूरा करें', action: 'आवश्यक व्यवसाय विवरण और GST जानकारी जमा करें।', detail: 'उत्पाद प्रकाशित करने से पहले विक्रेता प्रक्रिया में आपकी तैयारी और सत्यापन स्थिति स्पष्ट दिखाई देनी चाहिए।', icon: 'ShieldCheckIcon', screen: 'verify' },
      { title: 'अपना कैटलॉग बनाएँ', action: 'सटीक विक्रेता-प्रदत्त जानकारी के साथ उत्पाद जोड़ें।', detail: 'उत्पाद मीडिया, वैरिएंट, रंग-स्तर स्टॉक, कीमत, MOQ, विनिर्देश और डिस्पैच विवरण अपलोड करें।', icon: 'PlusCircleIcon', screen: 'catalogue' },
      { title: 'इन्वेंटरी नियंत्रित करें', action: 'उपलब्धता और वैरिएंट हमेशा अपडेट रखें।', detail: 'एक ही विक्रेता कार्यक्षेत्र से उत्पाद स्थिति, स्टॉक, कीमत और कैटलॉग अपडेट प्रबंधित करें।', icon: 'ArchiveBoxIcon', screen: 'inventory' },
      { title: 'आने वाले ऑर्डर देखें', action: 'वास्तविक ऑर्डर रिकॉर्ड से उपलब्ध मात्रा स्वीकार, अस्वीकार या पुष्टि करें।', detail: 'जहाँ आवश्यक हो, विक्रेता-पक्ष पुष्टि के बाद ऑर्डर प्रवाह के अनुसार खरीदार भुगतान खुलता है।', icon: 'ClipboardDocumentListIcon', screen: 'order' },
      { title: 'भुगतान किए गए ऑर्डर पूरा करें', action: 'डिस्पैच करें, ट्रैकिंग जोड़ें और ऑर्डर अपडेट रखें।', detail: 'भुगतान, इनवॉइस, शिपमेंट स्थिति और फ़ुलफ़िलमेंट कार्रवाइयाँ उसी लेनदेन रिकॉर्ड से जुड़ी रहती हैं।', icon: 'TruckIcon', screen: 'fulfilment' },
    ],
  },
};

const bn: HowToUseCopy = {
  start: {
    publicBadge: 'সবার জন্য নির্দেশিকা · সাইন ইন প্রয়োজন নেই', eyebrow: 'FabricTrad কীভাবে ব্যবহার করবেন', title: 'আপনি কীভাবে FabricTrad ব্যবহার করতে চান তা বেছে নিন।', intro: 'সংশ্লিষ্ট নির্দেশিত ধাপ দেখতে ক্রেতা বা বিক্রেতা বেছে নিন। কোনো নির্দেশিকা দেখার জন্য অ্যাকাউন্ট বা লগইন দরকার নেই।',
    buyer: { eyebrow: 'ক্রেতাদের জন্য', title: 'FabricTrad-এ কীভাবে কিনবেন', description: 'কেনাকাটার সেটআপ, কাপড় খোঁজা, লিস্টিং যাচাই, অর্ডার, নিরাপদ পেমেন্ট ও ফুলফিলমেন্ট ট্র্যাকিং শিখুন।', bullets: ['পণ্য খুঁজুন ও তুলনা করুন', 'অর্ডার ও পেমেন্ট প্রবাহ', 'শিপমেন্ট ট্র্যাকিং'], button: 'ক্রেতা নির্দেশিকা দেখুন' },
    seller: { eyebrow: 'বিক্রেতাদের জন্য', title: 'FabricTrad-এ কীভাবে বিক্রি করবেন', description: 'বিক্রেতা সক্রিয়করণ, ব্যবসা যাচাই, ক্যাটালগ, ইনভেন্টরি, নতুন অর্ডার ও ফুলফিলমেন্ট শিখুন।', bullets: ['ব্যবসা ও GST যাচাই', 'পণ্য ও ইনভেন্টরি', 'অর্ডার ও ফুলফিলমেন্ট'], button: 'বিক্রেতা নির্দেশিকা দেখুন' },
    noAccountData: 'কোনো অ্যাকাউন্ট ডেটা লোড হয় না', safePreview: 'নিরাপদ পাবলিক প্রিভিউ', helpCentre: 'সহায়তা কেন্দ্র খুলুন',
  },
  guide: {
    eyebrow: 'FabricTrad কীভাবে ব্যবহার করবেন', title: 'ইন্টারফেসের চলাচল দেখে শিখুন।', intro: 'এই পাবলিক ওয়াকথ্রু সাইন ইন করার আগেই কাজ করে। ক্রেতা বা বিক্রেতা বেছে নিয়ে নির্দেশিত প্রবাহ চালান অথবা নিজে প্রতিটি স্ক্রিন দেখুন। প্রিভিউতে শুধু ইন্টারফেস প্লেসহোল্ডার থাকে; নকল পণ্য, রিভিউ, রেটিং বা লেনদেন দেখানো হয় না।', buyer: 'ক্রেতা', seller: 'বিক্রেতা', chooseWalkthrough: 'ওয়াকথ্রু বেছে নিন', walkthrough: 'ওয়াকথ্রু', step: 'ধাপ', of: 'এর মধ্যে', play: 'চালান', pause: 'থামান', playWalkthrough: 'ওয়াকথ্রু চালান', pauseWalkthrough: 'ওয়াকথ্রু থামান', previous: 'আগের', nextStep: 'পরের ধাপ', signIn: 'সাইন ইন', createAccount: 'অ্যাকাউন্ট তৈরি করুন', interactivePreview: 'ইন্টার‌্যাক্টিভ প্রিভিউ', view: 'ভিউ',
    buyerSidebar: ['মার্কেটপ্লেস', 'অর্ডার', 'ট্র্যাকিং'], sellerSidebar: ['ড্যাশবোর্ড', 'পণ্য', 'অর্ডার'], liveInteractionPreview: 'লাইভ ইন্টার‌্যাকশন প্রিভিউ', noLiveData: 'কোনো লাইভ ডেটা নেই', buyOnFabricTrad: 'FabricTrad-এ কিনুন', sellOnFabricTrad: 'FabricTrad-এ বিক্রি করুন', roleAwareSetup: 'ভূমিকা-ভিত্তিক সেটআপ আপনাকে শুধু প্রয়োজনীয় টুলগুলোর ওপর কেন্দ্রীভূত রাখে।', verificationShown: 'যাচাইয়ের অবস্থা এখানে দেখানো হয়', searchPlaceholder: 'কাপড়, রং, GSM, বিক্রেতা বা SKU খুঁজুন', filters: ['কাপড়ের ধরন', 'GSM', 'প্রস্থ', 'MOQ'], sellerProvidedMedia: 'বিক্রেতার দেওয়া মিডিয়া', productFacts: ['ভ্যারিয়েন্ট', 'স্টক', 'MOQ', 'ডিসপ্যাচ'], drapeSupported: 'সমর্থিত হলে Drape-On দেখা যাবে', addProduct: 'পণ্য যোগ করুন', updateStock: 'স্টক আপডেট করুন', tableHeaders: ['পণ্য', 'ভ্যারিয়েন্ট', 'স্টক', 'অবস্থা'], yourProduct: 'আপনার পণ্য', current: 'বর্তমান', orderCreated: 'অর্ডার তৈরি হয়েছে', sellerDecision: 'বিক্রেতার সিদ্ধান্ত / স্টক নিশ্চিতকরণ', sellerConfirmation: 'বিক্রেতার নিশ্চিতকরণ', dispatchTracking: 'ডিসপ্যাচ ও ট্র্যাকিং', recordCarriesStatus: 'আসল অর্ডার রেকর্ডেই এই অবস্থা রাখা হয়।', secureCheckout: 'নিরাপদ চেকআউট', paymentTiedToOrder: 'পেমেন্ট FabricTrad অর্ডারের সঙ্গে যুক্ত থাকে।', continueToPayment: 'পেমেন্টে এগিয়ে যান',
    buyerSteps: [
      { title: 'কেনার ধরন বেছে নিন', action: 'একটি অ্যাকাউন্ট তৈরি করে আপনার উপযোগী ক্রেতা সেটআপ বেছে নিন।', detail: 'ব্যক্তিগত ক্রেতারা রিটেল-সক্ষম লিস্টিং কিনতে পারেন। ব্যবসায়িক ক্রেতারা ট্রেড ক্রয়ের সুবিধার জন্য ব্যবসা যাচাই সম্পন্ন করতে পারেন।', icon: 'UserCircleIcon', screen: 'account' },
      { title: 'সঠিক কাপড় খুঁজুন', action: 'লাইভ মার্কেটপ্লেসে খুঁজুন ও ফিল্টার করুন।', detail: 'ক্যাটালগ ছোট করতে বিভাগ, রং, GSM, প্রস্থ, MOQ, দাম, ডিসপ্যাচ ও বিক্রেতার তথ্য ব্যবহার করুন।', icon: 'MagnifyingGlassIcon', screen: 'discover' },
      { title: 'অর্ডারের আগে যাচাই করুন', action: 'পণ্য খুলে বিক্রেতার দেওয়া লিস্টিং তথ্য দেখুন।', detail: 'ভ্যারিয়েন্ট, স্টক, স্পেসিফিকেশন, ডিসপ্যাচ তথ্য ও উপলব্ধ মিডিয়া যাচাই করুন। সমর্থিত হলে Drape-On ব্যবহার করুন।', icon: 'SparklesIcon', screen: 'product' },
      { title: 'অর্ডার অনুরোধ দিন', action: 'ভ্যারিয়েন্ট ও পরিমাণ বেছে নিয়ে অর্ডার প্রক্রিয়ায় এগিয়ে যান।', detail: 'যেখানে বিক্রেতার অনুমোদন দরকার, সেখানে পেমেন্টের আগে বিক্রেতা প্রাপ্যতা নিশ্চিত করেন।', icon: 'ShoppingBagIcon', screen: 'order' },
      { title: 'নিরাপদে পেমেন্ট করুন', action: 'শুধু FabricTrad চেকআউটের মাধ্যমে পেমেন্ট সম্পন্ন করুন।', detail: 'অর্ডার এগোনোর আগে পেমেন্ট প্রবাহ অর্ডার রেকর্ড ও সার্ভার-সাইড যাচাই ব্যবহার করে।', icon: 'CreditCardIcon', screen: 'payment' },
      { title: 'ফুলফিলমেন্ট ট্র্যাক করুন', action: 'পরিশোধিত অর্ডার ডিসপ্যাচ থেকে ডেলিভারি পর্যন্ত অনুসরণ করুন।', detail: 'অর্ডার স্ট্যাটাস, শিপমেন্ট তথ্য, নথি ও সহায়তার কাজ একই অর্ডারের সঙ্গে যুক্ত থাকে।', icon: 'TruckIcon', screen: 'tracking' },
    ],
    sellerSteps: [
      { title: 'বিক্রি সক্রিয় করুন', action: 'একই FabricTrad অ্যাকাউন্টে বিক্রেতা সুবিধা চালু করুন।', detail: 'দ্বিতীয় লগইন না বানিয়ে বিক্রেতার ব্যবসায়িক প্রোফাইল ও প্রয়োজনীয় যাচাই সম্পন্ন করুন।', icon: 'BuildingStorefrontIcon', screen: 'verify' },
      { title: 'যাচাই সম্পন্ন করুন', action: 'প্রয়োজনীয় ব্যবসায়িক তথ্য ও GST তথ্য জমা দিন।', detail: 'পণ্য প্রকাশের আগে বিক্রেতা প্রবাহে আপনার প্রস্তুতি ও যাচাইয়ের অবস্থা দেখা উচিত।', icon: 'ShieldCheckIcon', screen: 'verify' },
      { title: 'ক্যাটালগ তৈরি করুন', action: 'সঠিক বিক্রেতা-প্রদত্ত তথ্যসহ পণ্য যোগ করুন।', detail: 'পণ্যের মিডিয়া, ভ্যারিয়েন্ট, রংভিত্তিক স্টক, দাম, MOQ, স্পেসিফিকেশন ও ডিসপ্যাচ তথ্য আপলোড করুন।', icon: 'PlusCircleIcon', screen: 'catalogue' },
      { title: 'ইনভেন্টরি নিয়ন্ত্রণ করুন', action: 'প্রাপ্যতা ও ভ্যারিয়েন্ট হালনাগাদ রাখুন।', detail: 'এক জায়গা থেকে বিক্রেতা ওয়ার্কস্পেসে পণ্যের অবস্থা, স্টক, দাম ও ক্যাটালগ আপডেট পরিচালনা করুন।', icon: 'ArchiveBoxIcon', screen: 'inventory' },
      { title: 'নতুন অর্ডার পর্যালোচনা করুন', action: 'আসল অর্ডার রেকর্ড থেকে উপলব্ধ পরিমাণ গ্রহণ, প্রত্যাখ্যান বা নিশ্চিত করুন।', detail: 'প্রয়োজন হলে বিক্রেতার নিশ্চিতকরণের পরে অর্ডার প্রবাহ অনুযায়ী ক্রেতার পেমেন্ট খোলে।', icon: 'ClipboardDocumentListIcon', screen: 'order' },
      { title: 'পরিশোধিত অর্ডার সম্পন্ন করুন', action: 'ডিসপ্যাচ করুন, ট্র্যাকিং যুক্ত করুন এবং অর্ডার হালনাগাদ রাখুন।', detail: 'পেমেন্ট, ইনভয়েস, শিপমেন্ট স্ট্যাটাস ও ফুলফিলমেন্টের কাজ একই লেনদেন রেকর্ডের সঙ্গে যুক্ত থাকে।', icon: 'TruckIcon', screen: 'fulfilment' },
    ],
  },
};

const mr: HowToUseCopy = {
  start: {
    publicBadge: 'सार्वजनिक मार्गदर्शिका · साइन इन आवश्यक नाही', eyebrow: 'FabricTrad कसे वापरायचे', title: 'तुम्हाला FabricTrad कसे वापरायचे आहे ते निवडा.', intro: 'संबंधित मार्गदर्शित वॉकथ्रू पाहण्यासाठी खरेदीदार किंवा विक्रेता निवडा. कोणतीही मार्गदर्शिका पाहण्यासाठी खाते किंवा लॉगिन आवश्यक नाही.',
    buyer: { eyebrow: 'खरेदीदारांसाठी', title: 'FabricTrad वर कसे खरेदी करायची', description: 'खरेदी सेटअप, कापड शोधणे, लिस्टिंग तपासणे, ऑर्डर देणे, सुरक्षित पेमेंट आणि फुलफिलमेंट ट्रॅकिंग शिका.', bullets: ['उत्पादने शोधा आणि तुलना करा', 'ऑर्डर आणि पेमेंट प्रक्रिया', 'शिपमेंट ट्रॅकिंग'], button: 'खरेदीदार मार्गदर्शिका पाहा' },
    seller: { eyebrow: 'विक्रेत्यांसाठी', title: 'FabricTrad वर कसे विकायचे', description: 'विक्रेता सक्रिय करणे, व्यवसाय पडताळणी, कॅटलॉग, इन्व्हेंटरी, येणारे ऑर्डर आणि फुलफिलमेंट शिका.', bullets: ['व्यवसाय आणि GST पडताळणी', 'उत्पादने आणि इन्व्हेंटरी', 'ऑर्डर आणि फुलफिलमेंट'], button: 'विक्रेता मार्गदर्शिका पाहा' },
    noAccountData: 'कोणताही खाते डेटा लोड होत नाही', safePreview: 'सुरक्षित सार्वजनिक प्रीव्ह्यू', helpCentre: 'मदत केंद्र उघडा',
  },
  guide: {
    eyebrow: 'FabricTrad कसे वापरायचे', title: 'इंटरफेस चालताना पाहून शिका.', intro: 'हा सार्वजनिक वॉकथ्रू साइन इन करण्यापूर्वीही चालतो. खरेदीदार किंवा विक्रेता निवडा आणि मार्गदर्शित प्रवाह चालवा किंवा प्रत्येक स्क्रीन स्वतः पाहा. प्रीव्ह्यूमध्ये फक्त इंटरफेस प्लेसहोल्डर आहेत; बनावट उत्पादने, रिव्ह्यू, रेटिंग किंवा व्यवहार दाखवले जात नाहीत.', buyer: 'खरेदीदार', seller: 'विक्रेता', chooseWalkthrough: 'वॉकथ्रू निवडा', walkthrough: 'वॉकथ्रू', step: 'पायरी', of: 'पैकी', play: 'चालू करा', pause: 'थांबवा', playWalkthrough: 'वॉकथ्रू चालू करा', pauseWalkthrough: 'वॉकथ्रू थांबवा', previous: 'मागील', nextStep: 'पुढील पायरी', signIn: 'साइन इन', createAccount: 'खाते तयार करा', interactivePreview: 'इंटरॅक्टिव्ह प्रीव्ह्यू', view: 'दृश्य',
    buyerSidebar: ['मार्केटप्लेस', 'ऑर्डर', 'ट्रॅकिंग'], sellerSidebar: ['डॅशबोर्ड', 'उत्पादने', 'ऑर्डर'], liveInteractionPreview: 'लाइव्ह इंटरॅक्शन प्रीव्ह्यू', noLiveData: 'लाइव्ह डेटा नाही', buyOnFabricTrad: 'FabricTrad वर खरेदी करा', sellOnFabricTrad: 'FabricTrad वर विक्री करा', roleAwareSetup: 'भूमिकेनुसार सेटअप तुम्हाला प्रत्यक्ष गरजेच्या साधनांवरच लक्ष केंद्रित ठेवतो.', verificationShown: 'पडताळणी स्थिती येथे दिसते', searchPlaceholder: 'कापड, रंग, GSM, विक्रेते किंवा SKU शोधा', filters: ['कापड प्रकार', 'GSM', 'रुंदी', 'MOQ'], sellerProvidedMedia: 'विक्रेत्याने दिलेले मीडिया', productFacts: ['व्हेरियंट', 'स्टॉक', 'MOQ', 'डिस्पॅच'], drapeSupported: 'समर्थन असल्यास Drape-On दिसते', addProduct: 'उत्पादन जोडा', updateStock: 'स्टॉक अपडेट करा', tableHeaders: ['उत्पादन', 'व्हेरियंट', 'स्टॉक', 'स्थिती'], yourProduct: 'तुमचे उत्पादन', current: 'सध्याचे', orderCreated: 'ऑर्डर तयार', sellerDecision: 'विक्रेता निर्णय / स्टॉक पुष्टी', sellerConfirmation: 'विक्रेता पुष्टी', dispatchTracking: 'डिस्पॅच आणि ट्रॅकिंग', recordCarriesStatus: 'ही स्थिती वास्तविक ऑर्डर नोंदीत राहते.', secureCheckout: 'सुरक्षित चेकआउट', paymentTiedToOrder: 'पेमेंट FabricTrad ऑर्डरशी जोडलेले आहे.', continueToPayment: 'पेमेंटकडे पुढे जा',
    buyerSteps: [
      { title: 'खरेदीची पद्धत निवडा', action: 'एक खाते तयार करून तुमच्यासाठी योग्य खरेदीदार सेटअप निवडा.', detail: 'वैयक्तिक खरेदीदार रिटेल-सक्षम लिस्टिंग खरेदी करू शकतात. व्यावसायिक खरेदीदार ट्रेड खरेदी सुविधांसाठी व्यवसाय पडताळणी पूर्ण करू शकतात.', icon: 'UserCircleIcon', screen: 'account' },
      { title: 'योग्य कापड शोधा', action: 'लाइव्ह मार्केटप्लेसमध्ये शोधा आणि फिल्टर करा.', detail: 'कॅटलॉग कमी करण्यासाठी श्रेणी, रंग, GSM, रुंदी, MOQ, किंमत, डिस्पॅच आणि विक्रेता माहिती वापरा.', icon: 'MagnifyingGlassIcon', screen: 'discover' },
      { title: 'ऑर्डरपूर्वी तपासा', action: 'उत्पादन उघडून विक्रेत्याने दिलेली लिस्टिंग माहिती तपासा.', detail: 'व्हेरियंट, स्टॉक, तपशील, डिस्पॅच माहिती आणि उपलब्ध मीडिया तपासा. समर्थन असल्यास Drape-On वापरा.', icon: 'SparklesIcon', screen: 'product' },
      { title: 'ऑर्डर विनंती करा', action: 'व्हेरियंट आणि प्रमाण निवडून ऑर्डर प्रक्रियेत पुढे जा.', detail: 'जिथे विक्रेत्याची स्वीकृती आवश्यक आहे तिथे पेमेंटपूर्वी विक्रेता उपलब्धता पुष्टी करतो.', icon: 'ShoppingBagIcon', screen: 'order' },
      { title: 'सुरक्षित पेमेंट करा', action: 'पेमेंट फक्त FabricTrad चेकआउटमधून पूर्ण करा.', detail: 'ऑर्डर पुढे जाण्यापूर्वी पेमेंट प्रक्रिया ऑर्डर रेकॉर्ड आणि सर्व्हर-साइड पडताळणी वापरते.', icon: 'CreditCardIcon', screen: 'payment' },
      { title: 'फुलफिलमेंट ट्रॅक करा', action: 'भरलेल्या ऑर्डरचा डिस्पॅचपासून डिलिव्हरीपर्यंत मागोवा घ्या.', detail: 'ऑर्डर स्थिती, शिपमेंट माहिती, दस्तऐवज आणि सहाय्य कृती त्याच ऑर्डरशी जोडलेल्या राहतात.', icon: 'TruckIcon', screen: 'tracking' },
    ],
    sellerSteps: [
      { title: 'विक्री सक्रिय करा', action: 'त्याच FabricTrad खात्यातून विक्रेता सुविधा सुरू करा.', detail: 'दुसरे लॉगिन न बनवता विक्रेता व्यवसाय प्रोफाइल आणि आवश्यक पडताळणी पूर्ण करा.', icon: 'BuildingStorefrontIcon', screen: 'verify' },
      { title: 'पडताळणी पूर्ण करा', action: 'आवश्यक व्यवसाय तपशील आणि GST माहिती सादर करा.', detail: 'उत्पादने प्रकाशित करण्यापूर्वी विक्रेता प्रवाहात तुमची तयारी आणि पडताळणी स्थिती स्पष्ट दिसली पाहिजे.', icon: 'ShieldCheckIcon', screen: 'verify' },
      { title: 'कॅटलॉग तयार करा', action: 'अचूक विक्रेता-प्रदत्त माहितीसह उत्पादने जोडा.', detail: 'उत्पादन मीडिया, व्हेरियंट, रंगनिहाय स्टॉक, किंमत, MOQ, तपशील आणि डिस्पॅच माहिती अपलोड करा.', icon: 'PlusCircleIcon', screen: 'catalogue' },
      { title: 'इन्व्हेंटरी नियंत्रित करा', action: 'उपलब्धता आणि व्हेरियंट अद्ययावत ठेवा.', detail: 'एकाच विक्रेता वर्कस्पेसमधून उत्पादन स्थिती, स्टॉक, किंमत आणि कॅटलॉग अपडेट व्यवस्थापित करा.', icon: 'ArchiveBoxIcon', screen: 'inventory' },
      { title: 'येणारे ऑर्डर तपासा', action: 'वास्तविक ऑर्डर रेकॉर्डमधून उपलब्ध प्रमाण स्वीकारा, नाकारा किंवा पुष्टी करा.', detail: 'आवश्यक असल्यास विक्रेता-पक्ष पुष्टीनंतर ऑर्डर प्रवाहानुसार खरेदीदार पेमेंट सुरू होते.', icon: 'ClipboardDocumentListIcon', screen: 'order' },
      { title: 'भरलेले ऑर्डर पूर्ण करा', action: 'डिस्पॅच करा, ट्रॅकिंग जोडा आणि ऑर्डर अद्ययावत ठेवा.', detail: 'पेमेंट, इनव्हॉइस, शिपमेंट स्थिती आणि फुलफिलमेंट कृती त्याच व्यवहार नोंदीशी जोडलेल्या राहतात.', icon: 'TruckIcon', screen: 'fulfilment' },
    ],
  },
};

const gu: HowToUseCopy = {
  start: {
    publicBadge: 'જાહેર માર્ગદર્શિકા · સાઇન ઇન જરૂરી નથી', eyebrow: 'FabricTrad કેવી રીતે વાપરવું', title: 'તમે FabricTrad કેવી રીતે વાપરવા માંગો છો તે પસંદ કરો.', intro: 'સંબંધિત માર્ગદર્શિત પ્રક્રિયા જોવા ખરીદદાર અથવા વેચનાર પસંદ કરો. કોઈપણ માર્ગદર્શિકા જોવા માટે ખાતું કે લૉગિન જરૂરી નથી.',
    buyer: { eyebrow: 'ખરીદદારો માટે', title: 'FabricTrad પર કેવી રીતે ખરીદવું', description: 'ખરીદી સેટઅપ, કાપડ શોધવું, લિસ્ટિંગ તપાસવું, ઓર્ડર મૂકવો, સુરક્ષિત ચુકવણી અને ફુલફિલમેન્ટ ટ્રૅક કરવું શીખો.', bullets: ['પ્રોડક્ટ શોધો અને સરખાવો', 'ઓર્ડર અને ચુકવણી પ્રક્રિયા', 'શિપમેન્ટ ટ્રૅકિંગ'], button: 'ખરીદદાર માર્ગદર્શિકા જુઓ' },
    seller: { eyebrow: 'વેચાણકર્તાઓ માટે', title: 'FabricTrad પર કેવી રીતે વેચવું', description: 'વેચનાર સક્રિયકરણ, વ્યવસાય ચકાસણી, કેટલોગ, ઇન્વેન્ટરી, નવા ઓર્ડર અને ફુલફિલમેન્ટ શીખો.', bullets: ['વ્યવસાય અને GST ચકાસણી', 'પ્રોડક્ટ અને ઇન્વેન્ટરી', 'ઓર્ડર અને ફુલફિલમેન્ટ'], button: 'વેચનાર માર્ગદર્શિકા જુઓ' },
    noAccountData: 'કોઈ ખાતા ડેટા લોડ થતા નથી', safePreview: 'સુરક્ષિત જાહેર પ્રીવ્યૂ', helpCentre: 'મદદ કેન્દ્ર ખોલો',
  },
  guide: {
    eyebrow: 'FabricTrad કેવી રીતે વાપરવું', title: 'ઇન્ટરફેસ ચાલતું જોઈને શીખો.', intro: 'આ જાહેર વૉકથ્રૂ સાઇન ઇન કરતાં પહેલાં પણ ચાલે છે. ખરીદદાર અથવા વેચનાર પસંદ કરો અને માર્ગદર્શિત પ્રવાહ ચલાવો અથવા દરેક સ્ક્રીન જાતે જુઓ. પ્રીવ્યૂમાં ફક્ત ઇન્ટરફેસ પ્લેસહોલ્ડર છે; નકલી પ્રોડક્ટ, રિવ્યૂ, રેટિંગ કે વ્યવહાર બતાવવામાં આવતા નથી.', buyer: 'ખરીદદાર', seller: 'વેચનાર', chooseWalkthrough: 'વૉકથ્રૂ પસંદ કરો', walkthrough: 'વૉકથ્રૂ', step: 'પગલું', of: 'માંથી', play: 'ચાલુ કરો', pause: 'થોભાવો', playWalkthrough: 'વૉકથ્રૂ ચાલુ કરો', pauseWalkthrough: 'વૉકથ્રૂ થોભાવો', previous: 'પાછલું', nextStep: 'આગલું પગલું', signIn: 'સાઇન ઇન', createAccount: 'ખાતું બનાવો', interactivePreview: 'ઇન્ટરેક્ટિવ પ્રીવ્યૂ', view: 'દૃશ્ય',
    buyerSidebar: ['માર્કેટપ્લેસ', 'ઓર્ડર', 'ટ્રૅકિંગ'], sellerSidebar: ['ડૅશબોર્ડ', 'પ્રોડક્ટ', 'ઓર્ડર'], liveInteractionPreview: 'લાઇવ ઇન્ટરૅક્શન પ્રીવ્યૂ', noLiveData: 'કોઈ લાઇવ ડેટા નથી', buyOnFabricTrad: 'FabricTrad પર ખરીદો', sellOnFabricTrad: 'FabricTrad પર વેચો', roleAwareSetup: 'ભૂમિકા-આધારિત સેટઅપ તમને ખરેખર જરૂરી ટૂલ્સ પર જ કેન્દ્રિત રાખે છે.', verificationShown: 'ચકાસણીની સ્થિતિ અહીં દેખાય છે', searchPlaceholder: 'કાપડ, રંગ, GSM, વેચનાર અથવા SKU શોધો', filters: ['કાપડનો પ્રકાર', 'GSM', 'પહોળાઈ', 'MOQ'], sellerProvidedMedia: 'વેચનાર દ્વારા આપેલું મીડિયા', productFacts: ['વેરિઅન્ટ', 'સ્ટોક', 'MOQ', 'ડિસ્પૅચ'], drapeSupported: 'સપોર્ટ હોય ત્યારે Drape-On દેખાય છે', addProduct: 'પ્રોડક્ટ ઉમેરો', updateStock: 'સ્ટોક અપડેટ કરો', tableHeaders: ['પ્રોડક્ટ', 'વેરિઅન્ટ', 'સ્ટોક', 'સ્થિતિ'], yourProduct: 'તમારી પ્રોડક્ટ', current: 'વર્તમાન', orderCreated: 'ઓર્ડર બનાવાયો', sellerDecision: 'વેચનાર નિર્ણય / સ્ટોક પુષ્ટિ', sellerConfirmation: 'વેચનાર પુષ્ટિ', dispatchTracking: 'ડિસ્પૅચ અને ટ્રૅકિંગ', recordCarriesStatus: 'વાસ્તવિક ઓર્ડર રેકોર્ડમાં આ સ્થિતિ રહે છે.', secureCheckout: 'સુરક્ષિત ચેકઆઉટ', paymentTiedToOrder: 'ચુકવણી FabricTrad ઓર્ડર સાથે જોડાયેલી છે.', continueToPayment: 'ચુકવણી માટે આગળ વધો',
    buyerSteps: [
      { title: 'ખરીદીની રીત પસંદ કરો', action: 'એક ખાતું બનાવો અને તમારા માટે યોગ્ય ખરીદદાર સેટઅપ પસંદ કરો.', detail: 'વ્યક્તિગત ખરીદદારો રિટેલ-સક્ષમ લિસ્ટિંગ ખરીદી શકે છે. વ્યવસાયિક ખરીદદારો ટ્રેડ ખરીદી સુવિધાઓ માટે વ્યવસાય ચકાસણી પૂર્ણ કરી શકે છે.', icon: 'UserCircleIcon', screen: 'account' },
      { title: 'યોગ્ય કાપડ શોધો', action: 'લાઇવ માર્કેટપ્લેસમાં શોધો અને ફિલ્ટર કરો.', detail: 'કેટલોગ સંકુચિત કરવા કેટેગરી, રંગ, GSM, પહોળાઈ, MOQ, કિંમત, ડિસ્પૅચ અને વેચનાર માહિતી વાપરો.', icon: 'MagnifyingGlassIcon', screen: 'discover' },
      { title: 'ઓર્ડર પહેલાં તપાસો', action: 'પ્રોડક્ટ ખોલીને વેચનાર દ્વારા આપવામાં આવેલી લિસ્ટિંગ વિગતો જુઓ.', detail: 'વેરિઅન્ટ, સ્ટોક, વિશિષ્ટતાઓ, ડિસ્પૅચ માહિતી અને ઉપલબ્ધ મીડિયા તપાસો. સપોર્ટ હોય ત્યાં Drape-On વાપરો.', icon: 'SparklesIcon', screen: 'product' },
      { title: 'ઓર્ડર વિનંતી મૂકો', action: 'વેરિઅન્ટ અને જથ્થો પસંદ કરીને ઓર્ડર પ્રવાહમાં આગળ વધો.', detail: 'જ્યાં વેચનાર સ્વીકૃતિ જરૂરી હોય ત્યાં ચુકવણી પહેલાં વેચનાર ઉપલબ્ધતા પુષ્ટિ કરે છે.', icon: 'ShoppingBagIcon', screen: 'order' },
      { title: 'સુરક્ષિત ચુકવણી કરો', action: 'ચુકવણી ફક્ત FabricTrad ચેકઆઉટથી પૂર્ણ કરો.', detail: 'ઓર્ડર આગળ વધે તે પહેલાં ચુકવણી પ્રક્રિયા ઓર્ડર રેકોર્ડ અને સર્વર-સાઇડ ચકાસણી વાપરે છે.', icon: 'CreditCardIcon', screen: 'payment' },
      { title: 'ફુલફિલમેન્ટ ટ્રૅક કરો', action: 'ચૂકવાયેલા ઓર્ડરને ડિસ્પૅચથી ડિલિવરી સુધી અનુસરો.', detail: 'ઓર્ડર સ્થિતિ, શિપમેન્ટ માહિતી, દસ્તાવેજો અને સહાયની ક્રિયાઓ એ જ ઓર્ડર સાથે જોડાયેલી રહે છે.', icon: 'TruckIcon', screen: 'tracking' },
    ],
    sellerSteps: [
      { title: 'વેચાણ સક્રિય કરો', action: 'એ જ FabricTrad ખાતાથી વેચનાર સુવિધાઓ સક્રિય કરો.', detail: 'બીજો લૉગિન બનાવવાને બદલે વેચનાર વ્યવસાય પ્રોફાઇલ અને જરૂરી ચકાસણી પૂર્ણ કરો.', icon: 'BuildingStorefrontIcon', screen: 'verify' },
      { title: 'ચકાસણી પૂર્ણ કરો', action: 'જરૂરી વ્યવસાય વિગતો અને GST માહિતી સબમિટ કરો.', detail: 'પ્રોડક્ટ પ્રકાશિત કરતાં પહેલાં વેચનાર પ્રવાહમાં તમારી તૈયારી અને ચકાસણી સ્થિતિ સ્પષ્ટ દેખાવા જોઈએ.', icon: 'ShieldCheckIcon', screen: 'verify' },
      { title: 'તમારો કેટલોગ બનાવો', action: 'ચોક્કસ વેચનાર-પ્રદાન માહિતી સાથે પ્રોડક્ટ ઉમેરો.', detail: 'પ્રોડક્ટ મીડિયા, વેરિઅન્ટ, રંગ-સ્તર સ્ટોક, કિંમત, MOQ, વિશિષ્ટતાઓ અને ડિસ્પૅચ વિગતો અપલોડ કરો.', icon: 'PlusCircleIcon', screen: 'catalogue' },
      { title: 'ઇન્વેન્ટરી નિયંત્રિત કરો', action: 'ઉપલબ્ધતા અને વેરિઅન્ટ અપડેટ રાખો.', detail: 'એક જ વેચનાર વર્કસ્પેસથી પ્રોડક્ટ સ્થિતિ, સ્ટોક, કિંમત અને કેટલોગ અપડેટ સંભાળો.', icon: 'ArchiveBoxIcon', screen: 'inventory' },
      { title: 'આવતા ઓર્ડર તપાસો', action: 'વાસ્તવિક ઓર્ડર રેકોર્ડથી ઉપલબ્ધ જથ્થો સ્વીકારો, નકારો અથવા પુષ્ટિ કરો.', detail: 'જરૂર પડે ત્યારે વેચનાર-પક્ષ પુષ્ટિ પછી ઓર્ડર પ્રવાહ મુજબ ખરીદદાર ચુકવણી ખૂલે છે.', icon: 'ClipboardDocumentListIcon', screen: 'order' },
      { title: 'ચૂકવાયેલા ઓર્ડર પૂર્ણ કરો', action: 'ડિસ્પૅચ કરો, ટ્રૅકિંગ જોડો અને ઓર્ડર અપડેટ રાખો.', detail: 'ચુકવણી, ઇન્વૉઇસ, શિપમેન્ટ સ્થિતિ અને ફુલફિલમેન્ટ ક્રિયાઓ એ જ વ્યવહાર રેકોર્ડ સાથે જોડાયેલી રહે છે.', icon: 'TruckIcon', screen: 'fulfilment' },
    ],
  },
};

const kn: HowToUseCopy = {
  start: {
    publicBadge: 'ಸಾರ್ವಜನಿಕ ಮಾರ್ಗದರ್ಶಿಗಳು · ಸೈನ್ ಇನ್ ಅಗತ್ಯವಿಲ್ಲ', eyebrow: 'FabricTrad ಅನ್ನು ಹೇಗೆ ಬಳಸುವುದು', title: 'ನೀವು FabricTrad ಅನ್ನು ಹೇಗೆ ಬಳಸಲು ಬಯಸುತ್ತೀರಿ ಎಂಬುದನ್ನು ಆಯ್ಕೆಮಾಡಿ.', intro: 'ಸಂಬಂಧಿತ ಮಾರ್ಗದರ್ಶಿತ ವಾಕ್‌ಥ್ರೂ ನೋಡಲು ಖರೀದಿದಾರ ಅಥವಾ ಮಾರಾಟಗಾರರನ್ನು ಆಯ್ಕೆಮಾಡಿ. ಯಾವುದೇ ಮಾರ್ಗದರ್ಶಿ ನೋಡಲು ಖಾತೆ ಅಥವಾ ಲಾಗಿನ್ ಅಗತ್ಯವಿಲ್ಲ.',
    buyer: { eyebrow: 'ಖರೀದಿದಾರರಿಗಾಗಿ', title: 'FabricTrad ನಲ್ಲಿ ಹೇಗೆ ಖರೀದಿಸಬೇಕು', description: 'ಖರೀದಿ ಸೆಟಪ್, ಬಟ್ಟೆ ಹುಡುಕುವುದು, ಲಿಸ್ಟಿಂಗ್ ಪರಿಶೀಲಿಸುವುದು, ಆರ್ಡರ್, ಸುರಕ್ಷಿತ ಪಾವತಿ ಮತ್ತು ಫುಲ್ಫಿಲ್ಮೆಂಟ್ ಟ್ರ್ಯಾಕಿಂಗ್ ಕಲಿಯಿರಿ.', bullets: ['ಉತ್ಪನ್ನ ಹುಡುಕಿ ಮತ್ತು ಹೋಲಿಸಿ', 'ಆರ್ಡರ್ ಮತ್ತು ಪಾವತಿ ಪ್ರಕ್ರಿಯೆ', 'ಶಿಪ್ಮೆಂಟ್ ಟ್ರ್ಯಾಕಿಂಗ್'], button: 'ಖರೀದಿದಾರ ಮಾರ್ಗದರ್ಶಿ ನೋಡಿ' },
    seller: { eyebrow: 'ಮಾರಾಟಗಾರರಿಗಾಗಿ', title: 'FabricTrad ನಲ್ಲಿ ಹೇಗೆ ಮಾರಾಟ ಮಾಡಬೇಕು', description: 'ಮಾರಾಟಗಾರ ಸಕ್ರಿಯಗೊಳಿಸುವಿಕೆ, ವ್ಯಾಪಾರ ಪರಿಶೀಲನೆ, ಕ್ಯಾಟಲಾಗ್, ಇನ್‌ವೆಂಟರಿ, ಹೊಸ ಆರ್ಡರ್ ಮತ್ತು ಫುಲ್ಫಿಲ್ಮೆಂಟ್ ಕಲಿಯಿರಿ.', bullets: ['ವ್ಯಾಪಾರ ಮತ್ತು GST ಪರಿಶೀಲನೆ', 'ಉತ್ಪನ್ನಗಳು ಮತ್ತು ಇನ್‌ವೆಂಟರಿ', 'ಆರ್ಡರ್ ಮತ್ತು ಫುಲ್ಫಿಲ್ಮೆಂಟ್'], button: 'ಮಾರಾಟಗಾರ ಮಾರ್ಗದರ್ಶಿ ನೋಡಿ' },
    noAccountData: 'ಯಾವುದೇ ಖಾತೆ ಡೇಟಾ ಲೋಡ್ ಆಗುವುದಿಲ್ಲ', safePreview: 'ಸುರಕ್ಷಿತ ಸಾರ್ವಜನಿಕ ಪ್ರಿವ್ಯೂ', helpCentre: 'ಸಹಾಯ ಕೇಂದ್ರ ತೆರೆಯಿರಿ',
  },
  guide: {
    eyebrow: 'FabricTrad ಅನ್ನು ಹೇಗೆ ಬಳಸುವುದು', title: 'ಇಂಟರ್ಫೇಸ್ ಚಲಿಸುವುದನ್ನು ನೋಡಿ ಕಲಿಯಿರಿ.', intro: 'ಈ ಸಾರ್ವಜನಿಕ ವಾಕ್‌ಥ್ರೂ ಸೈನ್ ಇನ್ ಮಾಡುವ ಮೊದಲೇ ಕೆಲಸ ಮಾಡುತ್ತದೆ. ಖರೀದಿದಾರ ಅಥವಾ ಮಾರಾಟಗಾರರನ್ನು ಆಯ್ಕೆಮಾಡಿ, ಮಾರ್ಗದರ್ಶಿತ ಹರಿವನ್ನು ಪ್ಲೇ ಮಾಡಿ ಅಥವಾ ಪ್ರತಿಯೊಂದು ಸ್ಕ್ರೀನ್ ಅನ್ನು ನೀವೇ ನೋಡಿ. ಪ್ರಿವ್ಯೂದಲ್ಲಿ ಇಂಟರ್ಫೇಸ್ ಪ್ಲೇಸ್‌ಹೋಲ್ಡರ್‌ಗಳು ಮಾತ್ರ ಇರುತ್ತವೆ; ನಕಲಿ ಉತ್ಪನ್ನಗಳು, ವಿಮರ್ಶೆಗಳು, ರೇಟಿಂಗ್‌ಗಳು ಅಥವಾ ವ್ಯವಹಾರಗಳನ್ನು ತೋರಿಸಲಾಗುವುದಿಲ್ಲ.', buyer: 'ಖರೀದಿದಾರ', seller: 'ಮಾರಾಟಗಾರ', chooseWalkthrough: 'ವಾಕ್‌ಥ್ರೂ ಆಯ್ಕೆಮಾಡಿ', walkthrough: 'ವಾಕ್‌ಥ್ರೂ', step: 'ಹಂತ', of: 'ರಲ್ಲಿ', play: 'ಪ್ಲೇ', pause: 'ವಿರಾಮ', playWalkthrough: 'ವಾಕ್‌ಥ್ರೂ ಪ್ಲೇ ಮಾಡಿ', pauseWalkthrough: 'ವಾಕ್‌ಥ್ರೂ ವಿರಾಮಗೊಳಿಸಿ', previous: 'ಹಿಂದಿನದು', nextStep: 'ಮುಂದಿನ ಹಂತ', signIn: 'ಸೈನ್ ಇನ್', createAccount: 'ಖಾತೆ ರಚಿಸಿ', interactivePreview: 'ಇಂಟರಾಕ್ಟಿವ್ ಪ್ರಿವ್ಯೂ', view: 'ವೀಕ್ಷಣೆ',
    buyerSidebar: ['ಮಾರ್ಕೆಟ್‌ಪ್ಲೇಸ್', 'ಆರ್ಡರ್‌ಗಳು', 'ಟ್ರ್ಯಾಕಿಂಗ್'], sellerSidebar: ['ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', 'ಉತ್ಪನ್ನಗಳು', 'ಆರ್ಡರ್‌ಗಳು'], liveInteractionPreview: 'ಲೈವ್ ಇಂಟರಾಕ್ಷನ್ ಪ್ರಿವ್ಯೂ', noLiveData: 'ಲೈವ್ ಡೇಟಾ ಇಲ್ಲ', buyOnFabricTrad: 'FabricTrad ನಲ್ಲಿ ಖರೀದಿಸಿ', sellOnFabricTrad: 'FabricTrad ನಲ್ಲಿ ಮಾರಾಟ ಮಾಡಿ', roleAwareSetup: 'ಪಾತ್ರ-ಆಧಾರಿತ ಸೆಟಪ್ ನಿಮಗೆ ನಿಜವಾಗಿ ಬೇಕಾದ ಟೂಲ್‌ಗಳ ಮೇಲಷ್ಟೇ ಗಮನ ಕೇಂದ್ರೀಕರಿಸುತ್ತದೆ.', verificationShown: 'ಪರಿಶೀಲನೆ ಸ್ಥಿತಿ ಇಲ್ಲಿ ತೋರಿಸಲಾಗುತ್ತದೆ', searchPlaceholder: 'ಬಟ್ಟೆ, ಬಣ್ಣ, GSM, ಮಾರಾಟಗಾರ ಅಥವಾ SKU ಹುಡುಕಿ', filters: ['ಬಟ್ಟೆಯ ಪ್ರಕಾರ', 'GSM', 'ಅಗಲ', 'MOQ'], sellerProvidedMedia: 'ಮಾರಾಟಗಾರ ನೀಡಿದ ಮೀಡಿಯಾ', productFacts: ['ವೇರಿಯಂಟ್‌ಗಳು', 'ಸ್ಟಾಕ್', 'MOQ', 'ಡಿಸ್ಪ್ಯಾಚ್'], drapeSupported: 'ಬೆಂಬಲ ಇದ್ದಾಗ Drape-On ಕಾಣಿಸುತ್ತದೆ', addProduct: 'ಉತ್ಪನ್ನ ಸೇರಿಸಿ', updateStock: 'ಸ್ಟಾಕ್ ಅಪ್‌ಡೇಟ್ ಮಾಡಿ', tableHeaders: ['ಉತ್ಪನ್ನ', 'ವೇರಿಯಂಟ್‌ಗಳು', 'ಸ್ಟಾಕ್', 'ಸ್ಥಿತಿ'], yourProduct: 'ನಿಮ್ಮ ಉತ್ಪನ್ನ', current: 'ಪ್ರಸ್ತುತ', orderCreated: 'ಆರ್ಡರ್ ರಚಿಸಲಾಗಿದೆ', sellerDecision: 'ಮಾರಾಟಗಾರ ನಿರ್ಧಾರ / ಸ್ಟಾಕ್ ದೃಢೀಕರಣ', sellerConfirmation: 'ಮಾರಾಟಗಾರ ದೃಢೀಕರಣ', dispatchTracking: 'ಡಿಸ್ಪ್ಯಾಚ್ ಮತ್ತು ಟ್ರ್ಯಾಕಿಂಗ್', recordCarriesStatus: 'ಈ ಸ್ಥಿತಿ ನೈಜ ಆರ್ಡರ್ ದಾಖಲೆಯಲ್ಲೇ ಇರುತ್ತದೆ.', secureCheckout: 'ಸುರಕ್ಷಿತ ಚೆಕ್‌ಔಟ್', paymentTiedToOrder: 'ಪಾವತಿ FabricTrad ಆರ್ಡರ್‌ಗೆ ಜೋಡಿತವಾಗಿರುತ್ತದೆ.', continueToPayment: 'ಪಾವತಿಗೆ ಮುಂದುವರಿಸಿ',
    buyerSteps: [
      { title: 'ಖರೀದಿ ವಿಧಾನ ಆಯ್ಕೆಮಾಡಿ', action: 'ಒಂದು ಖಾತೆ ರಚಿಸಿ ಮತ್ತು ನಿಮಗೆ ಸರಿಯಾದ ಖರೀದಿದಾರ ಸೆಟಪ್ ಆಯ್ಕೆಮಾಡಿ.', detail: 'ವೈಯಕ್ತಿಕ ಖರೀದಿದಾರರು ರಿಟೇಲ್-ಸಕ್ರಿಯ ಲಿಸ್ಟಿಂಗ್‌ಗಳನ್ನು ಖರೀದಿಸಬಹುದು. ವ್ಯವಹಾರ ಖರೀದಿದಾರರು ಟ್ರೇಡ್ ಖರೀದಿ ಸೌಲಭ್ಯಗಳಿಗಾಗಿ ವ್ಯವಹಾರ ಪರಿಶೀಲನೆ ಪೂರ್ಣಗೊಳಿಸಬಹುದು.', icon: 'UserCircleIcon', screen: 'account' },
      { title: 'ಸರಿಯಾದ ಬಟ್ಟೆ ಹುಡುಕಿ', action: 'ಲೈವ್ ಮಾರ್ಕೆಟ್‌ಪ್ಲೇಸ್‌ನಲ್ಲಿ ಹುಡುಕಿ ಮತ್ತು ಫಿಲ್ಟರ್ ಮಾಡಿ.', detail: 'ಕ್ಯಾಟಲಾಗ್ ಅನ್ನು ಸೀಮಿತಗೊಳಿಸಲು ವರ್ಗ, ಬಣ್ಣ, GSM, ಅಗಲ, MOQ, ಬೆಲೆ, ಡಿಸ್ಪ್ಯಾಚ್ ಮತ್ತು ಮಾರಾಟಗಾರ ಮಾಹಿತಿ ಬಳಸಿ.', icon: 'MagnifyingGlassIcon', screen: 'discover' },
      { title: 'ಆರ್ಡರ್ ಮಾಡುವ ಮೊದಲು ಪರಿಶೀಲಿಸಿ', action: 'ಉತ್ಪನ್ನ ತೆರೆಯಿರಿ ಮತ್ತು ಮಾರಾಟಗಾರ ನೀಡಿದ ಲಿಸ್ಟಿಂಗ್ ವಿವರಗಳನ್ನು ನೋಡಿ.', detail: 'ವೇರಿಯಂಟ್, ಸ್ಟಾಕ್, ವಿಶೇಷಣ, ಡಿಸ್ಪ್ಯಾಚ್ ಮಾಹಿತಿ ಮತ್ತು ಲಭ್ಯ ಮೀಡಿಯಾ ಪರಿಶೀಲಿಸಿ. ಬೆಂಬಲವಿದ್ದಲ್ಲಿ Drape-On ಬಳಸಿ.', icon: 'SparklesIcon', screen: 'product' },
      { title: 'ಆರ್ಡರ್ ವಿನಂತಿ ಮಾಡಿ', action: 'ವೇರಿಯಂಟ್ ಮತ್ತು ಪ್ರಮಾಣ ಆಯ್ಕೆಮಾಡಿ ಆರ್ಡರ್ ಪ್ರಕ್ರಿಯೆಯಲ್ಲಿ ಮುಂದುವರಿಸಿ.', detail: 'ಮಾರಾಟಗಾರರ ಸ್ವೀಕೃತಿ ಅಗತ್ಯವಿದ್ದಲ್ಲಿ ಪಾವತಿಗೂ ಮೊದಲು ಮಾರಾಟಗಾರ ಲಭ್ಯತೆಯನ್ನು ದೃಢಪಡಿಸುತ್ತಾರೆ.', icon: 'ShoppingBagIcon', screen: 'order' },
      { title: 'ಸುರಕ್ಷಿತವಾಗಿ ಪಾವತಿಸಿ', action: 'ಪಾವತಿಯನ್ನು FabricTrad ಚೆಕ್‌ಔಟ್ ಮೂಲಕ ಮಾತ್ರ ಪೂರ್ಣಗೊಳಿಸಿ.', detail: 'ಆರ್ಡರ್ ಮುಂದುವರಿಯುವ ಮೊದಲು ಪಾವತಿ ಪ್ರಕ್ರಿಯೆ ಆರ್ಡರ್ ದಾಖಲೆ ಮತ್ತು ಸರ್ವರ್-ಸೈಡ್ ಪರಿಶೀಲನೆಯನ್ನು ಬಳಸುತ್ತದೆ.', icon: 'CreditCardIcon', screen: 'payment' },
      { title: 'ಫುಲ್ಫಿಲ್ಮೆಂಟ್ ಟ್ರ್ಯಾಕ್ ಮಾಡಿ', action: 'ಪಾವತಿಸಿದ ಆರ್ಡರ್ ಅನ್ನು ಡಿಸ್ಪ್ಯಾಚ್‌ನಿಂದ ಡೆಲಿವರಿವರೆಗೆ ಅನುಸರಿಸಿ.', detail: 'ಆರ್ಡರ್ ಸ್ಥಿತಿ, ಶಿಪ್ಮೆಂಟ್ ಮಾಹಿತಿ, ದಾಖಲೆಗಳು ಮತ್ತು ಬೆಂಬಲ ಕ್ರಮಗಳು ಅದೇ ಆರ್ಡರ್‌ಗೆ ಜೋಡಿತವಾಗಿರುತ್ತವೆ.', icon: 'TruckIcon', screen: 'tracking' },
    ],
    sellerSteps: [
      { title: 'ಮಾರಾಟ ಸಕ್ರಿಯಗೊಳಿಸಿ', action: 'ಅದೇ FabricTrad ಖಾತೆಯಿಂದ ಮಾರಾಟಗಾರ ಸೌಲಭ್ಯಗಳನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಿ.', detail: 'ಎರಡನೇ ಲಾಗಿನ್ ಸೃಷ್ಟಿಸುವ ಬದಲು ಮಾರಾಟಗಾರ ವ್ಯವಹಾರ ಪ್ರೊಫೈಲ್ ಮತ್ತು ಅಗತ್ಯ ಪರಿಶೀಲನೆ ಪೂರ್ಣಗೊಳಿಸಿ.', icon: 'BuildingStorefrontIcon', screen: 'verify' },
      { title: 'ಪರಿಶೀಲನೆ ಪೂರ್ಣಗೊಳಿಸಿ', action: 'ಅಗತ್ಯ ವ್ಯವಹಾರ ವಿವರಗಳು ಮತ್ತು GST ಮಾಹಿತಿ ಸಲ್ಲಿಸಿ.', detail: 'ಉತ್ಪನ್ನ ಪ್ರಕಟಿಸುವ ಮೊದಲು ಮಾರಾಟಗಾರ ಹರಿವಿನಲ್ಲಿ ನಿಮ್ಮ ಸಿದ್ಧತೆ ಮತ್ತು ಪರಿಶೀಲನೆ ಸ್ಥಿತಿ ಸ್ಪಷ್ಟವಾಗಿ ಕಾಣಬೇಕು.', icon: 'ShieldCheckIcon', screen: 'verify' },
      { title: 'ಕ್ಯಾಟಲಾಗ್ ನಿರ್ಮಿಸಿ', action: 'ನಿಖರವಾದ ಮಾರಾಟಗಾರ-ನೀಡಿದ ಮಾಹಿತಿಯೊಂದಿಗೆ ಉತ್ಪನ್ನ ಸೇರಿಸಿ.', detail: 'ಉತ್ಪನ್ನ ಮೀಡಿಯಾ, ವೇರಿಯಂಟ್, ಬಣ್ಣ-ಮಟ್ಟದ ಸ್ಟಾಕ್, ಬೆಲೆ, MOQ, ವಿಶೇಷಣ ಮತ್ತು ಡಿಸ್ಪ್ಯಾಚ್ ವಿವರಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.', icon: 'PlusCircleIcon', screen: 'catalogue' },
      { title: 'ಇನ್‌ವೆಂಟರಿ ನಿಯಂತ್ರಿಸಿ', action: 'ಲಭ್ಯತೆ ಮತ್ತು ವೇರಿಯಂಟ್‌ಗಳನ್ನು ಪ್ರಸ್ತುತವಾಗಿರಿಸಿ.', detail: 'ಒಂದೇ ಮಾರಾಟಗಾರ ವರ್ಕ್‌ಸ್ಪೇಸ್‌ನಿಂದ ಉತ್ಪನ್ನ ಸ್ಥಿತಿ, ಸ್ಟಾಕ್, ಬೆಲೆ ಮತ್ತು ಕ್ಯಾಟಲಾಗ್ ಅಪ್‌ಡೇಟ್‌ಗಳನ್ನು ನಿರ್ವಹಿಸಿ.', icon: 'ArchiveBoxIcon', screen: 'inventory' },
      { title: 'ಹೊಸ ಆರ್ಡರ್ ಪರಿಶೀಲಿಸಿ', action: 'ನೈಜ ಆರ್ಡರ್ ದಾಖಲೆಯಿಂದ ಲಭ್ಯ ಪ್ರಮಾಣವನ್ನು ಸ್ವೀಕರಿಸಿ, ತಿರಸ್ಕರಿಸಿ ಅಥವಾ ದೃಢಪಡಿಸಿ.', detail: 'ಅಗತ್ಯವಿದ್ದಲ್ಲಿ ಮಾರಾಟಗಾರರ ದೃಢೀಕರಣದ ನಂತರ ಆರ್ಡರ್ ಹರಿವಿನಂತೆ ಖರೀದಿದಾರರ ಪಾವತಿ ತೆರೆಯುತ್ತದೆ.', icon: 'ClipboardDocumentListIcon', screen: 'order' },
      { title: 'ಪಾವತಿಸಿದ ಆರ್ಡರ್ ಪೂರ್ಣಗೊಳಿಸಿ', action: 'ಡಿಸ್ಪ್ಯಾಚ್ ಮಾಡಿ, ಟ್ರ್ಯಾಕಿಂಗ್ ಸೇರಿಸಿ ಮತ್ತು ಆರ್ಡರ್ ಅಪ್‌ಡೇಟ್ ಮಾಡಿ.', detail: 'ಪಾವತಿಗಳು, ಇನ್‌ವಾಯ್ಸ್, ಶಿಪ್ಮೆಂಟ್ ಸ್ಥಿತಿ ಮತ್ತು ಫುಲ್ಫಿಲ್ಮೆಂಟ್ ಕ್ರಮಗಳು ಅದೇ ವ್ಯವಹಾರ ದಾಖಲೆಗೆ ಜೋಡಿತವಾಗಿರುತ್ತವೆ.', icon: 'TruckIcon', screen: 'fulfilment' },
    ],
  },
};

const ml: HowToUseCopy = {
  start: {
    publicBadge: 'പൊതുവായ മാർഗ്ഗനിർദ്ദേശങ്ങൾ · സൈൻ ഇൻ ആവശ്യമില്ല', eyebrow: 'FabricTrad എങ്ങനെ ഉപയോഗിക്കാം', title: 'FabricTrad എങ്ങനെ ഉപയോഗിക്കണമെന്നത് തിരഞ്ഞെടുക്കുക.', intro: 'ബന്ധപ്പെട്ട മാർഗ്ഗനിർദ്ദേശം കാണാൻ വാങ്ങുന്നവനോ വിൽപ്പനക്കാരനോ തിരഞ്ഞെടുക്കുക. ഏതൊരു ഗൈഡും കാണാൻ അക്കൗണ്ടോ ലോഗിനോ ആവശ്യമില്ല.',
    buyer: { eyebrow: 'വാങ്ങുന്നവർക്ക്', title: 'FabricTrad-ൽ എങ്ങനെ വാങ്ങാം', description: 'വാങ്ങൽ സെറ്റപ്പ്, തുണി കണ്ടെത്തൽ, ലിസ്റ്റിംഗ് പരിശോധിക്കൽ, ഓർഡർ, സുരക്ഷിത പേയ്മെന്റ്, ഫുൾഫിൽമെന്റ് ട്രാക്കിംഗ് എന്നിവ പഠിക്കുക.', bullets: ['ഉൽപ്പന്നങ്ങൾ കണ്ടെത്തി താരതമ്യം ചെയ്യുക', 'ഓർഡർ-പേയ്മെന്റ് പ്രവാഹം', 'ഷിപ്പ്മെന്റ് ട്രാക്കിംഗ്'], button: 'വാങ്ങുന്നവരുടെ ഗൈഡ് കാണുക' },
    seller: { eyebrow: 'വിൽപ്പനക്കാർക്ക്', title: 'FabricTrad-ൽ എങ്ങനെ വിൽക്കാം', description: 'വിൽപ്പനക്കാരനെ സജീവമാക്കൽ, ബിസിനസ് പരിശോധന, കാറ്റലോഗ്, ഇൻവെന്ററി, പുതിയ ഓർഡറുകൾ, ഫുൾഫിൽമെന്റ് എന്നിവ പഠിക്കുക.', bullets: ['ബിസിനസ്, GST പരിശോധന', 'ഉൽപ്പന്നങ്ങളും ഇൻവെന്ററിയും', 'ഓർഡറുകളും ഫുൾഫിൽമെന്റും'], button: 'വിൽപ്പനക്കാരുടെ ഗൈഡ് കാണുക' },
    noAccountData: 'അക്കൗണ്ട് ഡാറ്റ ലോഡ് ചെയ്യില്ല', safePreview: 'സുരക്ഷിത പൊതു പ്രിവ്യൂ', helpCentre: 'സഹായ കേന്ദ്രം തുറക്കുക',
  },
  guide: {
    eyebrow: 'FabricTrad എങ്ങനെ ഉപയോഗിക്കാം', title: 'ഇന്റർഫേസ് പ്രവർത്തിക്കുന്നത് കണ്ട് പഠിക്കുക.', intro: 'ഈ പൊതു വാക്ക്‌ത്രൂ സൈൻ ഇൻ ചെയ്യുന്നതിന് മുമ്പും പ്രവർത്തിക്കും. വാങ്ങുന്നവനോ വിൽപ്പനക്കാരനോ തിരഞ്ഞെടുക്കുക, തുടർന്ന് ഗൈഡഡ് ഫ്ലോ പ്ലേ ചെയ്യുക അല്ലെങ്കിൽ ഓരോ സ്ക്രീനും സ്വയം കാണുക. പ്രിവ്യൂയിൽ ഇന്റർഫേസ് പ്ലേസ്‌ഹോൾഡറുകൾ മാത്രമേ ഉള്ളൂ; വ്യാജ ഉൽപ്പന്നങ്ങൾ, റിവ്യൂകൾ, റേറ്റിംഗുകൾ അല്ലെങ്കിൽ ഇടപാടുകൾ കാണിക്കില്ല.', buyer: 'വാങ്ങുന്നവർ', seller: 'വിൽപ്പനക്കാരൻ', chooseWalkthrough: 'വാക്ക്‌ത്രൂ തിരഞ്ഞെടുക്കുക', walkthrough: 'വാക്ക്‌ത്രൂ', step: 'ഘട്ടം', of: 'ൽ', play: 'പ്ലേ', pause: 'താൽക്കാലികമായി നിർത്തുക', playWalkthrough: 'വാക്ക്‌ത്രൂ പ്ലേ ചെയ്യുക', pauseWalkthrough: 'വാക്ക്‌ത്രൂ നിർത്തുക', previous: 'മുൻപ്', nextStep: 'അടുത്ത ഘട്ടം', signIn: 'സൈൻ ഇൻ', createAccount: 'അക്കൗണ്ട് സൃഷ്ടിക്കുക', interactivePreview: 'ഇന്ററാക്ടീവ് പ്രിവ്യൂ', view: 'വ്യൂ',
    buyerSidebar: ['മാർക്കറ്റ്‌പ്ലേസ്', 'ഓർഡറുകൾ', 'ട്രാക്കിംഗ്'], sellerSidebar: ['ഡാഷ്ബോർഡ്', 'ഉൽപ്പന്നങ്ങൾ', 'ഓർഡറുകൾ'], liveInteractionPreview: 'ലൈവ് ഇന്ററാക്ഷൻ പ്രിവ്യൂ', noLiveData: 'ലൈവ് ഡാറ്റ ഇല്ല', buyOnFabricTrad: 'FabricTrad-ൽ വാങ്ങുക', sellOnFabricTrad: 'FabricTrad-ൽ വിൽക്കുക', roleAwareSetup: 'റോളിനെ അടിസ്ഥാനമാക്കിയ സെറ്റപ്പ് നിങ്ങൾക്ക് യഥാർത്ഥത്തിൽ വേണ്ട ടൂളുകളിൽ മാത്രം ശ്രദ്ധ കേന്ദ്രീകരിക്കാൻ സഹായിക്കുന്നു.', verificationShown: 'പരിശോധന സ്ഥിതി ഇവിടെ കാണിക്കും', searchPlaceholder: 'തുണി, നിറം, GSM, വിൽപ്പനക്കാരൻ അല്ലെങ്കിൽ SKU തിരയുക', filters: ['തുണിയുടെ തരം', 'GSM', 'വീതി', 'MOQ'], sellerProvidedMedia: 'വിൽപ്പനക്കാരൻ നൽകിയ മീഡിയ', productFacts: ['വേരിയന്റുകൾ', 'സ്റ്റോക്ക്', 'MOQ', 'ഡിസ്പാച്ച്'], drapeSupported: 'പിന്തുണയുണ്ടെങ്കിൽ Drape-On കാണിക്കും', addProduct: 'ഉൽപ്പന്നം ചേർക്കുക', updateStock: 'സ്റ്റോക്ക് അപ്ഡേറ്റ് ചെയ്യുക', tableHeaders: ['ഉൽപ്പന്നം', 'വേരിയന്റുകൾ', 'സ്റ്റോക്ക്', 'സ്ഥിതി'], yourProduct: 'നിങ്ങളുടെ ഉൽപ്പന്നം', current: 'നിലവിൽ', orderCreated: 'ഓർഡർ സൃഷ്ടിച്ചു', sellerDecision: 'വിൽപ്പനക്കാരന്റെ തീരുമാനം / സ്റ്റോക്ക് സ്ഥിരീകരണം', sellerConfirmation: 'വിൽപ്പനക്കാരന്റെ സ്ഥിരീകരണം', dispatchTracking: 'ഡിസ്പാച്ചും ട്രാക്കിംഗും', recordCarriesStatus: 'ഈ സ്ഥിതി യഥാർത്ഥ ഓർഡർ രേഖയിൽ തന്നെയുണ്ടാകും.', secureCheckout: 'സുരക്ഷിത ചെക്ക്ഔട്ട്', paymentTiedToOrder: 'പേയ്മെന്റ് FabricTrad ഓർഡറുമായി ബന്ധിപ്പിച്ചിരിക്കുന്നു.', continueToPayment: 'പേയ്മെന്റിലേക്ക് തുടരുക',
    buyerSteps: [
      { title: 'എങ്ങനെ വാങ്ങണമെന്ന് തിരഞ്ഞെടുക്കുക', action: 'ഒരു അക്കൗണ്ട് സൃഷ്ടിച്ച് നിങ്ങൾക്ക് അനുയോജ്യമായ വാങ്ങുന്നവരുടെ സെറ്റപ്പ് തിരഞ്ഞെടുക്കുക.', detail: 'വ്യക്തിഗത വാങ്ങുന്നവർക്ക് റീട്ടെയിൽ-സജ്ജമായ ലിസ്റ്റിംഗുകൾ വാങ്ങാം. ബിസിനസ് വാങ്ങുന്നവർക്ക് ട്രേഡ് വാങ്ങൽ സൗകര്യങ്ങൾക്കായി ബിസിനസ് പരിശോധന പൂർത്തിയാക്കാം.', icon: 'UserCircleIcon', screen: 'account' },
      { title: 'ശരിയായ തുണി കണ്ടെത്തുക', action: 'ലൈവ് മാർക്കറ്റ്‌പ്ലേസിൽ തിരയുകയും ഫിൽട്ടർ ചെയ്യുകയും ചെയ്യുക.', detail: 'കാറ്റലോഗ് ചുരുക്കാൻ വിഭാഗം, നിറം, GSM, വീതി, MOQ, വില, ഡിസ്പാച്ച്, വിൽപ്പനക്കാരന്റെ വിവരങ്ങൾ എന്നിവ ഉപയോഗിക്കുക.', icon: 'MagnifyingGlassIcon', screen: 'discover' },
      { title: 'ഓർഡറിന് മുമ്പ് പരിശോധിക്കുക', action: 'ഉൽപ്പന്നം തുറന്ന് വിൽപ്പനക്കാരൻ നൽകിയ ലിസ്റ്റിംഗ് വിവരങ്ങൾ പരിശോധിക്കുക.', detail: 'വേരിയന്റുകൾ, സ്റ്റോക്ക്, സ്പെസിഫിക്കേഷൻ, ഡിസ്പാച്ച് വിവരം, ലഭ്യമായ മീഡിയ എന്നിവ പരിശോധിക്കുക. പിന്തുണയുള്ളിടത്ത് Drape-On ഉപയോഗിക്കുക.', icon: 'SparklesIcon', screen: 'product' },
      { title: 'ഓർഡർ അഭ്യർത്ഥന നൽകുക', action: 'വേരിയന്റും അളവും തിരഞ്ഞെടുക്കി ഓർഡർ പ്രവാഹത്തിൽ തുടരുക.', detail: 'വിൽപ്പനക്കാരന്റെ അംഗീകാരം ആവശ്യമുള്ളിടത്ത് പേയ്മെന്റിന് മുമ്പ് വിൽപ്പനക്കാരൻ ലഭ്യത സ്ഥിരീകരിക്കും.', icon: 'ShoppingBagIcon', screen: 'order' },
      { title: 'സുരക്ഷിതമായി പണമടയ്ക്കുക', action: 'പേയ്മെന്റ് FabricTrad ചെക്ക്ഔട്ട് വഴി മാത്രം പൂർത്തിയാക്കുക.', detail: 'ഓർഡർ മുന്നോട്ട് പോകുന്നതിന് മുമ്പ് പേയ്മെന്റ് പ്രവാഹം ഓർഡർ രേഖയും സർവർ-സൈഡ് പരിശോധനയും ഉപയോഗിക്കുന്നു.', icon: 'CreditCardIcon', screen: 'payment' },
      { title: 'ഫുൾഫിൽമെന്റ് ട്രാക്ക് ചെയ്യുക', action: 'പണം ലഭിച്ച ഓർഡർ ഡിസ്പാച്ച് മുതൽ ഡെലിവറി വരെ പിന്തുടരുക.', detail: 'ഓർഡർ സ്ഥിതി, ഷിപ്പ്മെന്റ് വിവരം, രേഖകൾ, പിന്തുണ നടപടികൾ എന്നിവ അതേ ഓർഡറുമായി ബന്ധിപ്പിച്ചിരിക്കും.', icon: 'TruckIcon', screen: 'tracking' },
    ],
    sellerSteps: [
      { title: 'വിൽപ്പന സജീവമാക്കുക', action: 'അതേ FabricTrad അക്കൗണ്ടിൽ വിൽപ്പനക്കാരന്റെ സൗകര്യങ്ങൾ സജീവമാക്കുക.', detail: 'രണ്ടാമത്തെ ലോഗിൻ സൃഷ്ടിക്കുന്നതിന് പകരം വിൽപ്പനക്കാരന്റെ ബിസിനസ് പ്രൊഫൈലും ആവശ്യമായ പരിശോധനയും പൂർത്തിയാക്കുക.', icon: 'BuildingStorefrontIcon', screen: 'verify' },
      { title: 'പരിശോധന പൂർത്തിയാക്കുക', action: 'ആവശ്യമായ ബിസിനസ് വിവരങ്ങളും GST വിവരവും സമർപ്പിക്കുക.', detail: 'ഉൽപ്പന്നങ്ങൾ പ്രസിദ്ധീകരിക്കുന്നതിന് മുമ്പ് വിൽപ്പനക്കാരന്റെ പ്രവാഹത്തിൽ നിങ്ങളുടെ തയ്യാറെടുപ്പും പരിശോധന നിലയും വ്യക്തമായി കാണണം.', icon: 'ShieldCheckIcon', screen: 'verify' },
      { title: 'കാറ്റലോഗ് നിർമ്മിക്കുക', action: 'കൃത്യമായ വിൽപ്പനക്കാരൻ-നൽകിയ വിവരങ്ങളോടെ ഉൽപ്പന്നങ്ങൾ ചേർക്കുക.', detail: 'ഉൽപ്പന്ന മീഡിയ, വേരിയന്റുകൾ, നിറം-തല സ്റ്റോക്ക്, വില, MOQ, സ്പെസിഫിക്കേഷൻ, ഡിസ്പാച്ച് വിവരങ്ങൾ അപ്ലോഡ് ചെയ്യുക.', icon: 'PlusCircleIcon', screen: 'catalogue' },
      { title: 'ഇൻവെന്ററി നിയന്ത്രിക്കുക', action: 'ലഭ്യതയും വേരിയന്റുകളും പുതുക്കിയ നിലയിൽ സൂക്ഷിക്കുക.', detail: 'ഒരേ വിൽപ്പനക്കാരൻ വർക്ക്‌സ്‌പേസിൽ നിന്ന് ഉൽപ്പന്ന സ്ഥിതി, സ്റ്റോക്ക്, വില, കാറ്റലോഗ് അപ്ഡേറ്റുകൾ കൈകാര്യം ചെയ്യുക.', icon: 'ArchiveBoxIcon', screen: 'inventory' },
      { title: 'പുതിയ ഓർഡറുകൾ പരിശോധിക്കുക', action: 'യഥാർത്ഥ ഓർഡർ രേഖയിൽ നിന്ന് ലഭ്യമായ അളവ് സ്വീകരിക്കുക, നിരസിക്കുക അല്ലെങ്കിൽ സ്ഥിരീകരിക്കുക.', detail: 'ആവശ്യമായിടത്ത് വിൽപ്പനക്കാരന്റെ സ്ഥിരീകരണത്തിന് ശേഷം ഓർഡർ പ്രവാഹമനുസരിച്ച് വാങ്ങുന്നവരുടെ പേയ്മെന്റ് തുറക്കും.', icon: 'ClipboardDocumentListIcon', screen: 'order' },
      { title: 'പണം ലഭിച്ച ഓർഡറുകൾ പൂർത്തിയാക്കുക', action: 'ഡിസ്പാച്ച് ചെയ്യുക, ട്രാക്കിംഗ് ചേർക്കുക, ഓർഡർ പുതുക്കി സൂക്ഷിക്കുക.', detail: 'പേയ്മെന്റുകൾ, ഇൻവോയ്സുകൾ, ഷിപ്പ്മെന്റ് സ്ഥിതി, ഫുൾഫിൽമെന്റ് നടപടികൾ എന്നിവ അതേ ഇടപാട് രേഖയുമായി ബന്ധിപ്പിച്ചിരിക്കും.', icon: 'TruckIcon', screen: 'fulfilment' },
    ],
  },
};

const pa: HowToUseCopy = {
  start: {
    publicBadge: 'ਜਨਤਕ ਮਾਰਗਦਰਸ਼ਨ · ਸਾਈਨ ਇਨ ਦੀ ਲੋੜ ਨਹੀਂ', eyebrow: 'FabricTrad ਨੂੰ ਕਿਵੇਂ ਵਰਤਣਾ ਹੈ', title: 'ਚੁਣੋ ਕਿ ਤੁਸੀਂ FabricTrad ਨੂੰ ਕਿਵੇਂ ਵਰਤਣਾ ਚਾਹੁੰਦੇ ਹੋ।', intro: 'ਸੰਬੰਧਿਤ ਮਾਰਗਦਰਸ਼ਿਤ ਵਾਕਥਰੂ ਦੇਖਣ ਲਈ ਖਰੀਦਦਾਰ ਜਾਂ ਵਿਕਰੇਤਾ ਚੁਣੋ। ਕਿਸੇ ਵੀ ਗਾਈਡ ਨੂੰ ਦੇਖਣ ਲਈ ਖਾਤਾ ਜਾਂ ਲੌਗਇਨ ਦੀ ਲੋੜ ਨਹੀਂ ਹੈ।',
    buyer: { eyebrow: 'ਖਰੀਦਦਾਰਾਂ ਲਈ', title: 'FabricTrad ਉੱਤੇ ਕਿਵੇਂ ਖਰੀਦਣਾ ਹੈ', description: 'ਖਰੀਦ ਸੈਟਅਪ, ਕੱਪੜਾ ਖੋਜਣਾ, ਲਿਸਟਿੰਗ ਜਾਂਚਣਾ, ਆਰਡਰ ਦੇਣਾ, ਸੁਰੱਖਿਅਤ ਭੁਗਤਾਨ ਅਤੇ ਫੁਲਫਿਲਮੈਂਟ ਟ੍ਰੈਕਿੰਗ ਸਿੱਖੋ।', bullets: ['ਉਤਪਾਦ ਖੋਜੋ ਅਤੇ ਤੁਲਨਾ ਕਰੋ', 'ਆਰਡਰ ਅਤੇ ਭੁਗਤਾਨ ਪ੍ਰਕਿਰਿਆ', 'ਸ਼ਿਪਮੈਂਟ ਟ੍ਰੈਕਿੰਗ'], button: 'ਖਰੀਦਦਾਰ ਗਾਈਡ ਦੇਖੋ' },
    seller: { eyebrow: 'ਵਿਕਰੇਤਾਵਾਂ ਲਈ', title: 'FabricTrad ਉੱਤੇ ਕਿਵੇਂ ਵੇਚਣਾ ਹੈ', description: 'ਵਿਕਰੇਤਾ ਐਕਟੀਵੇਸ਼ਨ, ਕਾਰੋਬਾਰੀ ਤਸਦੀਕ, ਕੈਟਾਲਾਗ, ਇਨਵੈਂਟਰੀ, ਨਵੇਂ ਆਰਡਰ ਅਤੇ ਫੁਲਫਿਲਮੈਂਟ ਸਿੱਖੋ।', bullets: ['ਕਾਰੋਬਾਰ ਅਤੇ GST ਤਸਦੀਕ', 'ਉਤਪਾਦ ਅਤੇ ਇਨਵੈਂਟਰੀ', 'ਆਰਡਰ ਅਤੇ ਫੁਲਫਿਲਮੈਂਟ'], button: 'ਵਿਕਰੇਤਾ ਗਾਈਡ ਦੇਖੋ' },
    noAccountData: 'ਕੋਈ ਖਾਤਾ ਡਾਟਾ ਲੋਡ ਨਹੀਂ ਹੁੰਦਾ', safePreview: 'ਸੁਰੱਖਿਅਤ ਜਨਤਕ ਪ੍ਰੀਵਿਊ', helpCentre: 'ਸਹਾਇਤਾ ਕੇਂਦਰ ਖੋਲ੍ਹੋ',
  },
  guide: {
    eyebrow: 'FabricTrad ਨੂੰ ਕਿਵੇਂ ਵਰਤਣਾ ਹੈ', title: 'ਇੰਟਰਫੇਸ ਨੂੰ ਚਲਦਾ ਦੇਖ ਕੇ ਸਿੱਖੋ।', intro: 'ਇਹ ਜਨਤਕ ਵਾਕਥਰੂ ਸਾਈਨ ਇਨ ਤੋਂ ਪਹਿਲਾਂ ਵੀ ਚੱਲਦਾ ਹੈ। ਖਰੀਦਦਾਰ ਜਾਂ ਵਿਕਰੇਤਾ ਚੁਣੋ, ਫਿਰ ਮਾਰਗਦਰਸ਼ਿਤ ਪ੍ਰਵਾਹ ਚਲਾਓ ਜਾਂ ਹਰ ਸਕ੍ਰੀਨ ਖੁਦ ਵੇਖੋ। ਪ੍ਰੀਵਿਊ ਵਿੱਚ ਸਿਰਫ਼ ਇੰਟਰਫੇਸ ਪਲੇਸਹੋਲਡਰ ਹਨ; ਨਕਲੀ ਉਤਪਾਦ, ਰਿਵਿਊ, ਰੇਟਿੰਗ ਜਾਂ ਲੈਣ-ਦੇਣ ਨਹੀਂ ਦਿਖਾਏ ਜਾਂਦੇ।', buyer: 'ਖਰੀਦਦਾਰ', seller: 'ਵਿਕਰੇਤਾ', chooseWalkthrough: 'ਵਾਕਥਰੂ ਚੁਣੋ', walkthrough: 'ਵਾਕਥਰੂ', step: 'ਕਦਮ', of: 'ਵਿੱਚੋਂ', play: 'ਚਲਾਓ', pause: 'ਰੋਕੋ', playWalkthrough: 'ਵਾਕਥਰੂ ਚਲਾਓ', pauseWalkthrough: 'ਵਾਕਥਰੂ ਰੋਕੋ', previous: 'ਪਿਛਲਾ', nextStep: 'ਅਗਲਾ ਕਦਮ', signIn: 'ਸਾਈਨ ਇਨ', createAccount: 'ਖਾਤਾ ਬਣਾਓ', interactivePreview: 'ਇੰਟਰਐਕਟਿਵ ਪ੍ਰੀਵਿਊ', view: 'ਦ੍ਰਿਸ਼',
    buyerSidebar: ['ਮਾਰਕੀਟਪਲੇਸ', 'ਆਰਡਰ', 'ਟ੍ਰੈਕਿੰਗ'], sellerSidebar: ['ਡੈਸ਼ਬੋਰਡ', 'ਉਤਪਾਦ', 'ਆਰਡਰ'], liveInteractionPreview: 'ਲਾਈਵ ਇੰਟਰਐਕਸ਼ਨ ਪ੍ਰੀਵਿਊ', noLiveData: 'ਕੋਈ ਲਾਈਵ ਡਾਟਾ ਨਹੀਂ', buyOnFabricTrad: 'FabricTrad ਉੱਤੇ ਖਰੀਦੋ', sellOnFabricTrad: 'FabricTrad ਉੱਤੇ ਵੇਚੋ', roleAwareSetup: 'ਭੂਮਿਕਾ-ਅਧਾਰਿਤ ਸੈਟਅਪ ਤੁਹਾਡਾ ਧਿਆਨ ਸਿਰਫ਼ ਉਹਨਾਂ ਟੂਲਾਂ ਉੱਤੇ ਰੱਖਦਾ ਹੈ ਜਿਨ੍ਹਾਂ ਦੀ ਅਸਲ ਲੋੜ ਹੈ।', verificationShown: 'ਤਸਦੀਕ ਦੀ ਸਥਿਤੀ ਇੱਥੇ ਦਿਖਾਈ ਜਾਂਦੀ ਹੈ', searchPlaceholder: 'ਕੱਪੜਾ, ਰੰਗ, GSM, ਵਿਕਰੇਤਾ ਜਾਂ SKU ਖੋਜੋ', filters: ['ਕੱਪੜੇ ਦੀ ਕਿਸਮ', 'GSM', 'ਚੌੜਾਈ', 'MOQ'], sellerProvidedMedia: 'ਵਿਕਰੇਤਾ ਵੱਲੋਂ ਦਿੱਤਾ ਮੀਡੀਆ', productFacts: ['ਵੈਰੀਐਂਟ', 'ਸਟਾਕ', 'MOQ', 'ਡਿਸਪੈਚ'], drapeSupported: 'ਸਹਾਇਤਾ ਹੋਣ ਤੇ Drape-On ਦਿਖਾਈ ਦਿੰਦਾ ਹੈ', addProduct: 'ਉਤਪਾਦ ਜੋੜੋ', updateStock: 'ਸਟਾਕ ਅਪਡੇਟ ਕਰੋ', tableHeaders: ['ਉਤਪਾਦ', 'ਵੈਰੀਐਂਟ', 'ਸਟਾਕ', 'ਸਥਿਤੀ'], yourProduct: 'ਤੁਹਾਡਾ ਉਤਪਾਦ', current: 'ਮੌਜੂਦਾ', orderCreated: 'ਆਰਡਰ ਬਣਾਇਆ ਗਿਆ', sellerDecision: 'ਵਿਕਰੇਤਾ ਫੈਸਲਾ / ਸਟਾਕ ਪੁਸ਼ਟੀ', sellerConfirmation: 'ਵਿਕਰੇਤਾ ਪੁਸ਼ਟੀ', dispatchTracking: 'ਡਿਸਪੈਚ ਅਤੇ ਟ੍ਰੈਕਿੰਗ', recordCarriesStatus: 'ਇਹ ਸਥਿਤੀ ਅਸਲੀ ਆਰਡਰ ਰਿਕਾਰਡ ਵਿੱਚ ਰਹਿੰਦੀ ਹੈ।', secureCheckout: 'ਸੁਰੱਖਿਅਤ ਚੈਕਆਉਟ', paymentTiedToOrder: 'ਭੁਗਤਾਨ FabricTrad ਆਰਡਰ ਨਾਲ ਜੁੜਿਆ ਰਹਿੰਦਾ ਹੈ।', continueToPayment: 'ਭੁਗਤਾਨ ਲਈ ਅੱਗੇ ਵਧੋ',
    buyerSteps: [
      { title: 'ਖਰੀਦਣ ਦਾ ਤਰੀਕਾ ਚੁਣੋ', action: 'ਇੱਕ ਖਾਤਾ ਬਣਾਓ ਅਤੇ ਆਪਣੇ ਲਈ ਸਹੀ ਖਰੀਦਦਾਰ ਸੈਟਅਪ ਚੁਣੋ।', detail: 'ਵਿਅਕਤੀਗਤ ਖਰੀਦਦਾਰ ਰਿਟੇਲ-ਸਮਰਥਿਤ ਲਿਸਟਿੰਗ ਖਰੀਦ ਸਕਦੇ ਹਨ। ਕਾਰੋਬਾਰੀ ਖਰੀਦਦਾਰ ਟ੍ਰੇਡ ਖਰੀਦ ਸੁਵਿਧਾਵਾਂ ਲਈ ਕਾਰੋਬਾਰੀ ਤਸਦੀਕ ਪੂਰੀ ਕਰ ਸਕਦੇ ਹਨ।', icon: 'UserCircleIcon', screen: 'account' },
      { title: 'ਸਹੀ ਕੱਪੜਾ ਲੱਭੋ', action: 'ਲਾਈਵ ਮਾਰਕੀਟਪਲੇਸ ਵਿੱਚ ਖੋਜੋ ਅਤੇ ਫਿਲਟਰ ਕਰੋ।', detail: 'ਕੈਟਾਲਾਗ ਘਟਾਉਣ ਲਈ ਸ਼੍ਰੇਣੀ, ਰੰਗ, GSM, ਚੌੜਾਈ, MOQ, ਕੀਮਤ, ਡਿਸਪੈਚ ਅਤੇ ਵਿਕਰੇਤਾ ਜਾਣਕਾਰੀ ਵਰਤੋ।', icon: 'MagnifyingGlassIcon', screen: 'discover' },
      { title: 'ਆਰਡਰ ਤੋਂ ਪਹਿਲਾਂ ਜਾਂਚੋ', action: 'ਉਤਪਾਦ ਖੋਲ੍ਹੋ ਅਤੇ ਵਿਕਰੇਤਾ ਵੱਲੋਂ ਦਿੱਤੀ ਲਿਸਟਿੰਗ ਜਾਣਕਾਰੀ ਵੇਖੋ।', detail: 'ਵੈਰੀਐਂਟ, ਸਟਾਕ, ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ, ਡਿਸਪੈਚ ਜਾਣਕਾਰੀ ਅਤੇ ਮੀਡੀਆ ਜਾਂਚੋ। ਜਿੱਥੇ ਸਹਾਇਤਾ ਹੋਵੇ Drape-On ਵਰਤੋ।', icon: 'SparklesIcon', screen: 'product' },
      { title: 'ਆਰਡਰ ਬੇਨਤੀ ਦਿਓ', action: 'ਵੈਰੀਐਂਟ ਅਤੇ ਮਾਤਰਾ ਚੁਣ ਕੇ ਆਰਡਰ ਪ੍ਰਕਿਰਿਆ ਵਿੱਚ ਅੱਗੇ ਵਧੋ।', detail: 'ਜਿੱਥੇ ਵਿਕਰੇਤਾ ਦੀ ਮਨਜ਼ੂਰੀ ਲੋੜੀਂਦੀ ਹੈ ਉੱਥੇ ਭੁਗਤਾਨ ਤੋਂ ਪਹਿਲਾਂ ਵਿਕਰੇਤਾ ਉਪਲਬਧਤਾ ਦੀ ਪੁਸ਼ਟੀ ਕਰਦਾ ਹੈ।', icon: 'ShoppingBagIcon', screen: 'order' },
      { title: 'ਸੁਰੱਖਿਅਤ ਭੁਗਤਾਨ ਕਰੋ', action: 'ਭੁਗਤਾਨ ਸਿਰਫ਼ FabricTrad ਚੈਕਆਉਟ ਰਾਹੀਂ ਪੂਰਾ ਕਰੋ।', detail: 'ਆਰਡਰ ਅੱਗੇ ਵਧਣ ਤੋਂ ਪਹਿਲਾਂ ਭੁਗਤਾਨ ਪ੍ਰਕਿਰਿਆ ਆਰਡਰ ਰਿਕਾਰਡ ਅਤੇ ਸਰਵਰ-ਸਾਈਡ ਤਸਦੀਕ ਵਰਤਦੀ ਹੈ।', icon: 'CreditCardIcon', screen: 'payment' },
      { title: 'ਫੁਲਫਿਲਮੈਂਟ ਟ੍ਰੈਕ ਕਰੋ', action: 'ਭੁਗਤਾਨ ਕੀਤੇ ਆਰਡਰ ਨੂੰ ਡਿਸਪੈਚ ਤੋਂ ਡਿਲਿਵਰੀ ਤੱਕ ਟ੍ਰੈਕ ਕਰੋ।', detail: 'ਆਰਡਰ ਸਥਿਤੀ, ਸ਼ਿਪਮੈਂਟ ਜਾਣਕਾਰੀ, ਦਸਤਾਵੇਜ਼ ਅਤੇ ਸਹਾਇਤਾ ਕਾਰਵਾਈਆਂ ਉਸੇ ਆਰਡਰ ਨਾਲ ਜੁੜੀਆਂ ਰਹਿੰਦੀਆਂ ਹਨ।', icon: 'TruckIcon', screen: 'tracking' },
    ],
    sellerSteps: [
      { title: 'ਵਿਕਰੀ ਸਰਗਰਮ ਕਰੋ', action: 'ਉਸੇ FabricTrad ਖਾਤੇ ਤੋਂ ਵਿਕਰੇਤਾ ਸਮਰੱਥਾਵਾਂ ਚਾਲੂ ਕਰੋ।', detail: 'ਦੂਜਾ ਲੌਗਇਨ ਬਣਾਉਣ ਦੀ ਬਜਾਏ ਵਿਕਰੇਤਾ ਕਾਰੋਬਾਰੀ ਪ੍ਰੋਫਾਈਲ ਅਤੇ ਲੋੜੀਂਦੀ ਤਸਦੀਕ ਪੂਰੀ ਕਰੋ।', icon: 'BuildingStorefrontIcon', screen: 'verify' },
      { title: 'ਤਸਦੀਕ ਪੂਰੀ ਕਰੋ', action: 'ਲੋੜੀਂਦੇ ਕਾਰੋਬਾਰੀ ਵੇਰਵੇ ਅਤੇ GST ਜਾਣਕਾਰੀ ਜਮ੍ਹਾਂ ਕਰੋ।', detail: 'ਉਤਪਾਦ ਪ੍ਰਕਾਸ਼ਿਤ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਵਿਕਰੇਤਾ ਪ੍ਰਵਾਹ ਵਿੱਚ ਤੁਹਾਡੀ ਤਿਆਰੀ ਅਤੇ ਤਸਦੀਕ ਸਥਿਤੀ ਸਾਫ਼ ਦਿਖਣੀ ਚਾਹੀਦੀ ਹੈ।', icon: 'ShieldCheckIcon', screen: 'verify' },
      { title: 'ਕੈਟਾਲਾਗ ਬਣਾਓ', action: 'ਸਹੀ ਵਿਕਰੇਤਾ-ਦਿੱਤੀ ਜਾਣਕਾਰੀ ਨਾਲ ਉਤਪਾਦ ਜੋੜੋ।', detail: 'ਉਤਪਾਦ ਮੀਡੀਆ, ਵੈਰੀਐਂਟ, ਰੰਗ-ਪੱਧਰ ਸਟਾਕ, ਕੀਮਤ, MOQ, ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ ਅਤੇ ਡਿਸਪੈਚ ਵੇਰਵੇ ਅਪਲੋਡ ਕਰੋ।', icon: 'PlusCircleIcon', screen: 'catalogue' },
      { title: 'ਇਨਵੈਂਟਰੀ ਕੰਟਰੋਲ ਕਰੋ', action: 'ਉਪਲਬਧਤਾ ਅਤੇ ਵੈਰੀਐਂਟ ਅਪਡੇਟ ਰੱਖੋ।', detail: 'ਇੱਕੋ ਵਿਕਰੇਤਾ ਵਰਕਸਪੇਸ ਤੋਂ ਉਤਪਾਦ ਸਥਿਤੀ, ਸਟਾਕ, ਕੀਮਤ ਅਤੇ ਕੈਟਾਲਾਗ ਅਪਡੇਟ ਸੰਭਾਲੋ।', icon: 'ArchiveBoxIcon', screen: 'inventory' },
      { title: 'ਨਵੇਂ ਆਰਡਰ ਵੇਖੋ', action: 'ਅਸਲੀ ਆਰਡਰ ਰਿਕਾਰਡ ਤੋਂ ਉਪਲਬਧ ਮਾਤਰਾ ਸਵੀਕਾਰੋ, ਰੱਦ ਕਰੋ ਜਾਂ ਪੁਸ਼ਟੀ ਕਰੋ।', detail: 'ਲੋੜ ਹੋਣ ਤੇ ਵਿਕਰੇਤਾ-ਪੱਖ ਪੁਸ਼ਟੀ ਤੋਂ ਬਾਅਦ ਆਰਡਰ ਪ੍ਰਵਾਹ ਅਨੁਸਾਰ ਖਰੀਦਦਾਰ ਦਾ ਭੁਗਤਾਨ ਖੁੱਲ੍ਹਦਾ ਹੈ।', icon: 'ClipboardDocumentListIcon', screen: 'order' },
      { title: 'ਭੁਗਤਾਨ ਕੀਤੇ ਆਰਡਰ ਪੂਰੇ ਕਰੋ', action: 'ਡਿਸਪੈਚ ਕਰੋ, ਟ੍ਰੈਕਿੰਗ ਜੋੜੋ ਅਤੇ ਆਰਡਰ ਅਪਡੇਟ ਰੱਖੋ।', detail: 'ਭੁਗਤਾਨ, ਇਨਵੌਇਸ, ਸ਼ਿਪਮੈਂਟ ਸਥਿਤੀ ਅਤੇ ਫੁਲਫਿਲਮੈਂਟ ਕਾਰਵਾਈਆਂ ਉਸੇ ਲੈਣ-ਦੇਣ ਰਿਕਾਰਡ ਨਾਲ ਜੁੜੀਆਂ ਰਹਿੰਦੀਆਂ ਹਨ।', icon: 'TruckIcon', screen: 'fulfilment' },
    ],
  },
};

const ta: HowToUseCopy = {
  start: {
    publicBadge: 'பொது வழிகாட்டிகள் · உள்நுழைவு தேவையில்லை', eyebrow: 'FabricTrad-ஐ எப்படி பயன்படுத்துவது', title: 'FabricTrad-ஐ எப்படி பயன்படுத்த விரும்புகிறீர்கள் என்பதைத் தேர்ந்தெடுக்கவும்.', intro: 'சரியான வழிகாட்டப்பட்ட நடைமுறையைப் பார்க்க வாங்குபவர் அல்லது விற்பனையாளர் என்பதைத் தேர்ந்தெடுக்கவும். எந்த வழிகாட்டியையும் பார்க்க கணக்கு அல்லது உள்நுழைவு தேவையில்லை.',
    buyer: { eyebrow: 'வாங்குபவர்களுக்கு', title: 'FabricTrad-ல் எப்படி வாங்குவது', description: 'வாங்கும் அமைப்பு, துணி தேடுதல், பட்டியல் சரிபார்த்தல், ஆர்டர், பாதுகாப்பான கட்டணம் மற்றும் நிறைவேற்ற கண்காணிப்பை அறிக.', bullets: ['உற்பத்திகளைத் தேடி ஒப்பிடுங்கள்', 'ஆர்டர் மற்றும் கட்டண நடைமுறை', 'ஷிப்மென்ட் கண்காணிப்பு'], button: 'வாங்குபவர் வழிகாட்டியைப் பாருங்கள்' },
    seller: { eyebrow: 'விற்பனையாளர்களுக்கு', title: 'FabricTrad-ல் எப்படி விற்பது', description: 'விற்பனையாளர் செயல்படுத்தல், வணிக சரிபார்ப்பு, பட்டியல், இருப்பு, புதிய ஆர்டர்கள் மற்றும் நிறைவேற்றத்தை அறிக.', bullets: ['வணிகம் மற்றும் GST சரிபார்ப்பு', 'உற்பத்திகள் மற்றும் இருப்பு', 'ஆர்டர்கள் மற்றும் நிறைவேற்றம்'], button: 'விற்பனையாளர் வழிகாட்டியைப் பாருங்கள்' },
    noAccountData: 'கணக்கு தரவு ஏற்றப்படாது', safePreview: 'பாதுகாப்பான பொது முன்னோட்டம்', helpCentre: 'உதவி மையத்தைத் திறக்கவும்',
  },
  guide: {
    eyebrow: 'FabricTrad-ஐ எப்படி பயன்படுத்துவது', title: 'இடைமுகம் இயங்குவதைப் பார்த்து கற்றுக்கொள்ளுங்கள்.', intro: 'இந்த பொது வாக்க்த்ரூ உள்நுழைவதற்கு முன்பே இயங்கும். வாங்குபவர் அல்லது விற்பனையாளர் என்பதைத் தேர்ந்தெடுத்து வழிகாட்டப்பட்ட ஓட்டத்தை இயக்கலாம் அல்லது ஒவ்வொரு திரையையும் நீங்களே பார்க்கலாம். முன்னோட்டத்தில் இடைமுக பிளேஸ்ஹோல்டர்கள் மட்டுமே உள்ளன; போலி உற்பத்திகள், விமர்சனங்கள், மதிப்பீடுகள் அல்லது பரிவர்த்தனைகள் காட்டப்படாது.', buyer: 'வாங்குபவர்', seller: 'விற்பனையாளர்', chooseWalkthrough: 'வாக்க்த்ரூ தேர்ந்தெடுக்கவும்', walkthrough: 'வாக்க்த்ரூ', step: 'படி', of: 'இல்', play: 'இயக்கு', pause: 'இடைநிறுத்து', playWalkthrough: 'வாக்க்த்ரூவை இயக்கவும்', pauseWalkthrough: 'வாக்க்த்ரூவை இடைநிறுத்தவும்', previous: 'முந்தையது', nextStep: 'அடுத்த படி', signIn: 'உள்நுழைய', createAccount: 'கணக்கு உருவாக்கவும்', interactivePreview: 'ஊடாடும் முன்னோட்டம்', view: 'காட்சி',
    buyerSidebar: ['மார்க்கெட்பிளேஸ்', 'ஆர்டர்கள்', 'கண்காணிப்பு'], sellerSidebar: ['டாஷ்போர்டு', 'உற்பத்திகள்', 'ஆர்டர்கள்'], liveInteractionPreview: 'நேரடி ஊடாடும் முன்னோட்டம்', noLiveData: 'நேரடி தரவு இல்லை', buyOnFabricTrad: 'FabricTrad-ல் வாங்குங்கள்', sellOnFabricTrad: 'FabricTrad-ல் விற்குங்கள்', roleAwareSetup: 'பாத்திர அடிப்படையிலான அமைப்பு உங்களுக்கு உண்மையில் தேவையான கருவிகளில் மட்டும் கவனம் செலுத்துகிறது.', verificationShown: 'சரிபார்ப்பு நிலை இங்கே காட்டப்படும்', searchPlaceholder: 'துணி, நிறம், GSM, விற்பனையாளர் அல்லது SKU தேடுங்கள்', filters: ['துணி வகை', 'GSM', 'அகலம்', 'MOQ'], sellerProvidedMedia: 'விற்பனையாளர் வழங்கிய மீடியா', productFacts: ['வகைகள்', 'இருப்பு', 'MOQ', 'அனுப்புதல்'], drapeSupported: 'ஆதரவு இருந்தால் Drape-On தோன்றும்', addProduct: 'உற்பத்தியைச் சேர்க்கவும்', updateStock: 'இருப்பை புதுப்பிக்கவும்', tableHeaders: ['உற்பத்தி', 'வகைகள்', 'இருப்பு', 'நிலை'], yourProduct: 'உங்கள் உற்பத்தி', current: 'தற்போதைய', orderCreated: 'ஆர்டர் உருவாக்கப்பட்டது', sellerDecision: 'விற்பனையாளர் முடிவு / இருப்பு உறுதிப்படுத்தல்', sellerConfirmation: 'விற்பனையாளர் உறுதிப்படுத்தல்', dispatchTracking: 'அனுப்புதல் மற்றும் கண்காணிப்பு', recordCarriesStatus: 'இந்த நிலை உண்மையான ஆர்டர் பதிவிலேயே இருக்கும்.', secureCheckout: 'பாதுகாப்பான செக்அவுட்', paymentTiedToOrder: 'கட்டணம் FabricTrad ஆர்டருடன் இணைக்கப்பட்டுள்ளது.', continueToPayment: 'கட்டணத்துக்கு தொடரவும்',
    buyerSteps: [
      { title: 'வாங்கும் முறையைத் தேர்ந்தெடுக்கவும்', action: 'ஒரு கணக்கை உருவாக்கி உங்களுக்கு ஏற்ற வாங்குபவர் அமைப்பைத் தேர்ந்தெடுக்கவும்.', detail: 'தனிநபர் வாங்குபவர்கள் ரீட்டெயில்-இயக்கப்பட்ட பட்டியல்களில் வாங்கலாம். வணிக வாங்குபவர்கள் ட்ரேட் வாங்கும் வசதிகளுக்காக வணிக சரிபார்ப்பை முடிக்கலாம்.', icon: 'UserCircleIcon', screen: 'account' },
      { title: 'சரியான துணியை கண்டுபிடிக்கவும்', action: 'நேரடி மார்க்கெட்பிளேஸில் தேடி வடிகட்டவும்.', detail: 'பட்டியலைக் குறைக்க வகை, நிறம், GSM, அகலம், MOQ, விலை, அனுப்புதல் மற்றும் விற்பனையாளர் தகவலைப் பயன்படுத்தவும்.', icon: 'MagnifyingGlassIcon', screen: 'discover' },
      { title: 'ஆர்டர் முன் சரிபார்க்கவும்', action: 'உற்பத்தியைத் திறந்து விற்பனையாளர் வழங்கிய பட்டியல் விவரங்களைப் பார்க்கவும்.', detail: 'வகைகள், இருப்பு, விவரக்குறிப்புகள், அனுப்புதல் தகவல் மற்றும் கிடைக்கும் மீடியாவைச் சரிபார்க்கவும். ஆதரவு உள்ள இடத்தில் Drape-On பயன்படுத்தவும்.', icon: 'SparklesIcon', screen: 'product' },
      { title: 'ஆர்டர் கோரிக்கை செய்யவும்', action: 'வகை மற்றும் அளவைத் தேர்ந்தெடுத்து ஆர்டர் நடைமுறையில் தொடரவும்.', detail: 'விற்பனையாளர் ஒப்புதல் தேவைப்படும் இடங்களில் கட்டணத்திற்கு முன் கிடைப்பதை விற்பனையாளர் உறுதிப்படுத்துகிறார்.', icon: 'ShoppingBagIcon', screen: 'order' },
      { title: 'பாதுகாப்பாக கட்டணம் செலுத்தவும்', action: 'கட்டணத்தை FabricTrad செக்அவுட் வழியாக மட்டுமே முடிக்கவும்.', detail: 'ஆர்டர் முன்னேறும் முன் கட்டண நடைமுறை ஆர்டர் பதிவையும் சர்வர்-சைட் சரிபார்ப்பையும் பயன்படுத்துகிறது.', icon: 'CreditCardIcon', screen: 'payment' },
      { title: 'நிறைவேற்றத்தை கண்காணிக்கவும்', action: 'பணம் செலுத்தப்பட்ட ஆர்டரை அனுப்புதல் முதல் டெலிவரி வரை கண்காணிக்கவும்.', detail: 'ஆர்டர் நிலை, ஷிப்மென்ட் தகவல், ஆவணங்கள் மற்றும் உதவி நடவடிக்கைகள் அதே ஆர்டருடன் இணைந்திருக்கும்.', icon: 'TruckIcon', screen: 'tracking' },
    ],
    sellerSteps: [
      { title: 'விற்பனையை செயல்படுத்தவும்', action: 'அதே FabricTrad கணக்கில் விற்பனையாளர் வசதிகளை செயல்படுத்தவும்.', detail: 'இரண்டாவது உள்நுழைவை உருவாக்காமல் விற்பனையாளர் வணிக சுயவிவரத்தையும் தேவையான சரிபார்ப்பையும் முடிக்கவும்.', icon: 'BuildingStorefrontIcon', screen: 'verify' },
      { title: 'சரிபார்ப்பை முடிக்கவும்', action: 'தேவையான வணிக விவரங்கள் மற்றும் GST தகவலை சமர்ப்பிக்கவும்.', detail: 'உற்பத்திகளை வெளியிடுவதற்கு முன் விற்பனையாளர் நடைமுறையில் உங்கள் தயார்நிலை மற்றும் சரிபார்ப்பு நிலை தெளிவாகத் தெரிய வேண்டும்.', icon: 'ShieldCheckIcon', screen: 'verify' },
      { title: 'உங்கள் பட்டியலை உருவாக்கவும்', action: 'துல்லியமான விற்பனையாளர்-வழங்கிய தகவலுடன் உற்பத்திகளைச் சேர்க்கவும்.', detail: 'உற்பத்தி மீடியா, வகைகள், நிறம்-அடிப்படையிலான இருப்பு, விலை, MOQ, விவரக்குறிப்புகள் மற்றும் அனுப்புதல் விவரங்களை பதிவேற்றவும்.', icon: 'PlusCircleIcon', screen: 'catalogue' },
      { title: 'இருப்பை கட்டுப்படுத்தவும்', action: 'கிடைப்பையும் வகைகளையும் புதுப்பித்த நிலையில் வைத்திருக்கவும்.', detail: 'ஒரே விற்பனையாளர் பணிப்பகுதியில் இருந்து உற்பத்தி நிலை, இருப்பு, விலை மற்றும் பட்டியல் புதுப்பிப்புகளை நிர்வகிக்கவும்.', icon: 'ArchiveBoxIcon', screen: 'inventory' },
      { title: 'புதிய ஆர்டர்களை மதிப்பாய்வு செய்யவும்', action: 'உண்மையான ஆர்டர் பதிவிலிருந்து கிடைக்கும் அளவை ஏற்கவும், நிராகரிக்கவும் அல்லது உறுதிப்படுத்தவும்.', detail: 'தேவைப்படும் இடத்தில் விற்பனையாளர் உறுதிப்படுத்திய பிறகு ஆர்டர் நடைமுறைக்கு ஏற்ப வாங்குபவர் கட்டணம் திறக்கும்.', icon: 'ClipboardDocumentListIcon', screen: 'order' },
      { title: 'பணம் செலுத்தப்பட்ட ஆர்டர்களை நிறைவேற்றவும்', action: 'அனுப்பவும், கண்காணிப்பை இணைக்கவும், ஆர்டரை புதுப்பித்த நிலையில் வைத்திருக்கவும்.', detail: 'கட்டணங்கள், இன்வாய்ஸ்கள், ஷிப்மென்ட் நிலை மற்றும் நிறைவேற்ற நடவடிக்கைகள் அதே பரிவர்த்தனை பதிவுடன் இணைந்திருக்கும்.', icon: 'TruckIcon', screen: 'fulfilment' },
    ],
  },
};

const te: HowToUseCopy = {
  start: {
    publicBadge: 'పబ్లిక్ మార్గదర్శకాలు · సైన్ ఇన్ అవసరం లేదు', eyebrow: 'FabricTradను ఎలా ఉపయోగించాలి', title: 'మీరు FabricTradను ఎలా ఉపయోగించాలనుకుంటున్నారో ఎంచుకోండి.', intro: 'సంబంధిత మార్గదర్శిత వాక్‌థ్రూ చూడటానికి కొనుగోలుదారు లేదా విక్రేతను ఎంచుకోండి. ఏ గైడ్ చూడటానికీ ఖాతా లేదా లాగిన్ అవసరం లేదు.',
    buyer: { eyebrow: 'కొనుగోలుదారుల కోసం', title: 'FabricTradలో ఎలా కొనాలి', description: 'కొనుగోలు సెటప్, వస్త్రాలు వెతకడం, లిస్టింగ్ పరిశీలించడం, ఆర్డర్, సురక్షిత చెల్లింపు మరియు ఫుల్ఫిల్మెಂಟ್ ట్ర్యాకింగ్ నేర్చుకోండి.', bullets: ['ఉత్పత్తులను వెతికి పోల్చండి', 'ఆర్డర్ మరియు చెల్లింపు ప్రక్రియ', 'షిప్మెంట్ ట్ర్యాకింగ్'], button: 'కొనుగోలుదారు గైడ్ చూడండి' },
    seller: { eyebrow: 'విక్రేతల కోసం', title: 'FabricTradలో ఎలా అమ్మాలి', description: 'విక్రేత యాక్టివేషన్, వ్యాపార ధృవీకరణ, క్యాటలాగ్, ఇన్వెంటరీ, కొత్త ఆర్డర్లు మరియు ఫుల్ఫిల్మెంట్ నేర్చుకోండి.', bullets: ['వ్యాపారం మరియు GST ధృవీకరణ', 'ఉత్పత్తులు మరియు ఇన్వెంటరీ', 'ఆర్డర్లు మరియు ఫుల్ఫిల్మెంట్'], button: 'విక్రేత గైడ్ చూడండి' },
    noAccountData: 'ఖాతా డేటా లోడ్ చేయబడదు', safePreview: 'సురక్షిత పబ్లిక్ ప్రివ్యూ', helpCentre: 'సహాయ కేంద్రం తెరవండి',
  },
  guide: {
    eyebrow: 'FabricTradను ఎలా ఉపయోగించాలి', title: 'ఇంటర్‌ఫేస్ కదలికను చూసి నేర్చుకోండి.', intro: 'ఈ పబ్లిక్ వాక్‌థ్రూ సైన్ ఇన్ చేయకముందే పని చేస్తుంది. కొనుగోలుదారు లేదా విక్రేతను ఎంచుకుని మార్గదర్శిత ప్రవాహాన్ని ప్లే చేయండి లేదా ప్రతి స్క్రీన్‌ను మీరే చూడండి. ప్రివ్యూలో ఇంటర్‌ఫేస్ ప్లేస్‌హోల్డర్లు మాత్రమే ఉంటాయి; నకిలీ ఉత్పత్తులు, రివ్యూలు, రేటింగ్‌లు లేదా లావాదేవీలు చూపబడవు.', buyer: 'కొనుగోలుదారు', seller: 'విక్రేత', chooseWalkthrough: 'వాక్‌థ్రూ ఎంచుకోండి', walkthrough: 'వాక్‌థ్రూ', step: 'దశ', of: 'లో', play: 'ప్లే', pause: 'పాజ్', playWalkthrough: 'వాక్‌థ్రూ ప్లే చేయండి', pauseWalkthrough: 'వాక్‌థ్రూ పాజ్ చేయండి', previous: 'మునుపటి', nextStep: 'తదుపరి దశ', signIn: 'సైన్ ఇన్', createAccount: 'ఖాతా సృష్టించండి', interactivePreview: 'ఇంటరాక్టివ్ ప్రివ్యూ', view: 'వీక్షణ',
    buyerSidebar: ['మార్కెట్‌ప్లేస్', 'ఆర్డర్లు', 'ట్ర్యాకింగ్'], sellerSidebar: ['డ్యాష్‌బోర్డ్', 'ఉత్పత్తులు', 'ఆర్డర్లు'], liveInteractionPreview: 'లైవ్ ఇంటరాక్షన్ ప్రివ్యూ', noLiveData: 'లైవ్ డేటా లేదు', buyOnFabricTrad: 'FabricTradలో కొనండి', sellOnFabricTrad: 'FabricTradలో అమ్మండి', roleAwareSetup: 'పాత్ర-ఆధారిత సెటప్ మీకు నిజంగా అవసరమైన టూల్స్‌పైనే దృష్టి పెట్టేలా చేస్తుంది.', verificationShown: 'ధృవీకరణ స్థితి ఇక్కడ కనిపిస్తుంది', searchPlaceholder: 'వస్త్రాలు, రంగులు, GSM, విక్రేతలు లేదా SKU వెతకండి', filters: ['వస్త్ర రకం', 'GSM', 'వెడల్పు', 'MOQ'], sellerProvidedMedia: 'విక్రేత అందించిన మీడియా', productFacts: ['వేరియంట్లు', 'స్టాక్', 'MOQ', 'డిస్పాచ్'], drapeSupported: 'మద్దతు ఉన్నప్పుడు Drape-On కనిపిస్తుంది', addProduct: 'ఉత్పత్తి జోడించండి', updateStock: 'స్టాక్ అప్డేట్ చేయండి', tableHeaders: ['ఉత్పత్తి', 'వేరియంట్లు', 'స్టాక్', 'స్థితి'], yourProduct: 'మీ ఉత్పత్తి', current: 'ప్రస్తుత', orderCreated: 'ఆర్డర్ సృష్టించబడింది', sellerDecision: 'విక్రేత నిర్ణయం / స్టాక్ నిర్ధారణ', sellerConfirmation: 'విక్రేత నిర్ధారణ', dispatchTracking: 'డిస్పాచ్ మరియు ట్ర్యాకింగ్', recordCarriesStatus: 'ఈ స్థితి నిజమైన ఆర్డర్ రికార్డులోనే ఉంటుంది.', secureCheckout: 'సురక్షిత చెక్‌ఔట్', paymentTiedToOrder: 'చెల్లింపు FabricTrad ఆర్డర్‌కు అనుసంధానంగా ఉంటుంది.', continueToPayment: 'చెల్లింపుకు కొనసాగండి',
    buyerSteps: [
      { title: 'కొనుగోలు విధానం ఎంచుకోండి', action: 'ఒక ఖాతా సృష్టించి మీకు సరైన కొనుగోలుదారు సెటప్ ఎంచుకోండి.', detail: 'వ్యక్తిగత కొనుగోలుదారులు రిటైల్-సక్రియ లిస్టింగ్‌లను కొనవచ్చు. వ్యాపార కొనుగోలుదారులు ట్రేడ్ కొనుగోలు సదుపాయాల కోసం వ్యాపార ధృవీకరణ పూర్తి చేయవచ్చు.', icon: 'UserCircleIcon', screen: 'account' },
      { title: 'సరైన వస్త్రాన్ని కనుగొనండి', action: 'లైవ్ మార్కెట్‌ప్లేస్‌లో వెతికి ఫిల్టర్ చేయండి.', detail: 'క్యాటలాగ్‌ను తగ్గించడానికి వర్గం, రంగు, GSM, వెడల్పు, MOQ, ధర, డిస్పాచ్ మరియు విక్రేత సమాచారాన్ని ఉపయోగించండి.', icon: 'MagnifyingGlassIcon', screen: 'discover' },
      { title: 'ఆర్డర్ ముందు పరిశీలించండి', action: 'ఉత్పత్తిని తెరిచి విక్రేత అందించిన లిస్టింగ్ వివరాలు చూడండి.', detail: 'వేరియంట్లు, స్టాక్, స్పెసిఫికేషన్లు, డిస్పాచ్ సమాచారం మరియు అందుబాటులో ఉన్న మీడియా పరిశీలించండి. మద్దతు ఉన్న చోట Drape-On ఉపయోగించండి.', icon: 'SparklesIcon', screen: 'product' },
      { title: 'ఆర్డర్ అభ్యర్థన చేయండి', action: 'వేరియంట్ మరియు పరిమాణాన్ని ఎంచుకుని ఆర్డర్ ప్రక్రియలో కొనసాగండి.', detail: 'విక్రేత ఆమోదం అవసరమైన చోట చెల్లింపుకు ముందు విక్రేత అందుబాటును నిర్ధారిస్తారు.', icon: 'ShoppingBagIcon', screen: 'order' },
      { title: 'సురక్షితంగా చెల్లించండి', action: 'చెల్లింపును FabricTrad చెక్‌ఔట్ ద్వారా మాత్రమే పూర్తి చేయండి.', detail: 'ఆర్డర్ ముందుకు సాగేముందు చెల్లింపు ప్రక్రియ ఆర్డర్ రికార్డు మరియు సర్వర్-సైడ్ ధృవీకరణను ఉపయోగిస్తుంది.', icon: 'CreditCardIcon', screen: 'payment' },
      { title: 'ఫుల్ఫిల్మెంట్ ట్ర్యాక్ చేయండి', action: 'చెల్లించిన ఆర్డర్‌ను డిస్పాచ్ నుంచి డెలివరీ వరకు అనుసరించండి.', detail: 'ఆర్డర్ స్థితి, షిప్మెంట్ సమాచారం, పత్రాలు మరియు సహాయ చర్యలు అదే ఆర్డర్‌కు అనుసంధానంగా ఉంటాయి.', icon: 'TruckIcon', screen: 'tracking' },
    ],
    sellerSteps: [
      { title: 'అమ్మకాన్ని సక్రియం చేయండి', action: 'అదే FabricTrad ఖాతా నుంచి విక్రేత సదుపాయాలు సక్రియం చేయండి.', detail: 'రెండో లాగిన్ సృష్టించకుండా విక్రేత వ్యాపార ప్రొఫైల్ మరియు అవసరమైన ధృవీకరణ పూర్తి చేయండి.', icon: 'BuildingStorefrontIcon', screen: 'verify' },
      { title: 'ధృవీకరణ పూర్తి చేయండి', action: 'అవసరమైన వ్యాపార వివరాలు మరియు GST సమాచారం సమర్పించండి.', detail: 'ఉత్పత్తులు ప్రచురించే ముందు విక్రేత ప్రవాహంలో మీ సిద్ధత మరియు ధృవీకరణ స్థితి స్పష్టంగా కనిపించాలి.', icon: 'ShieldCheckIcon', screen: 'verify' },
      { title: 'క్యాటలాగ్ నిర్మించండి', action: 'ఖచ్చితమైన విక్రేత-అందించిన సమాచారంతో ఉత్పత్తులు జోడించండి.', detail: 'ఉత్పత్తి మీడియా, వేరియంట్లు, రంగు-స్థాయి స్టాక్, ధర, MOQ, స్పెసిఫికేషన్లు మరియు డిస్పాచ్ వివరాలు అప్లోడ్ చేయండి.', icon: 'PlusCircleIcon', screen: 'catalogue' },
      { title: 'ఇన్వెంటరీ నియంత్రించండి', action: 'అందుబాటు మరియు వేరియంట్లను తాజాగానే ఉంచండి.', detail: 'ఒకే విక్రేత వర్క్‌స్పేస్ నుంచి ఉత్పత్తి స్థితి, స్టాక్, ధర మరియు క్యాటలాగ్ అప్డేట్లు నిర్వహించండి.', icon: 'ArchiveBoxIcon', screen: 'inventory' },
      { title: 'కొత్త ఆర్డర్లు సమీక్షించండి', action: 'నిజమైన ఆర్డర్ రికార్డు నుంచి అందుబాటులో ఉన్న పరిమాణాన్ని అంగీకరించండి, తిరస్కరించండి లేదా నిర్ధారించండి.', detail: 'అవసరమైన చోట విక్రేత-వైపు నిర్ధారణ తర్వాత ఆర్డర్ ప్రవాహం ప్రకారం కొనుగోలుదారు చెల్లింపు తెరుచుకుంటుంది.', icon: 'ClipboardDocumentListIcon', screen: 'order' },
      { title: 'చెల్లించిన ఆర్డర్లు పూర్తి చేయండి', action: 'డిస్పాచ్ చేసి, ట్ర్యాకింగ్ జోడించి, ఆర్డర్‌ను అప్డేట్‌గా ఉంచండి.', detail: 'చెల్లింపులు, ఇన్వాయిస్‌లు, షిప్మెంట్ స్థితి మరియు ఫుల్ఫిల్మెಂಟ್ చర్యలు అదే లావాదేవీ రికార్డుకు అనుసంధానంగా ఉంటాయి.', icon: 'TruckIcon', screen: 'fulfilment' },
    ],
  },
};

const dictionaries: Record<SupportedLanguageCode, HowToUseCopy> = { en, hi, bn, gu, kn, ml, mr, pa, ta, te };

export function getHowToUseCopy(language: SupportedLanguageCode): HowToUseCopy {
  return dictionaries[language] || en;
}
