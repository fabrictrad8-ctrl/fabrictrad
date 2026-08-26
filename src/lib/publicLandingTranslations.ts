import type { SupportedLanguageCode } from '@/lib/india';

type CapabilityCopy = { title: string; copy: string };
type TrustCopy = { title: string; copy: string };

export type PublicLandingCopy = {
  navPlatform: string;
  navCapabilities: string;
  navHowToUse: string;
  navTrust: string;
  buyerWalkthrough: string;
  buyerWalkthroughCopy: string;
  sellerWalkthrough: string;
  sellerWalkthroughCopy: string;
  signIn: string;
  joinFabricTrad: string;
  kicker: string;
  titleLead: string;
  titleAccent: string;
  heroCopy: string;
  enterFabricTrad: string;
  watchHowItWorks: string;
  verifiedSellerAccess: string;
  protectedPaymentFlow: string;
  deviceSupport: string;
  buyerMarketplace: string;
  buyerMarketplaceCopy: string;
  sellerOperations: string;
  sellerOperationsCopy: string;
  aiVirtualDrape: string;
  aiVirtualDrapeCopy: string;
  workspacesKicker: string;
  workspacesTitle: string;
  workspacesCopy: string;
  buyer: string;
  marketplaceFirst: string;
  buyerWorkspaceCopy: string;
  seller: string;
  operationsFirst: string;
  sellerWorkspaceCopy: string;
  admin: string;
  controlFirst: string;
  adminWorkspaceCopy: string;
  lifecycleKicker: string;
  lifecycleTitle: string;
  lifecycleCopy: string;
  lifecycleStepOne: string;
  lifecycleStepTwo: string;
  lifecycleStepThree: string;
  capabilities: [CapabilityCopy, CapabilityCopy, CapabilityCopy];
  privateGuidanceTitle: string;
  privateGuidanceCopy: string;
  trustKicker: string;
  trustTitle: string;
  trustCopy: string;
  trustItems: [TrustCopy, TrustCopy, TrustCopy];
  footerHowToUse: string;
  footerHelp: string;
  footerPrivacy: string;
  footerTerms: string;
};

const en: PublicLandingCopy = {
  navPlatform: 'Platform', navCapabilities: 'Capabilities', navHowToUse: 'How to use', navTrust: 'Trust & safety',
  buyerWalkthrough: 'Buyer walkthrough', buyerWalkthroughCopy: 'Interactive buying flow', sellerWalkthrough: 'Seller walkthrough', sellerWalkthroughCopy: 'Interactive selling flow',
  signIn: 'Sign in', joinFabricTrad: 'Join FabricTrad', kicker: "India's textile commerce operating layer", titleLead: 'Textile trade,', titleAccent: 'rebuilt for now.',
  heroCopy: 'FabricTrad connects verified textile buyers and sellers around the same real commerce records. Search and source faster, manage catalogue and inventory, collect protected payments, generate documents and move paid orders into fulfilment without duplicate accounts or disconnected tools.',
  enterFabricTrad: 'Enter FabricTrad', watchHowItWorks: 'Watch how it works', verifiedSellerAccess: 'Verified seller access', protectedPaymentFlow: 'Protected payment flow', deviceSupport: 'Phone, tablet and desktop',
  buyerMarketplace: 'Buyer marketplace', buyerMarketplaceCopy: 'Search, compare, request, pay and track.', sellerOperations: 'Seller operations', sellerOperationsCopy: 'Products, orders, money and fulfilment.', aiVirtualDrape: 'AI Virtual Drape', aiVirtualDrapeCopy: 'Preview the seller textile on your photo or an AI model.',
  workspacesKicker: 'One platform, two focused workspaces', workspacesTitle: 'Simple at the surface. Serious underneath.', workspacesCopy: 'Buyers should feel like they are shopping, not operating an ERP. Sellers should feel like they are running a modern store, not navigating a buyer website.',
  buyer: 'Buyer', marketplaceFirst: 'Marketplace-first', buyerWorkspaceCopy: 'Discovery, orders, payment and tracking.', seller: 'Seller', operationsFirst: 'Operations-first', sellerWorkspaceCopy: 'Catalogue, fulfilment, earnings and analytics.', admin: 'Admin', controlFirst: 'Control-first', adminWorkspaceCopy: 'Verification, risk, transactions and operations.',
  lifecycleKicker: 'A connected order lifecycle', lifecycleTitle: 'From product discovery to paid fulfilment without losing context.', lifecycleCopy: 'Every important step remains attached to the real order: seller acceptance, Razorpay capture, invoice generation, shipment creation, tracking and support.', lifecycleStepOne: 'Discover a live product or post a sourcing requirement.', lifecycleStepTwo: 'Seller confirms the order and stock before payment opens.', lifecycleStepThree: 'Verified payment unlocks invoicing, earnings and fulfilment.',
  capabilities: [
    { title: 'Search-first buying', copy: 'Compare verified sellers, stock, MOQ, price, variants and dispatch details from one marketplace.' },
    { title: 'Merchant command centre', copy: 'Run products, inventory, orders, payments, invoices, shipping and analytics without leaving FabricTrad.' },
    { title: 'AI textile workflows', copy: 'Use AI-assisted catalogue tools and the seller-textile Virtual Drape experience where they add real value.' },
  ],
  privateGuidanceTitle: 'Private commerce, public guidance', privateGuidanceCopy: 'Live marketplace records and account data stay behind sign-in, while the Buyer and Seller interactive walkthroughs remain public so anyone can learn FabricTrad first.',
  trustKicker: 'Built for trust at scale', trustTitle: 'Clear commerce beats visual noise.', trustCopy: 'FabricTrad prioritises readable contrast, obvious next actions, role-specific navigation and responsive layouts while keeping advanced functionality available when it is useful.',
  trustItems: [
    { title: 'Verified network', copy: 'Seller verification and role-aware account access.' },
    { title: 'Protected payments', copy: 'Seller acceptance followed by server-verified Razorpay payment.' },
    { title: 'Connected fulfilment', copy: 'Paid-order shipping and tracking stay attached to the same order.' },
  ],
  footerHowToUse: 'How to use', footerHelp: 'Help', footerPrivacy: 'Privacy', footerTerms: 'Terms',
};

const hi: PublicLandingCopy = {
  navPlatform: 'प्लेटफ़ॉर्म', navCapabilities: 'क्षमताएँ', navHowToUse: 'कैसे उपयोग करें', navTrust: 'विश्वास और सुरक्षा',
  buyerWalkthrough: 'खरीदार मार्गदर्शिका', buyerWalkthroughCopy: 'इंटरैक्टिव खरीद प्रक्रिया', sellerWalkthrough: 'विक्रेता मार्गदर्शिका', sellerWalkthroughCopy: 'इंटरैक्टिव बिक्री प्रक्रिया',
  signIn: 'साइन इन', joinFabricTrad: 'FabricTrad से जुड़ें', kicker: 'भारत के टेक्सटाइल कॉमर्स की संचालन परत', titleLead: 'टेक्सटाइल व्यापार,', titleAccent: 'आज के लिए नए रूप में।',
  heroCopy: 'FabricTrad सत्यापित टेक्सटाइल खरीदारों और विक्रेताओं को एक ही वास्तविक व्यापार रिकॉर्ड से जोड़ता है। तेज़ी से खोजें और सोर्स करें, कैटलॉग व इन्वेंटरी संभालें, सुरक्षित भुगतान लें, दस्तावेज़ बनाएँ और भुगतान किए गए ऑर्डर को बिना दोहरे खातों या अलग-अलग टूल के फ़ुलफ़िलमेंट तक पहुँचाएँ।',
  enterFabricTrad: 'FabricTrad में प्रवेश करें', watchHowItWorks: 'देखें यह कैसे काम करता है', verifiedSellerAccess: 'सत्यापित विक्रेता पहुँच', protectedPaymentFlow: 'सुरक्षित भुगतान प्रक्रिया', deviceSupport: 'फ़ोन, टैबलेट और डेस्कटॉप',
  buyerMarketplace: 'खरीदार मार्केटप्लेस', buyerMarketplaceCopy: 'खोजें, तुलना करें, अनुरोध करें, भुगतान करें और ट्रैक करें।', sellerOperations: 'विक्रेता संचालन', sellerOperationsCopy: 'उत्पाद, ऑर्डर, भुगतान और फ़ुलफ़िलमेंट।', aiVirtualDrape: 'AI वर्चुअल ड्रेप', aiVirtualDrapeCopy: 'विक्रेता के टेक्सटाइल को अपनी फोटो या AI मॉडल पर देखें।',
  workspacesKicker: 'एक प्लेटफ़ॉर्म, दो केंद्रित कार्यक्षेत्र', workspacesTitle: 'ऊपर से सरल। भीतर से सक्षम।', workspacesCopy: 'खरीदारों को खरीदारी का सहज अनुभव मिलना चाहिए, ERP चलाने जैसा नहीं। विक्रेताओं को आधुनिक स्टोर चलाने जैसा अनुभव मिलना चाहिए, खरीदार वेबसाइट चलाने जैसा नहीं।',
  buyer: 'खरीदार', marketplaceFirst: 'मार्केटप्लेस-केंद्रित', buyerWorkspaceCopy: 'खोज, ऑर्डर, भुगतान और ट्रैकिंग।', seller: 'विक्रेता', operationsFirst: 'संचालन-केंद्रित', sellerWorkspaceCopy: 'कैटलॉग, फ़ुलफ़िलमेंट, कमाई और एनालिटिक्स।', admin: 'एडमिन', controlFirst: 'नियंत्रण-केंद्रित', adminWorkspaceCopy: 'सत्यापन, जोखिम, लेनदेन और संचालन।',
  lifecycleKicker: 'एक जुड़ा हुआ ऑर्डर जीवनचक्र', lifecycleTitle: 'उत्पाद खोज से भुगतान किए गए फ़ुलफ़िलमेंट तक, संदर्भ खोए बिना।', lifecycleCopy: 'हर महत्वपूर्ण चरण वास्तविक ऑर्डर से जुड़ा रहता है: विक्रेता स्वीकृति, Razorpay कैप्चर, इनवॉइस, शिपमेंट, ट्रैकिंग और सहायता।', lifecycleStepOne: 'लाइव उत्पाद खोजें या सोर्सिंग आवश्यकता पोस्ट करें।', lifecycleStepTwo: 'भुगतान खुलने से पहले विक्रेता ऑर्डर और स्टॉक की पुष्टि करता है।', lifecycleStepThree: 'सत्यापित भुगतान के बाद इनवॉइस, कमाई और फ़ुलफ़िलमेंट सक्रिय होते हैं।',
  capabilities: [
    { title: 'खोज-केंद्रित खरीदारी', copy: 'एक ही मार्केटप्लेस में सत्यापित विक्रेता, स्टॉक, MOQ, कीमत, वैरिएंट और डिस्पैच विवरण की तुलना करें।' },
    { title: 'मर्चेंट कमांड सेंटर', copy: 'FabricTrad छोड़े बिना उत्पाद, इन्वेंटरी, ऑर्डर, भुगतान, इनवॉइस, शिपिंग और एनालिटिक्स संभालें।' },
    { title: 'AI टेक्सटाइल वर्कफ़्लो', copy: 'जहाँ उपयोगी हो वहाँ AI-सहायित कैटलॉग टूल और विक्रेता टेक्सटाइल का Virtual Drape अनुभव इस्तेमाल करें।' },
  ],
  privateGuidanceTitle: 'निजी व्यापार, सार्वजनिक मार्गदर्शन', privateGuidanceCopy: 'लाइव मार्केटप्लेस रिकॉर्ड और खाता डेटा साइन-इन के पीछे सुरक्षित रहते हैं, जबकि खरीदार और विक्रेता की इंटरैक्टिव मार्गदर्शिकाएँ सार्वजनिक रहती हैं ताकि कोई भी पहले FabricTrad को समझ सके।',
  trustKicker: 'बड़े स्तर के भरोसे के लिए बनाया गया', trustTitle: 'स्पष्ट कॉमर्स, दृश्य शोर से बेहतर है।', trustCopy: 'FabricTrad स्पष्ट कंट्रास्ट, साफ़ अगले कदम, भूमिका-आधारित नेविगेशन और उत्तरदायी लेआउट को प्राथमिकता देता है, साथ ही ज़रूरत पर उन्नत सुविधाएँ उपलब्ध रखता है।',
  trustItems: [
    { title: 'सत्यापित नेटवर्क', copy: 'विक्रेता सत्यापन और भूमिका-आधारित खाता पहुँच।' },
    { title: 'सुरक्षित भुगतान', copy: 'विक्रेता स्वीकृति के बाद सर्वर द्वारा सत्यापित Razorpay भुगतान।' },
    { title: 'जुड़ा हुआ फ़ुलफ़िलमेंट', copy: 'भुगतान किए गए ऑर्डर की शिपिंग और ट्रैकिंग उसी ऑर्डर से जुड़ी रहती है।' },
  ],
  footerHowToUse: 'कैसे उपयोग करें', footerHelp: 'सहायता', footerPrivacy: 'गोपनीयता', footerTerms: 'शर्तें',
};

const bn: PublicLandingCopy = {
  navPlatform: 'প্ল্যাটফর্ম', navCapabilities: 'সুবিধাসমূহ', navHowToUse: 'কীভাবে ব্যবহার করবেন', navTrust: 'বিশ্বাস ও নিরাপত্তা',
  buyerWalkthrough: 'ক্রেতা নির্দেশিকা', buyerWalkthroughCopy: 'ইন্টার‌্যাক্টিভ কেনাকাটার ধাপ', sellerWalkthrough: 'বিক্রেতা নির্দেশিকা', sellerWalkthroughCopy: 'ইন্টার‌্যাক্টিভ বিক্রির ধাপ',
  signIn: 'সাইন ইন', joinFabricTrad: 'FabricTrad-এ যোগ দিন', kicker: 'ভারতের টেক্সটাইল কমার্স পরিচালনার প্ল্যাটফর্ম', titleLead: 'টেক্সটাইল বাণিজ্য,', titleAccent: 'আজকের জন্য নতুনভাবে গড়া।',
  heroCopy: 'FabricTrad যাচাইকৃত টেক্সটাইল ক্রেতা ও বিক্রেতাকে একই বাস্তব বাণিজ্য রেকর্ডে যুক্ত করে। দ্রুত খুঁজুন ও সোর্স করুন, ক্যাটালগ ও ইনভেন্টরি পরিচালনা করুন, সুরক্ষিত পেমেন্ট নিন, নথি তৈরি করুন এবং আলাদা অ্যাকাউন্ট বা বিচ্ছিন্ন টুল ছাড়াই পরিশোধিত অর্ডার ফুলফিলমেন্টে নিন।',
  enterFabricTrad: 'FabricTrad-এ প্রবেশ করুন', watchHowItWorks: 'কীভাবে কাজ করে দেখুন', verifiedSellerAccess: 'যাচাইকৃত বিক্রেতা অ্যাক্সেস', protectedPaymentFlow: 'সুরক্ষিত পেমেন্ট প্রবাহ', deviceSupport: 'ফোন, ট্যাবলেট ও ডেস্কটপ',
  buyerMarketplace: 'ক্রেতা মার্কেটপ্লেস', buyerMarketplaceCopy: 'খুঁজুন, তুলনা করুন, অনুরোধ করুন, পেমেন্ট করুন ও ট্র্যাক করুন।', sellerOperations: 'বিক্রেতা পরিচালনা', sellerOperationsCopy: 'পণ্য, অর্ডার, অর্থ ও ফুলফিলমেন্ট।', aiVirtualDrape: 'AI ভার্চুয়াল ড্রেপ', aiVirtualDrapeCopy: 'বিক্রেতার টেক্সটাইল নিজের ছবি বা AI মডেলে প্রিভিউ করুন।',
  workspacesKicker: 'এক প্ল্যাটফর্ম, দুইটি কেন্দ্রীভূত ওয়ার্কস্পেস', workspacesTitle: 'বাইরে সহজ। ভিতরে শক্তিশালী।', workspacesCopy: 'ক্রেতার অভিজ্ঞতা কেনাকাটার মতো সহজ হওয়া উচিত, ERP চালানোর মতো নয়। বিক্রেতার অভিজ্ঞতা আধুনিক দোকান চালানোর মতো হওয়া উচিত, ক্রেতা ওয়েবসাইট ব্যবহারের মতো নয়।',
  buyer: 'ক্রেতা', marketplaceFirst: 'মার্কেটপ্লেস-কেন্দ্রিক', buyerWorkspaceCopy: 'অনুসন্ধান, অর্ডার, পেমেন্ট ও ট্র্যাকিং।', seller: 'বিক্রেতা', operationsFirst: 'অপারেশন-কেন্দ্রিক', sellerWorkspaceCopy: 'ক্যাটালগ, ফুলফিলমেন্ট, আয় ও অ্যানালিটিক্স।', admin: 'অ্যাডমিন', controlFirst: 'নিয়ন্ত্রণ-কেন্দ্রিক', adminWorkspaceCopy: 'যাচাই, ঝুঁকি, লেনদেন ও পরিচালনা।',
  lifecycleKicker: 'সংযুক্ত অর্ডার জীবনচক্র', lifecycleTitle: 'পণ্য খোঁজা থেকে পরিশোধিত ফুলফিলমেন্ট পর্যন্ত—প্রাসঙ্গিক তথ্য হারানো ছাড়া।', lifecycleCopy: 'প্রতিটি গুরুত্বপূর্ণ ধাপ আসল অর্ডারের সঙ্গে যুক্ত থাকে: বিক্রেতার অনুমোদন, Razorpay ক্যাপচার, ইনভয়েস, শিপমেন্ট, ট্র্যাকিং ও সহায়তা।', lifecycleStepOne: 'লাইভ পণ্য খুঁজুন অথবা সোর্সিং প্রয়োজন পোস্ট করুন।', lifecycleStepTwo: 'পেমেন্ট খোলার আগে বিক্রেতা অর্ডার ও স্টক নিশ্চিত করেন।', lifecycleStepThree: 'যাচাইকৃত পেমেন্টের পর ইনভয়েস, আয় ও ফুলফিলমেন্ট সক্রিয় হয়।',
  capabilities: [
    { title: 'সার্চ-ফার্স্ট কেনাকাটা', copy: 'এক মার্কেটপ্লেসে যাচাইকৃত বিক্রেতা, স্টক, MOQ, দাম, ভ্যারিয়েন্ট ও ডিসপ্যাচ তথ্য তুলনা করুন।' },
    { title: 'মার্চেন্ট কমান্ড সেন্টার', copy: 'FabricTrad ছাড়াই পণ্য, ইনভেন্টরি, অর্ডার, পেমেন্ট, ইনভয়েস, শিপিং ও অ্যানালিটিক্স পরিচালনা করুন।' },
    { title: 'AI টেক্সটাইল ওয়ার্কফ্লো', copy: 'যেখানে উপযোগী, AI-সহায়িত ক্যাটালগ টুল ও বিক্রেতার টেক্সটাইলের Virtual Drape ব্যবহার করুন।' },
  ],
  privateGuidanceTitle: 'ব্যক্তিগত বাণিজ্য, সবার জন্য নির্দেশিকা', privateGuidanceCopy: 'লাইভ মার্কেটপ্লেস রেকর্ড ও অ্যাকাউন্ট ডেটা সাইন-ইনের পেছনে সুরক্ষিত থাকে; ক্রেতা ও বিক্রেতার ইন্টার‌্যাক্টিভ নির্দেশিকা সবার জন্য উন্মুক্ত থাকে।',
  trustKicker: 'বড় পরিসরে বিশ্বাসের জন্য তৈরি', trustTitle: 'পরিষ্কার কমার্স দৃশ্যগত ভিড়ের চেয়ে ভালো।', trustCopy: 'FabricTrad স্পষ্ট কনট্রাস্ট, পরিষ্কার পরবর্তী পদক্ষেপ, ভূমিকা-ভিত্তিক নেভিগেশন ও রেসপনসিভ লেআউটকে অগ্রাধিকার দেয় এবং প্রয়োজন হলে উন্নত সুবিধা রাখে।',
  trustItems: [
    { title: 'যাচাইকৃত নেটওয়ার্ক', copy: 'বিক্রেতা যাচাই ও ভূমিকা-ভিত্তিক অ্যাকাউন্ট অ্যাক্সেস।' },
    { title: 'সুরক্ষিত পেমেন্ট', copy: 'বিক্রেতার অনুমোদনের পরে সার্ভার-যাচাইকৃত Razorpay পেমেন্ট।' },
    { title: 'সংযুক্ত ফুলফিলমেন্ট', copy: 'পরিশোধিত অর্ডারের শিপিং ও ট্র্যাকিং একই অর্ডারের সঙ্গে যুক্ত থাকে।' },
  ],
  footerHowToUse: 'কীভাবে ব্যবহার করবেন', footerHelp: 'সহায়তা', footerPrivacy: 'গোপনীয়তা', footerTerms: 'শর্তাবলি',
};

const mr: PublicLandingCopy = {
  navPlatform: 'प्लॅटफॉर्म', navCapabilities: 'क्षमता', navHowToUse: 'कसे वापरायचे', navTrust: 'विश्वास आणि सुरक्षा',
  buyerWalkthrough: 'खरेदीदार मार्गदर्शिका', buyerWalkthroughCopy: 'इंटरॅक्टिव्ह खरेदी प्रक्रिया', sellerWalkthrough: 'विक्रेता मार्गदर्शिका', sellerWalkthroughCopy: 'इंटरॅक्टिव्ह विक्री प्रक्रिया',
  signIn: 'साइन इन', joinFabricTrad: 'FabricTrad मध्ये सामील व्हा', kicker: 'भारताच्या टेक्सटाइल कॉमर्सची ऑपरेटिंग लेयर', titleLead: 'टेक्सटाइल व्यापार,', titleAccent: 'आजसाठी नव्याने उभारलेला.',
  heroCopy: 'FabricTrad सत्यापित टेक्सटाइल खरेदीदार आणि विक्रेत्यांना एकाच वास्तविक व्यापार नोंदींवर जोडते. जलद शोधा व सोर्स करा, कॅटलॉग आणि इन्व्हेंटरी सांभाळा, सुरक्षित पेमेंट घ्या, कागदपत्रे तयार करा आणि वेगवेगळी खाती किंवा तुटक साधने न वापरता भरलेले ऑर्डर फुलफिलमेंटपर्यंत न्या.',
  enterFabricTrad: 'FabricTrad मध्ये प्रवेश करा', watchHowItWorks: 'हे कसे काम करते ते पाहा', verifiedSellerAccess: 'सत्यापित विक्रेता प्रवेश', protectedPaymentFlow: 'सुरक्षित पेमेंट प्रक्रिया', deviceSupport: 'फोन, टॅबलेट आणि डेस्कटॉप',
  buyerMarketplace: 'खरेदीदार मार्केटप्लेस', buyerMarketplaceCopy: 'शोधा, तुलना करा, विनंती करा, पेमेंट करा आणि ट्रॅक करा.', sellerOperations: 'विक्रेता ऑपरेशन्स', sellerOperationsCopy: 'उत्पादने, ऑर्डर, पैसे आणि फुलफिलमेंट.', aiVirtualDrape: 'AI व्हर्च्युअल ड्रेप', aiVirtualDrapeCopy: 'विक्रेत्याचे टेक्सटाइल तुमच्या फोटोवर किंवा AI मॉडेलवर पाहा.',
  workspacesKicker: 'एक प्लॅटफॉर्म, दोन केंद्रित वर्कस्पेस', workspacesTitle: 'वरून सोपे. आतून सक्षम.', workspacesCopy: 'खरेदीदारांना ERP चालवत असल्यासारखे नव्हे, तर सहज खरेदी करत असल्यासारखे वाटले पाहिजे. विक्रेत्यांना खरेदीदार वेबसाइट वापरत असल्यासारखे नव्हे, तर आधुनिक दुकान चालवत असल्यासारखे वाटले पाहिजे.',
  buyer: 'खरेदीदार', marketplaceFirst: 'मार्केटप्लेस-केंद्रित', buyerWorkspaceCopy: 'शोध, ऑर्डर, पेमेंट आणि ट्रॅकिंग.', seller: 'विक्रेता', operationsFirst: 'ऑपरेशन्स-केंद्रित', sellerWorkspaceCopy: 'कॅटलॉग, फुलफिलमेंट, कमाई आणि अॅनालिटिक्स.', admin: 'अॅडमिन', controlFirst: 'नियंत्रण-केंद्रित', adminWorkspaceCopy: 'सत्यापन, जोखीम, व्यवहार आणि ऑपरेशन्स.',
  lifecycleKicker: 'जोडलेले ऑर्डर जीवनचक्र', lifecycleTitle: 'उत्पादन शोधापासून भरलेल्या फुलफिलमेंटपर्यंत—संदर्भ न गमावता.', lifecycleCopy: 'प्रत्येक महत्त्वाचा टप्पा मूळ ऑर्डरशी जोडलेला राहतो: विक्रेता स्वीकृती, Razorpay कॅप्चर, इनव्हॉइस, शिपमेंट, ट्रॅकिंग आणि सहाय्य.', lifecycleStepOne: 'लाइव्ह उत्पादन शोधा किंवा सोर्सिंगची गरज पोस्ट करा.', lifecycleStepTwo: 'पेमेंट सुरू होण्यापूर्वी विक्रेता ऑर्डर आणि स्टॉकची पुष्टी करतो.', lifecycleStepThree: 'सत्यापित पेमेंटनंतर इनव्हॉइस, कमाई आणि फुलफिलमेंट सुरू होते.',
  capabilities: [
    { title: 'शोध-केंद्रित खरेदी', copy: 'एका मार्केटप्लेसमध्ये सत्यापित विक्रेते, स्टॉक, MOQ, किंमत, व्हेरियंट आणि डिस्पॅच तपशील तुलना करा.' },
    { title: 'मर्चंट कमांड सेंटर', copy: 'FabricTrad न सोडता उत्पादने, इन्व्हेंटरी, ऑर्डर, पेमेंट, इनव्हॉइस, शिपिंग आणि अॅनालिटिक्स सांभाळा.' },
    { title: 'AI टेक्सटाइल वर्कफ्लो', copy: 'जिथे उपयोगी असेल तिथे AI-सहाय्यित कॅटलॉग साधने आणि विक्रेता टेक्सटाइलचा Virtual Drape अनुभव वापरा.' },
  ],
  privateGuidanceTitle: 'खाजगी व्यापार, सार्वजनिक मार्गदर्शन', privateGuidanceCopy: 'लाइव्ह मार्केटप्लेस नोंदी आणि खाते डेटा साइन-इनच्या मागे सुरक्षित राहतात; खरेदीदार आणि विक्रेता मार्गदर्शिका सर्वांसाठी खुल्या राहतात.',
  trustKicker: 'मोठ्या प्रमाणावर विश्वासासाठी तयार', trustTitle: 'स्पष्ट कॉमर्स दृश्य गोंधळापेक्षा चांगले.', trustCopy: 'FabricTrad स्पष्ट कॉन्ट्रास्ट, सहज पुढची पावले, भूमिकेनुसार नेव्हिगेशन आणि प्रतिसादक्षम लेआउट यांना प्राधान्य देते, तसेच गरजेप्रमाणे प्रगत सुविधा उपलब्ध ठेवते.',
  trustItems: [
    { title: 'सत्यापित नेटवर्क', copy: 'विक्रेता सत्यापन आणि भूमिकेनुसार खाते प्रवेश.' },
    { title: 'सुरक्षित पेमेंट', copy: 'विक्रेता स्वीकृतीनंतर सर्व्हर-सत्यापित Razorpay पेमेंट.' },
    { title: 'जोडलेले फुलफिलमेंट', copy: 'भरलेल्या ऑर्डरची शिपिंग आणि ट्रॅकिंग त्याच ऑर्डरशी जोडलेली राहते.' },
  ],
  footerHowToUse: 'कसे वापरायचे', footerHelp: 'मदत', footerPrivacy: 'गोपनीयता', footerTerms: 'अटी',
};

const gu: PublicLandingCopy = {
  navPlatform: 'પ્લેટફોર્મ', navCapabilities: 'ક્ષમતાઓ', navHowToUse: 'કેવી રીતે વાપરવું', navTrust: 'વિશ્વાસ અને સુરક્ષા',
  buyerWalkthrough: 'ખરીદદાર માર્ગદર્શિકા', buyerWalkthroughCopy: 'ઇન્ટરેક્ટિવ ખરીદી પ્રક્રિયા', sellerWalkthrough: 'વેચનાર માર્ગદર્શિકા', sellerWalkthroughCopy: 'ઇન્ટરેક્ટિવ વેચાણ પ્રક્રિયા',
  signIn: 'સાઇન ઇન', joinFabricTrad: 'FabricTrad સાથે જોડાઓ', kicker: 'ભારતના ટેક્સટાઇલ કોમર્સની ઓપરેટિંગ લેયર', titleLead: 'ટેક્સટાઇલ વેપાર,', titleAccent: 'આજ માટે નવા રૂપમાં.',
  heroCopy: 'FabricTrad ચકાસાયેલા ટેક્સટાઇલ ખરીદદારો અને વેચાણકર્તાઓને એક જ વાસ્તવિક વેપાર રેકોર્ડ સાથે જોડે છે. ઝડપથી શોધો અને સોર્સ કરો, કેટલોગ અને ઇન્વેન્ટરી સંભાળો, સુરક્ષિત ચુકવણી લો, દસ્તાવેજો બનાવો અને અલગ ખાતા કે તૂટક સાધનો વગર ચૂકવાયેલા ઓર્ડરને ફુલફિલમેન્ટ સુધી પહોંચાડો.',
  enterFabricTrad: 'FabricTrad માં પ્રવેશો', watchHowItWorks: 'કેવી રીતે કામ કરે છે તે જુઓ', verifiedSellerAccess: 'ચકાસાયેલ વેચનાર ઍક્સેસ', protectedPaymentFlow: 'સુરક્ષિત ચુકવણી પ્રક્રિયા', deviceSupport: 'ફોન, ટેબલેટ અને ડેસ્કટોપ',
  buyerMarketplace: 'ખરીદદાર માર્કેટપ્લેસ', buyerMarketplaceCopy: 'શોધો, સરખાવો, વિનંતી કરો, ચૂકવો અને ટ્રૅક કરો.', sellerOperations: 'વેચનાર ઓપરેશન્સ', sellerOperationsCopy: 'પ્રોડક્ટ, ઓર્ડર, નાણાં અને ફુલફિલમેન્ટ.', aiVirtualDrape: 'AI વર્ચ્યુઅલ ડ્રેપ', aiVirtualDrapeCopy: 'વેચનારનું ટેક્સટાઇલ તમારા ફોટા અથવા AI મોડેલ પર જુઓ.',
  workspacesKicker: 'એક પ્લેટફોર્મ, બે કેન્દ્રિત વર્કસ્પેસ', workspacesTitle: 'ઉપરથી સરળ. અંદરથી સક્ષમ.', workspacesCopy: 'ખરીદદારોને ERP ચલાવવાનું નહીં, સરળ ખરીદીનું અનુભવવું જોઈએ. વેચાણકર્તાઓને ખરીદદાર વેબસાઇટ ચલાવવાનું નહીં, આધુનિક સ્ટોર ચલાવવાનું અનુભવવું જોઈએ.',
  buyer: 'ખરીદદાર', marketplaceFirst: 'માર્કેટપ્લેસ-કેન્દ્રિત', buyerWorkspaceCopy: 'શોધ, ઓર્ડર, ચુકવણી અને ટ્રૅકિંગ.', seller: 'વેચનાર', operationsFirst: 'ઓપરેશન્સ-કેન્દ્રિત', sellerWorkspaceCopy: 'કેટલોગ, ફુલફિલમેન્ટ, કમાણી અને એનાલિટિક્સ.', admin: 'એડમિન', controlFirst: 'કંટ્રોલ-કેન્દ્રિત', adminWorkspaceCopy: 'ચકાસણી, જોખમ, વ્યવહારો અને ઓપરેશન્સ.',
  lifecycleKicker: 'જોડાયેલ ઓર્ડર જીવનચક્ર', lifecycleTitle: 'પ્રોડક્ટ શોધથી ચૂકવાયેલા ફુલફિલમેન્ટ સુધી—સંદર્ભ ગુમાવ્યા વગર.', lifecycleCopy: 'દરેક મહત્વપૂર્ણ પગલું મૂળ ઓર્ડર સાથે જોડાયેલ રહે છે: વેચનાર સ્વીકૃતિ, Razorpay કૅપ્ચર, ઇન્વૉઇસ, શિપમેન્ટ, ટ્રૅકિંગ અને સહાય.', lifecycleStepOne: 'લાઇવ પ્રોડક્ટ શોધો અથવા સોર્સિંગ જરૂરિયાત પોસ્ટ કરો.', lifecycleStepTwo: 'ચુકવણી ખુલતા પહેલાં વેચનાર ઓર્ડર અને સ્ટોકની પુષ્ટિ કરે છે.', lifecycleStepThree: 'ચકાસાયેલ ચુકવણી પછી ઇન્વૉઇસ, કમાણી અને ફુલફિલમેન્ટ સક્રિય થાય છે.',
  capabilities: [
    { title: 'શોધ-કેન્દ્રિત ખરીદી', copy: 'એક જ માર્કેટપ્લેસમાં ચકાસાયેલા વેચાણકર્તા, સ્ટોક, MOQ, કિંમત, વેરિઅન્ટ અને ડિસ્પૅચ વિગતો સરખાવો.' },
    { title: 'મર્ચન્ટ કમાન્ડ સેન્ટર', copy: 'FabricTrad છોડ્યા વગર પ્રોડક્ટ, ઇન્વેન્ટરી, ઓર્ડર, ચુકવણી, ઇન્વૉઇસ, શિપિંગ અને એનાલિટિક્સ સંભાળો.' },
    { title: 'AI ટેક્સટાઇલ વર્કફ્લો', copy: 'જ્યાં ઉપયોગી હોય ત્યાં AI-સહાયિત કેટલોગ ટૂલ્સ અને વેચનાર ટેક્સટાઇલનો Virtual Drape અનુભવ વાપરો.' },
  ],
  privateGuidanceTitle: 'ખાનગી વેપાર, જાહેર માર્ગદર્શન', privateGuidanceCopy: 'લાઇવ માર્કેટપ્લેસ રેકોર્ડ અને ખાતાનો ડેટા સાઇન-ઇન પાછળ સુરક્ષિત રહે છે; ખરીદદાર અને વેચનાર માર્ગદર્શિકા સૌ માટે ખુલ્લી રહે છે.',
  trustKicker: 'મોટા પાયાના વિશ્વાસ માટે બનાવેલું', trustTitle: 'સ્પષ્ટ કોમર્સ દૃશ્ય ગૂંચવણ કરતાં શ્રેષ્ઠ છે.', trustCopy: 'FabricTrad વાંચી શકાય તેવો કોન્ટ્રાસ્ટ, સ્પષ્ટ આગળના પગલાં, ભૂમિકા-આધારિત નેવિગેશન અને રિસ્પોન્સિવ લેઆઉટને પ્રાથમિકતા આપે છે અને જરૂર પડે ત્યારે અદ્યતન સુવિધાઓ ઉપલબ્ધ રાખે છે.',
  trustItems: [
    { title: 'ચકાસાયેલ નેટવર્ક', copy: 'વેચનાર ચકાસણી અને ભૂમિકા-આધારિત ખાતા ઍક્સેસ.' },
    { title: 'સુરક્ષિત ચુકવણી', copy: 'વેચનાર સ્વીકૃતિ પછી સર્વર-ચકાસાયેલ Razorpay ચુકવણી.' },
    { title: 'જોડાયેલ ફુલફિલમેન્ટ', copy: 'ચૂકવાયેલા ઓર્ડરની શિપિંગ અને ટ્રૅકિંગ એ જ ઓર્ડર સાથે જોડાયેલી રહે છે.' },
  ],
  footerHowToUse: 'કેવી રીતે વાપરવું', footerHelp: 'મદદ', footerPrivacy: 'ગોપનીયતા', footerTerms: 'શરતો',
};

const kn: PublicLandingCopy = {
  navPlatform: 'ಪ್ಲಾಟ್‌ಫಾರ್ಮ್', navCapabilities: 'ಸಾಮರ್ಥ್ಯಗಳು', navHowToUse: 'ಹೇಗೆ ಬಳಸುವುದು', navTrust: 'ವಿಶ್ವಾಸ ಮತ್ತು ಸುರಕ್ಷತೆ',
  buyerWalkthrough: 'ಖರೀದಿದಾರ ಮಾರ್ಗದರ್ಶಿ', buyerWalkthroughCopy: 'ಇಂಟರಾಕ್ಟಿವ್ ಖರೀದಿ ಪ್ರಕ್ರಿಯೆ', sellerWalkthrough: 'ಮಾರಾಟಗಾರ ಮಾರ್ಗದರ್ಶಿ', sellerWalkthroughCopy: 'ಇಂಟರಾಕ್ಟಿವ್ ಮಾರಾಟ ಪ್ರಕ್ರಿಯೆ',
  signIn: 'ಸೈನ್ ಇನ್', joinFabricTrad: 'FabricTrad ಸೇರಿ', kicker: 'ಭಾರತದ ಟೆಕ್ಸ್ಟೈಲ್ ಕಾಮರ್ಸ್ ಕಾರ್ಯಾಚರಣೆ ಪದರ', titleLead: 'ಟೆಕ್ಸ್ಟೈಲ್ ವ್ಯಾಪಾರ,', titleAccent: 'ಇಂದಿನ ಅಗತ್ಯಕ್ಕೆ ಹೊಸ ರೂಪದಲ್ಲಿ.',
  heroCopy: 'FabricTrad ಪರಿಶೀಲಿತ ಟೆಕ್ಸ್ಟೈಲ್ ಖರೀದಿದಾರರು ಮತ್ತು ಮಾರಾಟಗಾರರನ್ನು ಒಂದೇ ನೈಜ ವಾಣಿಜ್ಯ ದಾಖಲೆಗಳಿಗೆ ಸಂಪರ್ಕಿಸುತ್ತದೆ. ವೇಗವಾಗಿ ಹುಡುಕಿ ಮತ್ತು ಸೋರ್ಸ್ ಮಾಡಿ, ಕ್ಯಾಟಲಾಗ್ ಮತ್ತು ಇನ್‌ವೆಂಟರಿ ನಿರ್ವಹಿಸಿ, ಸುರಕ್ಷಿತ ಪಾವತಿಗಳನ್ನು ಸ್ವೀಕರಿಸಿ, ದಾಖಲೆಗಳನ್ನು ರಚಿಸಿ ಮತ್ತು ಪ್ರತ್ಯೇಕ ಖಾತೆಗಳು ಅಥವಾ ತುಂಡಾದ ಟೂಲ್‌ಗಳಿಲ್ಲದೆ ಪಾವತಿಸಿದ ಆರ್ಡರ್‌ಗಳನ್ನು ಫುಲ್ಫಿಲ್ಮೆಂಟ್‌ಗೆ ಕೊಂಡೊಯ್ಯಿರಿ.',
  enterFabricTrad: 'FabricTrad ಪ್ರವೇಶಿಸಿ', watchHowItWorks: 'ಇದು ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ ನೋಡಿ', verifiedSellerAccess: 'ಪರಿಶೀಲಿತ ಮಾರಾಟಗಾರ ಪ್ರವೇಶ', protectedPaymentFlow: 'ಸುರಕ್ಷಿತ ಪಾವತಿ ಪ್ರಕ್ರಿಯೆ', deviceSupport: 'ಫೋನ್, ಟ್ಯಾಬ್ಲೆಟ್ ಮತ್ತು ಡೆಸ್ಕ್‌ಟಾಪ್',
  buyerMarketplace: 'ಖರೀದಿದಾರ ಮಾರ್ಕೆಟ್‌ಪ್ಲೇಸ್', buyerMarketplaceCopy: 'ಹುಡುಕಿ, ಹೋಲಿಸಿ, ವಿನಂತಿಸಿ, ಪಾವತಿಸಿ ಮತ್ತು ಟ್ರ್ಯಾಕ್ ಮಾಡಿ.', sellerOperations: 'ಮಾರಾಟಗಾರ ಕಾರ್ಯಾಚರಣೆ', sellerOperationsCopy: 'ಉತ್ಪನ್ನಗಳು, ಆರ್ಡರ್‌ಗಳು, ಹಣ ಮತ್ತು ಫುಲ್ಫಿಲ್ಮೆಂಟ್.', aiVirtualDrape: 'AI ವರ್ಚುವಲ್ ಡ್ರೇಪ್', aiVirtualDrapeCopy: 'ಮಾರಾಟಗಾರರ ಟೆಕ್ಸ್ಟೈಲ್ ಅನ್ನು ನಿಮ್ಮ ಫೋಟೋ ಅಥವಾ AI ಮಾದರಿಯಲ್ಲಿ ನೋಡಿ.',
  workspacesKicker: 'ಒಂದು ಪ್ಲಾಟ್‌ಫಾರ್ಮ್, ಎರಡು ಕೇಂದ್ರೀಕೃತ ವರ್ಕ್‌ಸ್ಪೇಸ್‌ಗಳು', workspacesTitle: 'ಮೇಲ್ಮೈಯಲ್ಲಿ ಸರಳ. ಒಳಗೆ ಶಕ್ತಿಶಾಲಿ.', workspacesCopy: 'ಖರೀದಿದಾರರಿಗೆ ERP ನಡೆಸುವ ಅನುಭವವಲ್ಲ, ಸುಲಭವಾಗಿ ಖರೀದಿ ಮಾಡುವ ಅನುಭವ ಸಿಗಬೇಕು. ಮಾರಾಟಗಾರರಿಗೆ ಖರೀದಿದಾರರ ವೆಬ್‌ಸೈಟ್ ಬಳಸುವ ಅನುಭವವಲ್ಲ, ಆಧುನಿಕ ಅಂಗಡಿ ನಡೆಸುವ ಅನುಭವ ಸಿಗಬೇಕು.',
  buyer: 'ಖರೀದಿದಾರ', marketplaceFirst: 'ಮಾರ್ಕೆಟ್‌ಪ್ಲೇಸ್-ಕೇಂದ್ರಿತ', buyerWorkspaceCopy: 'ಹುಡುಕಾಟ, ಆರ್ಡರ್‌ಗಳು, ಪಾವತಿ ಮತ್ತು ಟ್ರ್ಯಾಕಿಂಗ್.', seller: 'ಮಾರಾಟಗಾರ', operationsFirst: 'ಕಾರ್ಯಾಚರಣೆ-ಕೇಂದ್ರಿತ', sellerWorkspaceCopy: 'ಕ್ಯಾಟಲಾಗ್, ಫುಲ್ಫಿಲ್ಮೆಂಟ್, ಆದಾಯ ಮತ್ತು ಅನಾಲಿಟಿಕ್ಸ್.', admin: 'ಅಡ್ಮಿನ್', controlFirst: 'ನಿಯಂತ್ರಣ-ಕೇಂದ್ರಿತ', adminWorkspaceCopy: 'ಪರಿಶೀಲನೆ, ಅಪಾಯ, ವ್ಯವಹಾರಗಳು ಮತ್ತು ಕಾರ್ಯಾಚರಣೆ.',
  lifecycleKicker: 'ಸಂಪರ್ಕಿತ ಆರ್ಡರ್ ಜೀವನಚಕ್ರ', lifecycleTitle: 'ಉತ್ಪನ್ನ ಹುಡುಕಾಟದಿಂದ ಪಾವತಿಸಿದ ಫುಲ್ಫಿಲ್ಮೆಂಟ್‌ವರೆಗೆ—ಸಂದರ್ಭ ಕಳೆದುಕೊಳ್ಳದೆ.', lifecycleCopy: 'ಪ್ರತಿ ಪ್ರಮುಖ ಹಂತವೂ ನೈಜ ಆರ್ಡರ್‌ಗೆ ಜೋಡಿತವಾಗಿರುತ್ತದೆ: ಮಾರಾಟಗಾರರ ಅನುಮೋದನೆ, Razorpay ಕ್ಯಾಪ್ಚರ್, ಇನ್‌ವಾಯ್ಸ್, ಶಿಪ್ಮೆಂಟ್, ಟ್ರ್ಯಾಕಿಂಗ್ ಮತ್ತು ಬೆಂಬಲ.', lifecycleStepOne: 'ಲೈವ್ ಉತ್ಪನ್ನ ಹುಡುಕಿ ಅಥವಾ ಸೋರ್ಸಿಂಗ್ ಅಗತ್ಯ ಪೋಸ್ಟ್ ಮಾಡಿ.', lifecycleStepTwo: 'ಪಾವತಿ ತೆರೆಯುವ ಮೊದಲು ಮಾರಾಟಗಾರ ಆರ್ಡರ್ ಮತ್ತು ಸ್ಟಾಕ್ ದೃಢಪಡಿಸುತ್ತಾರೆ.', lifecycleStepThree: 'ಪರಿಶೀಲಿತ ಪಾವತಿಯ ನಂತರ ಇನ್‌ವಾಯ್ಸ್, ಆದಾಯ ಮತ್ತು ಫುಲ್ಫಿಲ್ಮೆಂಟ್ ಸಕ್ರಿಯವಾಗುತ್ತವೆ.',
  capabilities: [
    { title: 'ಹುಡುಕಾಟ-ಕೇಂದ್ರಿತ ಖರೀದಿ', copy: 'ಒಂದೇ ಮಾರ್ಕೆಟ್‌ಪ್ಲೇಸ್‌ನಲ್ಲಿ ಪರಿಶೀಲಿತ ಮಾರಾಟಗಾರರು, ಸ್ಟಾಕ್, MOQ, ಬೆಲೆ, ವೇರಿಯಂಟ್ ಮತ್ತು ಡಿಸ್ಪ್ಯಾಚ್ ವಿವರಗಳನ್ನು ಹೋಲಿಸಿ.' },
    { title: 'ಮರ್ಚೆಂಟ್ ಕಮಾಂಡ್ ಸೆಂಟರ್', copy: 'FabricTrad ಬಿಡದೆ ಉತ್ಪನ್ನಗಳು, ಇನ್‌ವೆಂಟರಿ, ಆರ್ಡರ್‌ಗಳು, ಪಾವತಿಗಳು, ಇನ್‌ವಾಯ್ಸ್‌ಗಳು, ಶಿಪ್ಪಿಂಗ್ ಮತ್ತು ಅನಾಲಿಟಿಕ್ಸ್ ನಿರ್ವಹಿಸಿ.' },
    { title: 'AI ಟೆಕ್ಸ್ಟೈಲ್ ವರ್ಕ್‌ಫ್ಲೋ', copy: 'ಉಪಯುಕ್ತವಾಗಿರುವಲ್ಲಿ AI-ಸಹಾಯಿತ ಕ್ಯಾಟಲಾಗ್ ಟೂಲ್‌ಗಳು ಮತ್ತು ಮಾರಾಟಗಾರರ ಟೆಕ್ಸ್ಟೈಲ್ Virtual Drape ಅನುಭವ ಬಳಸಿ.' },
  ],
  privateGuidanceTitle: 'ಖಾಸಗಿ ವಾಣಿಜ್ಯ, ಸಾರ್ವಜನಿಕ ಮಾರ್ಗದರ್ಶನ', privateGuidanceCopy: 'ಲೈವ್ ಮಾರ್ಕೆಟ್‌ಪ್ಲೇಸ್ ದಾಖಲೆಗಳು ಮತ್ತು ಖಾತೆ ಡೇಟಾ ಸೈನ್-ಇನ್ ಹಿಂದೆ ಸುರಕ್ಷಿತವಾಗಿರುತ್ತವೆ; ಖರೀದಿದಾರ ಮತ್ತು ಮಾರಾಟಗಾರ ಮಾರ್ಗದರ್ಶಿಗಳು ಎಲ್ಲರಿಗೂ ಲಭ್ಯವಾಗುತ್ತವೆ.',
  trustKicker: 'ದೊಡ್ಡ ಮಟ್ಟದ ವಿಶ್ವಾಸಕ್ಕಾಗಿ ನಿರ್ಮಿಸಲಾಗಿದೆ', trustTitle: 'ಸ್ಪಷ್ಟ ಕಾಮರ್ಸ್ ದೃಶ್ಯ ಗೊಂದಲಕ್ಕಿಂತ ಉತ್ತಮ.', trustCopy: 'FabricTrad ಸ್ಪಷ್ಟ ಕಾಂಟ್ರಾಸ್ಟ್, ಸುಲಭ ಮುಂದಿನ ಹಂತಗಳು, ಪಾತ್ರ-ಆಧಾರಿತ ನ್ಯಾವಿಗೇಶನ್ ಮತ್ತು ರೆಸ್ಪಾನ್ಸಿವ್ ಲೇಔಟ್‌ಗೆ ಆದ್ಯತೆ ನೀಡುತ್ತದೆ; ಅಗತ್ಯವಿದ್ದಾಗ ಅಡ್ವಾನ್ಸ್ಡ್ ವೈಶಿಷ್ಟ್ಯಗಳನ್ನು ಲಭ್ಯವಾಗಿರಿಸುತ್ತದೆ.',
  trustItems: [
    { title: 'ಪರಿಶೀಲಿತ ನೆಟ್‌ವರ್ಕ್', copy: 'ಮಾರಾಟಗಾರ ಪರಿಶೀಲನೆ ಮತ್ತು ಪಾತ್ರ-ಆಧಾರಿತ ಖಾತೆ ಪ್ರವೇಶ.' },
    { title: 'ಸುರಕ್ಷಿತ ಪಾವತಿಗಳು', copy: 'ಮಾರಾಟಗಾರರ ಅನುಮೋದನೆಯ ನಂತರ ಸರ್ವರ್-ಪರಿಶೀಲಿತ Razorpay ಪಾವತಿ.' },
    { title: 'ಸಂಪರ್ಕಿತ ಫುಲ್ಫಿಲ್ಮೆಂಟ್', copy: 'ಪಾವತಿಸಿದ ಆರ್ಡರ್‌ನ ಶಿಪ್ಪಿಂಗ್ ಮತ್ತು ಟ್ರ್ಯಾಕಿಂಗ್ ಅದೇ ಆರ್ಡರ್‌ಗೆ ಜೋಡಿತವಾಗಿರುತ್ತದೆ.' },
  ],
  footerHowToUse: 'ಹೇಗೆ ಬಳಸುವುದು', footerHelp: 'ಸಹಾಯ', footerPrivacy: 'ಗೌಪ್ಯತೆ', footerTerms: 'ನಿಯಮಗಳು',
};

const ml: PublicLandingCopy = {
  navPlatform: 'പ്ലാറ്റ്ഫോം', navCapabilities: 'സവിശേഷതകൾ', navHowToUse: 'എങ്ങനെ ഉപയോഗിക്കാം', navTrust: 'വിശ്വാസവും സുരക്ഷയും',
  buyerWalkthrough: 'വാങ്ങുന്നവരുടെ മാർഗ്ഗനിർദ്ദേശം', buyerWalkthroughCopy: 'ഇന്ററാക്ടീവ് വാങ്ങൽ പ്രവാഹം', sellerWalkthrough: 'വിൽപ്പനക്കാരുടെ മാർഗ്ഗനിർദ്ദേശം', sellerWalkthroughCopy: 'ഇന്ററാക്ടീവ് വിൽപ്പന പ്രവാഹം',
  signIn: 'സൈൻ ഇൻ', joinFabricTrad: 'FabricTrad-ൽ ചേരുക', kicker: 'ഇന്ത്യയുടെ ടെക്സ്റ്റൈൽ കൊമേഴ്‌സ് ഓപ്പറേറ്റിംഗ് ലെയർ', titleLead: 'ടെക്സ്റ്റൈൽ വ്യാപാരം,', titleAccent: 'ഇന്നത്തേക്ക് പുതുക്കി നിർമ്മിച്ചത്.',
  heroCopy: 'FabricTrad പരിശോധിച്ച ടെക്സ്റ്റൈൽ വാങ്ങുന്നവരെയും വിൽപ്പനക്കാരെയും ഒരേ യഥാർത്ഥ വാണിജ്യ രേഖകളിൽ ബന്ധിപ്പിക്കുന്നു. വേഗത്തിൽ കണ്ടെത്തുകയും സോഴ്‌സ് ചെയ്യുകയും, കാറ്റലോഗും ഇൻവെന്ററിയും കൈകാര്യം ചെയ്യുകയും, സുരക്ഷിത പേയ്മെന്റുകൾ സ്വീകരിക്കുകയും, രേഖകൾ സൃഷ്ടിക്കുകയും, വേർതിരിച്ച അക്കൗണ്ടുകളോ ബന്ധമില്ലാത്ത ടൂളുകളോ ഇല്ലാതെ പണം ലഭിച്ച ഓർഡറുകൾ ഫുൾഫിൽമെന്റിലേക്ക് നീക്കുകയും ചെയ്യാം.',
  enterFabricTrad: 'FabricTrad-ലേക്ക് പ്രവേശിക്കുക', watchHowItWorks: 'ഇത് എങ്ങനെ പ്രവർത്തിക്കുന്നു കാണുക', verifiedSellerAccess: 'പരിശോധിച്ച വിൽപ്പനക്കാരുടെ ആക്സസ്', protectedPaymentFlow: 'സുരക്ഷിത പേയ്മെന്റ് പ്രവാഹം', deviceSupport: 'ഫോൺ, ടാബ്ലെറ്റ്, ഡെസ്ക്ടോപ്പ്',
  buyerMarketplace: 'വാങ്ങുന്നവരുടെ മാർക്കറ്റ്‌പ്ലേസ്', buyerMarketplaceCopy: 'തിരയുക, താരതമ്യം ചെയ്യുക, അഭ്യർത്ഥിക്കുക, പണമടയ്ക്കുക, ട്രാക്ക് ചെയ്യുക.', sellerOperations: 'വിൽപ്പനക്കാരുടെ ഓപ്പറേഷൻസ്', sellerOperationsCopy: 'ഉൽപ്പന്നങ്ങൾ, ഓർഡറുകൾ, പണം, ഫുൾഫിൽമെന്റ്.', aiVirtualDrape: 'AI വെർച്വൽ ഡ്രേപ്പ്', aiVirtualDrapeCopy: 'വിൽപ്പനക്കാരന്റെ ടെക്സ്റ്റൈൽ നിങ്ങളുടെ ഫോട്ടോയിലോ AI മോഡലിലോ മുൻകൂട്ടി കാണുക.',
  workspacesKicker: 'ഒരു പ്ലാറ്റ്ഫോം, രണ്ട് കേന്ദ്രീകൃത വർക്ക്‌സ്‌പേസുകൾ', workspacesTitle: 'മുകളിൽ ലളിതം. ഉള്ളിൽ ശക്തം.', workspacesCopy: 'വാങ്ങുന്നവർക്ക് ERP പ്രവർത്തിപ്പിക്കുന്നതുപോലെ അല്ല, ഷോപ്പിംഗ് ചെയ്യുന്നതുപോലെ തോന്നണം. വിൽപ്പനക്കാർക്ക് വാങ്ങുന്നവരുടെ വെബ്‌സൈറ്റ് ഉപയോഗിക്കുന്നതുപോലെ അല്ല, ആധുനിക സ്റ്റോർ നടത്തുന്നതുപോലെ തോന്നണം.',
  buyer: 'വാങ്ങുന്നവർ', marketplaceFirst: 'മാർക്കറ്റ്‌പ്ലേസ്-കേന്ദ്രിതം', buyerWorkspaceCopy: 'തിരച്ചിൽ, ഓർഡറുകൾ, പേയ്മെന്റ്, ട്രാക്കിംഗ്.', seller: 'വിൽപ്പനക്കാരൻ', operationsFirst: 'ഓപ്പറേഷൻസ്-കേന്ദ്രിതം', sellerWorkspaceCopy: 'കാറ്റലോഗ്, ഫുൾഫിൽമെന്റ്, വരുമാനം, അനലിറ്റിക്സ്.', admin: 'അഡ്മിൻ', controlFirst: 'നിയന്ത്രണം-കേന്ദ്രിതം', adminWorkspaceCopy: 'പരിശോധന, റിസ്ക്, ഇടപാടുകൾ, ഓപ്പറേഷൻസ്.',
  lifecycleKicker: 'ബന്ധിപ്പിച്ച ഓർഡർ ലൈഫ്‌സൈക്കിൾ', lifecycleTitle: 'ഉൽപ്പന്ന കണ്ടെത്തൽ മുതൽ പണമടച്ച ഫുൾഫിൽമെന്റ് വരെ—സന്ദർഭം നഷ്ടപ്പെടാതെ.', lifecycleCopy: 'ഓരോ പ്രധാന ഘട്ടവും യഥാർത്ഥ ഓർഡറുമായി ബന്ധിപ്പിച്ചിരിക്കും: വിൽപ്പനക്കാരന്റെ അംഗീകാരം, Razorpay ക്യാപ്ചർ, ഇൻവോയ്സ്, ഷിപ്പ്മെന്റ്, ട്രാക്കിംഗ്, പിന്തുണ.', lifecycleStepOne: 'ലൈവ് ഉൽപ്പന്നം കണ്ടെത്തുക അല്ലെങ്കിൽ സോഴ്‌സിംഗ് ആവശ്യം പോസ്റ്റ് ചെയ്യുക.', lifecycleStepTwo: 'പേയ്മെന്റ് തുറക്കുന്നതിന് മുമ്പ് വിൽപ്പനക്കാരൻ ഓർഡറും സ്റ്റോക്കും സ്ഥിരീകരിക്കുന്നു.', lifecycleStepThree: 'പരിശോധിച്ച പേയ്മെന്റിന് ശേഷം ഇൻവോയ്സ്, വരുമാനം, ഫുൾഫിൽമെന്റ് സജീവമാകും.',
  capabilities: [
    { title: 'സർച്ച്-ഫസ്റ്റ് വാങ്ങൽ', copy: 'ഒരേ മാർക്കറ്റ്‌പ്ലേസിൽ പരിശോധിച്ച വിൽപ്പനക്കാരെ, സ്റ്റോക്ക്, MOQ, വില, വേരിയന്റുകൾ, ഡിസ്പാച്ച് വിവരങ്ങൾ എന്നിവ താരതമ്യം ചെയ്യുക.' },
    { title: 'മർച്ചന്റ് കമാൻഡ് സെന്റർ', copy: 'FabricTrad വിടാതെ ഉൽപ്പന്നങ്ങൾ, ഇൻവെന്ററി, ഓർഡറുകൾ, പേയ്മെന്റുകൾ, ഇൻവോയ്സുകൾ, ഷിപ്പിംഗ്, അനലിറ്റിക്സ് എന്നിവ കൈകാര്യം ചെയ്യുക.' },
    { title: 'AI ടെക്സ്റ്റൈൽ വർക്ക്‌ഫ്ലോകൾ', copy: 'പ്രയോജനമുള്ളിടത്ത് AI-സഹായിത കാറ്റലോഗ് ടൂളുകളും വിൽപ്പനക്കാരന്റെ ടെക്സ്റ്റൈൽ Virtual Drape അനുഭവവും ഉപയോഗിക്കുക.' },
  ],
  privateGuidanceTitle: 'സ്വകാര്യ വാണിജ്യം, പൊതുവായ മാർഗ്ഗനിർദ്ദേശം', privateGuidanceCopy: 'ലൈവ് മാർക്കറ്റ്‌പ്ലേസ് രേഖകളും അക്കൗണ്ട് ഡാറ്റയും സൈൻ-ഇൻ പിന്നിൽ സുരക്ഷിതമായി തുടരും; വാങ്ങുന്നവർക്കും വിൽപ്പനക്കാർക്കും ഉള്ള ഇന്ററാക്ടീവ് മാർഗ്ഗനിർദ്ദേശങ്ങൾ എല്ലാവർക്കും ലഭ്യമാണ്.',
  trustKicker: 'വ്യാപകമായ വിശ്വാസത്തിനായി നിർമ്മിച്ചത്', trustTitle: 'വ്യക്തമായ കൊമേഴ്‌സ് ദൃശ്യ തിരക്കിനെക്കാൾ മികച്ചത്.', trustCopy: 'FabricTrad വായിക്കാൻ എളുപ്പമുള്ള കോൺട്രാസ്റ്റ്, വ്യക്തമായ അടുത്ത നടപടികൾ, റോളിനനുസരിച്ച നാവിഗേഷൻ, റെസ്പോൺസീവ് ലേഔട്ടുകൾ എന്നിവയ്ക്ക് മുൻഗണന നൽകുന്നു; ആവശ്യമായപ്പോൾ ഉയർന്ന സവിശേഷതകൾ ലഭ്യമാക്കുന്നു.',
  trustItems: [
    { title: 'പരിശോധിച്ച നെറ്റ്‌വർക്ക്', copy: 'വിൽപ്പനക്കാരുടെ പരിശോധനയും റോളിനനുസരിച്ച അക്കൗണ്ട് ആക്സസും.' },
    { title: 'സുരക്ഷിത പേയ്മെന്റുകൾ', copy: 'വിൽപ്പനക്കാരന്റെ അംഗീകാരത്തിന് ശേഷം സർവർ-പരിശോധിച്ച Razorpay പേയ്മെന്റ്.' },
    { title: 'ബന്ധിപ്പിച്ച ഫുൾഫിൽമെന്റ്', copy: 'പണമടച്ച ഓർഡറിന്റെ ഷിപ്പിംഗും ട്രാക്കിംഗും അതേ ഓർഡറുമായി ബന്ധിപ്പിച്ചിരിക്കും.' },
  ],
  footerHowToUse: 'എങ്ങനെ ഉപയോഗിക്കാം', footerHelp: 'സഹായം', footerPrivacy: 'സ്വകാര്യത', footerTerms: 'നിബന്ധനകൾ',
};

const pa: PublicLandingCopy = {
  navPlatform: 'ਪਲੇਟਫਾਰਮ', navCapabilities: 'ਸਮਰੱਥਾਵਾਂ', navHowToUse: 'ਕਿਵੇਂ ਵਰਤਣਾ ਹੈ', navTrust: 'ਭਰੋਸਾ ਅਤੇ ਸੁਰੱਖਿਆ',
  buyerWalkthrough: 'ਖਰੀਦਦਾਰ ਮਾਰਗਦਰਸ਼ਨ', buyerWalkthroughCopy: 'ਇੰਟਰਐਕਟਿਵ ਖਰੀਦ ਪ੍ਰਕਿਰਿਆ', sellerWalkthrough: 'ਵਿਕਰੇਤਾ ਮਾਰਗਦਰਸ਼ਨ', sellerWalkthroughCopy: 'ਇੰਟਰਐਕਟਿਵ ਵਿਕਰੀ ਪ੍ਰਕਿਰਿਆ',
  signIn: 'ਸਾਈਨ ਇਨ', joinFabricTrad: 'FabricTrad ਨਾਲ ਜੁੜੋ', kicker: 'ਭਾਰਤ ਦੇ ਟੈਕਸਟਾਈਲ ਕਾਮਰਸ ਦੀ ਓਪਰੇਟਿੰਗ ਲੇਅਰ', titleLead: 'ਟੈਕਸਟਾਈਲ ਵਪਾਰ,', titleAccent: 'ਅੱਜ ਲਈ ਨਵੇਂ ਰੂਪ ਵਿੱਚ।',
  heroCopy: 'FabricTrad ਤਸਦੀਕਸ਼ੁਦਾ ਟੈਕਸਟਾਈਲ ਖਰੀਦਦਾਰਾਂ ਅਤੇ ਵਿਕਰੇਤਾਵਾਂ ਨੂੰ ਇੱਕੋ ਅਸਲੀ ਵਪਾਰਕ ਰਿਕਾਰਡ ਨਾਲ ਜੋੜਦਾ ਹੈ। ਤੇਜ਼ੀ ਨਾਲ ਖੋਜੋ ਅਤੇ ਸੋਰਸ ਕਰੋ, ਕੈਟਾਲਾਗ ਅਤੇ ਇਨਵੈਂਟਰੀ ਸੰਭਾਲੋ, ਸੁਰੱਖਿਅਤ ਭੁਗਤਾਨ ਲਵੋ, ਦਸਤਾਵੇਜ਼ ਬਣਾਓ ਅਤੇ ਵੱਖਰੇ ਖਾਤਿਆਂ ਜਾਂ ਟੁੱਟੇ ਹੋਏ ਟੂਲਾਂ ਤੋਂ ਬਿਨਾਂ ਭੁਗਤਾਨ ਕੀਤੇ ਆਰਡਰ ਫੁਲਫਿਲਮੈਂਟ ਤੱਕ ਲਿਜਾਓ।',
  enterFabricTrad: 'FabricTrad ਵਿੱਚ ਦਾਖਲ ਹੋਵੋ', watchHowItWorks: 'ਦੇਖੋ ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ', verifiedSellerAccess: 'ਤਸਦੀਕਸ਼ੁਦਾ ਵਿਕਰੇਤਾ ਪਹੁੰਚ', protectedPaymentFlow: 'ਸੁਰੱਖਿਅਤ ਭੁਗਤਾਨ ਪ੍ਰਕਿਰਿਆ', deviceSupport: 'ਫੋਨ, ਟੈਬਲੈਟ ਅਤੇ ਡੈਸਕਟਾਪ',
  buyerMarketplace: 'ਖਰੀਦਦਾਰ ਮਾਰਕੀਟਪਲੇਸ', buyerMarketplaceCopy: 'ਖੋਜੋ, ਤੁਲਨਾ ਕਰੋ, ਬੇਨਤੀ ਕਰੋ, ਭੁਗਤਾਨ ਕਰੋ ਅਤੇ ਟ੍ਰੈਕ ਕਰੋ।', sellerOperations: 'ਵਿਕਰੇਤਾ ਓਪਰੇਸ਼ਨ', sellerOperationsCopy: 'ਉਤਪਾਦ, ਆਰਡਰ, ਪੈਸਾ ਅਤੇ ਫੁਲਫਿਲਮੈਂਟ।', aiVirtualDrape: 'AI ਵਰਚੁਅਲ ਡ੍ਰੇਪ', aiVirtualDrapeCopy: 'ਵਿਕਰੇਤਾ ਦੇ ਟੈਕਸਟਾਈਲ ਨੂੰ ਆਪਣੀ ਫੋਟੋ ਜਾਂ AI ਮਾਡਲ ਉੱਤੇ ਵੇਖੋ।',
  workspacesKicker: 'ਇੱਕ ਪਲੇਟਫਾਰਮ, ਦੋ ਕੇਂਦਰਿਤ ਵਰਕਸਪੇਸ', workspacesTitle: 'ਉੱਪਰੋਂ ਸੌਖਾ। ਅੰਦਰੋਂ ਸਮਰੱਥ।', workspacesCopy: 'ਖਰੀਦਦਾਰਾਂ ਨੂੰ ERP ਚਲਾਉਣ ਵਾਂਗ ਨਹੀਂ, ਸੌਖੀ ਖਰੀਦਦਾਰੀ ਵਾਂਗ ਮਹਿਸੂਸ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ। ਵਿਕਰੇਤਾਵਾਂ ਨੂੰ ਖਰੀਦਦਾਰ ਵੈੱਬਸਾਈਟ ਵਰਤਣ ਵਾਂਗ ਨਹੀਂ, ਆਧੁਨਿਕ ਸਟੋਰ ਚਲਾਉਣ ਵਾਂਗ ਮਹਿਸੂਸ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ।',
  buyer: 'ਖਰੀਦਦਾਰ', marketplaceFirst: 'ਮਾਰਕੀਟਪਲੇਸ-ਕੇਂਦਰਿਤ', buyerWorkspaceCopy: 'ਖੋਜ, ਆਰਡਰ, ਭੁਗਤਾਨ ਅਤੇ ਟ੍ਰੈਕਿੰਗ।', seller: 'ਵਿਕਰੇਤਾ', operationsFirst: 'ਓਪਰੇਸ਼ਨ-ਕੇਂਦਰਿਤ', sellerWorkspaceCopy: 'ਕੈਟਾਲਾਗ, ਫੁਲਫਿਲਮੈਂਟ, ਕਮਾਈ ਅਤੇ ਐਨਾਲਿਟਿਕਸ।', admin: 'ਐਡਮਿਨ', controlFirst: 'ਕੰਟਰੋਲ-ਕੇਂਦਰਿਤ', adminWorkspaceCopy: 'ਤਸਦੀਕ, ਜੋਖਮ, ਲੈਣ-ਦੇਣ ਅਤੇ ਓਪਰੇਸ਼ਨ।',
  lifecycleKicker: 'ਜੁੜਿਆ ਆਰਡਰ ਜੀਵਨਚੱਕਰ', lifecycleTitle: 'ਉਤਪਾਦ ਖੋਜ ਤੋਂ ਭੁਗਤਾਨ ਕੀਤੇ ਫੁਲਫਿਲਮੈਂਟ ਤੱਕ—ਸੰਦਰਭ ਗੁਆਏ ਬਿਨਾਂ।', lifecycleCopy: 'ਹਰ ਮਹੱਤਵਪੂਰਨ ਕਦਮ ਅਸਲੀ ਆਰਡਰ ਨਾਲ ਜੁੜਿਆ ਰਹਿੰਦਾ ਹੈ: ਵਿਕਰੇਤਾ ਮਨਜ਼ੂਰੀ, Razorpay ਕੈਪਚਰ, ਇਨਵੌਇਸ, ਸ਼ਿਪਮੈਂਟ, ਟ੍ਰੈਕਿੰਗ ਅਤੇ ਸਹਾਇਤਾ।', lifecycleStepOne: 'ਲਾਈਵ ਉਤਪਾਦ ਖੋਜੋ ਜਾਂ ਸੋਰਸਿੰਗ ਲੋੜ ਪੋਸਟ ਕਰੋ।', lifecycleStepTwo: 'ਭੁਗਤਾਨ ਖੁੱਲ੍ਹਣ ਤੋਂ ਪਹਿਲਾਂ ਵਿਕਰੇਤਾ ਆਰਡਰ ਅਤੇ ਸਟਾਕ ਦੀ ਪੁਸ਼ਟੀ ਕਰਦਾ ਹੈ।', lifecycleStepThree: 'ਤਸਦੀਕਸ਼ੁਦਾ ਭੁਗਤਾਨ ਤੋਂ ਬਾਅਦ ਇਨਵੌਇਸ, ਕਮਾਈ ਅਤੇ ਫੁਲਫਿਲਮੈਂਟ ਸਰਗਰਮ ਹੁੰਦੇ ਹਨ।',
  capabilities: [
    { title: 'ਖੋਜ-ਕੇਂਦਰਿਤ ਖਰੀਦ', copy: 'ਇੱਕੋ ਮਾਰਕੀਟਪਲੇਸ ਵਿੱਚ ਤਸਦੀਕਸ਼ੁਦਾ ਵਿਕਰੇਤਾ, ਸਟਾਕ, MOQ, ਕੀਮਤ, ਵੈਰੀਐਂਟ ਅਤੇ ਡਿਸਪੈਚ ਵੇਰਵੇ ਤੁਲਨਾ ਕਰੋ।' },
    { title: 'ਮਰਚੈਂਟ ਕਮਾਂਡ ਸੈਂਟਰ', copy: 'FabricTrad ਤੋਂ ਬਾਹਰ ਗਏ ਬਿਨਾਂ ਉਤਪਾਦ, ਇਨਵੈਂਟਰੀ, ਆਰਡਰ, ਭੁਗਤਾਨ, ਇਨਵੌਇਸ, ਸ਼ਿਪਿੰਗ ਅਤੇ ਐਨਾਲਿਟਿਕਸ ਸੰਭਾਲੋ।' },
    { title: 'AI ਟੈਕਸਟਾਈਲ ਵਰਕਫਲੋ', copy: 'ਜਿੱਥੇ ਲਾਭਕਾਰੀ ਹੋਵੇ ਉੱਥੇ AI-ਸਹਾਇਤ ਕੈਟਾਲਾਗ ਟੂਲ ਅਤੇ ਵਿਕਰੇਤਾ ਟੈਕਸਟਾਈਲ ਦਾ Virtual Drape ਅਨੁਭਵ ਵਰਤੋ।' },
  ],
  privateGuidanceTitle: 'ਨਿੱਜੀ ਵਪਾਰ, ਜਨਤਕ ਮਾਰਗਦਰਸ਼ਨ', privateGuidanceCopy: 'ਲਾਈਵ ਮਾਰਕੀਟਪਲੇਸ ਰਿਕਾਰਡ ਅਤੇ ਖਾਤਾ ਡਾਟਾ ਸਾਈਨ-ਇਨ ਦੇ ਪਿੱਛੇ ਸੁਰੱਖਿਅਤ ਰਹਿੰਦੇ ਹਨ; ਖਰੀਦਦਾਰ ਅਤੇ ਵਿਕਰੇਤਾ ਮਾਰਗਦਰਸ਼ਨ ਹਰ ਕਿਸੇ ਲਈ ਖੁੱਲ੍ਹੇ ਰਹਿੰਦੇ ਹਨ।',
  trustKicker: 'ਵੱਡੇ ਪੱਧਰ ਦੇ ਭਰੋਸੇ ਲਈ ਬਣਾਇਆ', trustTitle: 'ਸਪਸ਼ਟ ਕਾਮਰਸ ਦ੍ਰਿਸ਼ਟੀਗਤ ਭੀੜ ਨਾਲੋਂ ਵਧੀਆ ਹੈ।', trustCopy: 'FabricTrad ਪੜ੍ਹਨਯੋਗ ਕਨਟਰਾਸਟ, ਸਪਸ਼ਟ ਅਗਲੇ ਕਦਮ, ਭੂਮਿਕਾ-ਅਧਾਰਿਤ ਨੇਵੀਗੇਸ਼ਨ ਅਤੇ ਰਿਸਪਾਂਸਿਵ ਲੇਆਉਟ ਨੂੰ ਤਰਜੀਹ ਦਿੰਦਾ ਹੈ, ਅਤੇ ਜ਼ਰੂਰਤ ਪੈਣ ਤੇ ਉੱਨਤ ਫੀਚਰ ਉਪਲਬਧ ਰੱਖਦਾ ਹੈ।',
  trustItems: [
    { title: 'ਤਸਦੀਕਸ਼ੁਦਾ ਨੈੱਟਵਰਕ', copy: 'ਵਿਕਰੇਤਾ ਤਸਦੀਕ ਅਤੇ ਭੂਮਿਕਾ-ਅਧਾਰਿਤ ਖਾਤਾ ਪਹੁੰਚ।' },
    { title: 'ਸੁਰੱਖਿਅਤ ਭੁਗਤਾਨ', copy: 'ਵਿਕਰੇਤਾ ਮਨਜ਼ੂਰੀ ਤੋਂ ਬਾਅਦ ਸਰਵਰ-ਤਸਦੀਕਸ਼ੁਦਾ Razorpay ਭੁਗਤਾਨ।' },
    { title: 'ਜੁੜਿਆ ਫੁਲਫਿਲਮੈਂਟ', copy: 'ਭੁਗਤਾਨ ਕੀਤੇ ਆਰਡਰ ਦੀ ਸ਼ਿਪਿੰਗ ਅਤੇ ਟ੍ਰੈਕਿੰਗ ਉਸੇ ਆਰਡਰ ਨਾਲ ਜੁੜੀ ਰਹਿੰਦੀ ਹੈ।' },
  ],
  footerHowToUse: 'ਕਿਵੇਂ ਵਰਤਣਾ ਹੈ', footerHelp: 'ਮਦਦ', footerPrivacy: 'ਪਰਦੇਦਾਰੀ', footerTerms: 'ਸ਼ਰਤਾਂ',
};

const ta: PublicLandingCopy = {
  navPlatform: 'தளம்', navCapabilities: 'வசதிகள்', navHowToUse: 'எப்படி பயன்படுத்துவது', navTrust: 'நம்பிக்கை மற்றும் பாதுகாப்பு',
  buyerWalkthrough: 'வாங்குபவர் வழிகாட்டி', buyerWalkthroughCopy: 'ஊடாடும் வாங்கும் நடைமுறை', sellerWalkthrough: 'விற்பனையாளர் வழிகாட்டி', sellerWalkthroughCopy: 'ஊடாடும் விற்பனை நடைமுறை',
  signIn: 'உள்நுழைய', joinFabricTrad: 'FabricTrad-ல் இணையுங்கள்', kicker: 'இந்தியாவின் டெக்ஸ்டைல் வர்த்தக இயக்கத் தளம்', titleLead: 'டெக்ஸ்டைல் வர்த்தகம்,', titleAccent: 'இன்றைக்காக புதிதாக வடிவமைக்கப்பட்டது.',
  heroCopy: 'FabricTrad சரிபார்க்கப்பட்ட டெக்ஸ்டைல் வாங்குபவர்களையும் விற்பனையாளர்களையும் ஒரே உண்மையான வர்த்தக பதிவுகளில் இணைக்கிறது. வேகமாக தேடி சோர்ஸ் செய்யுங்கள், பட்டியல் மற்றும் இருப்பை நிர்வகியுங்கள், பாதுகாப்பான கட்டணங்களைப் பெறுங்கள், ஆவணங்களை உருவாக்குங்கள், தனித்தனி கணக்குகள் அல்லது இணைக்கப்படாத கருவிகள் இல்லாமல் பணம் செலுத்தப்பட்ட ஆர்டர்களை நிறைவேற்றத்துக்கு நகர்த்துங்கள்.',
  enterFabricTrad: 'FabricTrad-க்கு செல்லுங்கள்', watchHowItWorks: 'இது எப்படி செயல்படுகிறது என்பதைப் பாருங்கள்', verifiedSellerAccess: 'சரிபார்க்கப்பட்ட விற்பனையாளர் அணுகல்', protectedPaymentFlow: 'பாதுகாப்பான கட்டண நடைமுறை', deviceSupport: 'தொலைபேசி, டேப்லெட் மற்றும் டெஸ்க்டாப்',
  buyerMarketplace: 'வாங்குபவர் மார்க்கெட்பிளேஸ்', buyerMarketplaceCopy: 'தேடுங்கள், ஒப்பிடுங்கள், கோருங்கள், பணம் செலுத்துங்கள், கண்காணியுங்கள்.', sellerOperations: 'விற்பனையாளர் செயல்பாடுகள்', sellerOperationsCopy: 'தயாரிப்புகள், ஆர்டர்கள், பணம் மற்றும் நிறைவேற்றம்.', aiVirtualDrape: 'AI விர்ச்சுவல் ட்ரேப்', aiVirtualDrapeCopy: 'விற்பனையாளரின் டெக்ஸ்டைலை உங்கள் புகைப்படம் அல்லது AI மாதிரியில் முன்னோட்டமாகப் பாருங்கள்.',
  workspacesKicker: 'ஒரு தளம், இரண்டு கவனம் செலுத்தப்பட்ட பணிப்பகுதிகள்', workspacesTitle: 'மேற்பரப்பில் எளிது. உள்ளே சக்திவாய்ந்தது.', workspacesCopy: 'வாங்குபவர்களுக்கு ERP இயக்குவது போல அல்ல, இயல்பாக வாங்குவது போல உணர வேண்டும். விற்பனையாளர்களுக்கு வாங்குபவர் இணையதளத்தைப் பயன்படுத்துவது போல அல்ல, நவீன கடையை நடத்துவது போல உணர வேண்டும்.',
  buyer: 'வாங்குபவர்', marketplaceFirst: 'மார்க்கெட்பிளேஸ்-முன்னிலை', buyerWorkspaceCopy: 'தேடல், ஆர்டர்கள், கட்டணம் மற்றும் கண்காணிப்பு.', seller: 'விற்பனையாளர்', operationsFirst: 'செயல்பாடு-முன்னிலை', sellerWorkspaceCopy: 'பட்டியல், நிறைவேற்றம், வருமானம் மற்றும் பகுப்பாய்வு.', admin: 'நிர்வாகி', controlFirst: 'கட்டுப்பாடு-முன்னிலை', adminWorkspaceCopy: 'சரிபார்ப்பு, அபாயம், பரிவர்த்தனைகள் மற்றும் செயல்பாடுகள்.',
  lifecycleKicker: 'இணைக்கப்பட்ட ஆர்டர் வாழ்க்கைச் சுழற்சி', lifecycleTitle: 'தயாரிப்பு கண்டுபிடிப்பிலிருந்து பணம் செலுத்தப்பட்ட நிறைவேற்றம் வரை—சூழலை இழக்காமல்.', lifecycleCopy: 'ஒவ்வொரு முக்கிய கட்டமும் உண்மையான ஆர்டருடன் இணைந்தே இருக்கும்: விற்பனையாளர் ஒப்புதல், Razorpay capture, இன்வாய்ஸ், ஷிப்மென்ட், கண்காணிப்பு மற்றும் ஆதரவு.', lifecycleStepOne: 'நேரடி தயாரிப்பை கண்டுபிடிக்கவும் அல்லது சோர்சிங் தேவையைப் பதிவிடவும்.', lifecycleStepTwo: 'கட்டணம் திறக்கும்முன் விற்பனையாளர் ஆர்டரும் இருப்பும் உறுதிப்படுத்துகிறார்.', lifecycleStepThree: 'சரிபார்க்கப்பட்ட கட்டணத்திற்குப் பிறகு இன்வாய்ஸ், வருமானம் மற்றும் நிறைவேற்றம் செயல்படும்.',
  capabilities: [
    { title: 'தேடல்-முன்னிலை வாங்குதல்', copy: 'ஒரே மார்க்கெட்பிளேஸில் சரிபார்க்கப்பட்ட விற்பனையாளர்கள், இருப்பு, MOQ, விலை, வகைகள் மற்றும் அனுப்பும் விவரங்களை ஒப்பிடுங்கள்.' },
    { title: 'வணிகர் கட்டுப்பாட்டு மையம்', copy: 'FabricTrad-ஐ விட்டு வெளியேறாமல் தயாரிப்புகள், இருப்பு, ஆர்டர்கள், கட்டணங்கள், இன்வாய்ஸ்கள், ஷிப்பிங் மற்றும் பகுப்பாய்வை நிர்வகியுங்கள்.' },
    { title: 'AI டெக்ஸ்டைல் பணிச்சுற்று', copy: 'பயனுள்ள இடங்களில் AI-உதவிய பட்டியல் கருவிகளையும் விற்பனையாளர் டெக்ஸ்டைலுக்கான Virtual Drape அனுபவத்தையும் பயன்படுத்துங்கள்.' },
  ],
  privateGuidanceTitle: 'தனியார் வர்த்தகம், பொது வழிகாட்டல்', privateGuidanceCopy: 'நேரடி மார்க்கெட்பிளேஸ் பதிவுகளும் கணக்கு தரவும் உள்நுழைவுக்குப் பின்னால் பாதுகாப்பாக இருக்கும்; வாங்குபவர் மற்றும் விற்பனையாளர் ஊடாடும் வழிகாட்டிகள் அனைவருக்கும் திறந்தவையாக இருக்கும்.',
  trustKicker: 'பெரிய அளவிலான நம்பிக்கைக்காக உருவாக்கப்பட்டது', trustTitle: 'தெளிவான வர்த்தகம் காட்சி நெரிசலைவிட சிறந்தது.', trustCopy: 'FabricTrad தெளிவான மாறுபாடு, எளிதில் புரியும் அடுத்த படிகள், பாத்திர அடிப்படையிலான வழிசெலுத்தல் மற்றும் பதிலளிக்கும் தளவமைப்புகளுக்கு முன்னுரிமை அளிக்கிறது; தேவையான போது மேம்பட்ட வசதிகளையும் வழங்குகிறது.',
  trustItems: [
    { title: 'சரிபார்க்கப்பட்ட வலையமைப்பு', copy: 'விற்பனையாளர் சரிபார்ப்பும் பாத்திர அடிப்படையிலான கணக்கு அணுகலும்.' },
    { title: 'பாதுகாப்பான கட்டணங்கள்', copy: 'விற்பனையாளர் ஒப்புதலுக்குப் பிறகு சர்வர் சரிபார்க்கும் Razorpay கட்டணம்.' },
    { title: 'இணைக்கப்பட்ட நிறைவேற்றம்', copy: 'பணம் செலுத்தப்பட்ட ஆர்டரின் ஷிப்பிங்கும் கண்காணிப்பும் அதே ஆர்டருடன் இணைந்தே இருக்கும்.' },
  ],
  footerHowToUse: 'எப்படி பயன்படுத்துவது', footerHelp: 'உதவி', footerPrivacy: 'தனியுரிமை', footerTerms: 'விதிமுறைகள்',
};

const te: PublicLandingCopy = {
  navPlatform: 'ప్లాట్‌ఫారమ్', navCapabilities: 'సామర్థ్యాలు', navHowToUse: 'ఎలా ఉపయోగించాలి', navTrust: 'నమ్మకం మరియు భద్రత',
  buyerWalkthrough: 'కొనుగోలుదారు మార్గదర్శకం', buyerWalkthroughCopy: 'ఇంటరాక్టివ్ కొనుగోలు ప్రక్రియ', sellerWalkthrough: 'విక్రేత మార్గదర్శకం', sellerWalkthroughCopy: 'ఇంటరాక్టివ్ అమ్మకపు ప్రక్రియ',
  signIn: 'సైన్ ఇన్', joinFabricTrad: 'FabricTradలో చేరండి', kicker: 'భారత టెక్స్టైల్ కామర్స్ ఆపరేటింగ్ లేయర్', titleLead: 'టెక్స్టైల్ వ్యాపారం,', titleAccent: 'ఈ రోజుకు కొత్తగా నిర్మించబడింది.',
  heroCopy: 'FabricTrad ధృవీకరించిన టెక్స్టైల్ కొనుగోలుదారులు మరియు విక్రేతలను ఒకే నిజమైన వాణిజ్య రికార్డులతో కలుపుతుంది. వేగంగా వెతికి సోర్స్ చేయండి, క్యాటలాగ్ మరియు ఇన్వెంటరీని నిర్వహించండి, సురక్షిత చెల్లింపులు స్వీకరించండి, పత్రాలు రూపొందించండి, వేర్వేరు ఖాతాలు లేదా విడిపోయిన టూల్స్ లేకుండా చెల్లించిన ఆర్డర్లను ఫుల్ఫిల్మెంట్‌కు తీసుకెళ్లండి.',
  enterFabricTrad: 'FabricTradలోకి వెళ్లండి', watchHowItWorks: 'ఇది ఎలా పనిచేస్తుందో చూడండి', verifiedSellerAccess: 'ధృవీకరించిన విక్రేత యాక్సెస్', protectedPaymentFlow: 'సురక్షిత చెల్లింపు ప్రవాహం', deviceSupport: 'ఫోన్, టాబ్లెట్ మరియు డెస్క్‌టాప్',
  buyerMarketplace: 'కొనుగోలుదారు మార్కెట్‌ప్లేస్', buyerMarketplaceCopy: 'వెతకండి, పోల్చండి, అభ్యర్థించండి, చెల్లించండి, ట్రాక్ చేయండి.', sellerOperations: 'విక్రేత కార్యకలాపాలు', sellerOperationsCopy: 'ఉత్పత్తులు, ఆర్డర్లు, డబ్బు మరియు ఫుల్ఫిల్మెంట్.', aiVirtualDrape: 'AI వర్చువల్ డ్రేప్', aiVirtualDrapeCopy: 'విక్రేత టెక్స్టైల్‌ను మీ ఫోటో లేదా AI మోడల్‌పై ముందుగా చూడండి.',
  workspacesKicker: 'ఒక ప్లాట్‌ఫారమ్, రెండు కేంద్రీకృత వర్క్‌స్పేస్‌లు', workspacesTitle: 'పైకి సులభం. లోపల శక్తివంతం.', workspacesCopy: 'కొనుగోలుదారులకు ERP నడుపుతున్నట్లుగా కాకుండా సహజంగా కొనుగోలు చేస్తున్నట్లుగా అనిపించాలి. విక్రేతలకు కొనుగోలుదారు వెబ్‌సైట్ ఉపయోగిస్తున్నట్లుగా కాకుండా ఆధునిక స్టోర్ నడుపుతున్నట్లుగా అనిపించాలి.',
  buyer: 'కొనుగోలుదారు', marketplaceFirst: 'మార్కెట్‌ప్లేస్-కేంద్రితం', buyerWorkspaceCopy: 'శోధన, ఆర్డర్లు, చెల్లింపు మరియు ట్రాకింగ్.', seller: 'విక్రేత', operationsFirst: 'కార్యకలాపాలు-కేంద్రితం', sellerWorkspaceCopy: 'క్యాటలాగ్, ఫుల్ఫిల్మెంట్, ఆదాయం మరియు అనలిటిక్స్.', admin: 'అడ్మిన్', controlFirst: 'నియంత్రణ-కేంద్రితం', adminWorkspaceCopy: 'ధృవీకరణ, ప్రమాదం, లావాదేవీలు మరియు కార్యకలాపాలు.',
  lifecycleKicker: 'అనుసంధానమైన ఆర్డర్ జీవచక్రం', lifecycleTitle: 'ఉత్పత్తి అన్వేషణ నుంచి చెల్లించిన ఫుల్ఫిల్మెంట్ వరకు—సందర్భం కోల్పోకుండా.', lifecycleCopy: 'ప్రతి ముఖ్యమైన దశ నిజమైన ఆర్డర్‌కే అనుసంధానంగా ఉంటుంది: విక్రేత ఆమోదం, Razorpay క్యాప్చర్, ఇన్వాయిస్, షిప్మెంట్, ట్రాకింగ్ మరియు సహాయం.', lifecycleStepOne: 'లైవ్ ఉత్పత్తిని కనుగొనండి లేదా సోర్సింగ్ అవసరాన్ని పోస్ట్ చేయండి.', lifecycleStepTwo: 'చెల్లింపు ప్రారంభమయ్యే ముందు విక్రేత ఆర్డర్ మరియు స్టాక్‌ను ధృవీకరిస్తారు.', lifecycleStepThree: 'ధృవీకరించిన చెల్లింపు తర్వాత ఇన్వాయిస్, ఆదాయం మరియు ఫుల్ఫిల్మెంట్ సక్రియమవుతాయి.',
  capabilities: [
    { title: 'శోధన-కేంద్రిత కొనుగోలు', copy: 'ఒకే మార్కెట్‌ప్లేస్‌లో ధృవీకరించిన విక్రేతలు, స్టాక్, MOQ, ధర, వేరియంట్లు మరియు డిస్పాచ్ వివరాలను పోల్చండి.' },
    { title: 'మర్చంట్ కమాండ్ సెంటర్', copy: 'FabricTradను వదలకుండా ఉత్పత్తులు, ఇన్వెంటరీ, ఆర్డర్లు, చెల్లింపులు, ఇన్వాయిస్‌లు, షిప్పింగ్ మరియు అనలిటిక్స్‌ను నిర్వహించండి.' },
    { title: 'AI టెక్స్టైల్ వర్క్‌ఫ్లోలు', copy: 'ఉపయోగకరమైన చోట AI-సహాయిత క్యాటలాగ్ టూల్స్ మరియు విక్రేత టెక్స్టైల్ Virtual Drape అనుభవాన్ని ఉపయోగించండి.' },
  ],
  privateGuidanceTitle: 'ప్రైవేట్ వాణిజ్యం, పబ్లిక్ మార్గదర్శకం', privateGuidanceCopy: 'లైవ్ మార్కెట్‌ప్లేస్ రికార్డులు మరియు ఖాతా డేటా సైన్-ఇన్ వెనుక సురక్షితంగా ఉంటాయి; కొనుగోలుదారు మరియు విక్రేత ఇంటరాక్టివ్ మార్గదర్శకాలు అందరికీ అందుబాటులో ఉంటాయి.',
  trustKicker: 'పెద్ద స్థాయి నమ్మకానికి నిర్మించబడింది', trustTitle: 'స్పష్టమైన కామర్స్ దృశ్య గందరగోళం కంటే మెరుగైనది.', trustCopy: 'FabricTrad చదవడానికి సులభమైన కాంట్రాస్ట్, స్పష్టమైన తదుపరి చర్యలు, పాత్ర ఆధారిత నావిగేషన్ మరియు రెస్పాన్సివ్ లేఔట్లకు ప్రాధాన్యం ఇస్తుంది; అవసరమైనప్పుడు అధునాతన సదుపాయాలను అందుబాటులో ఉంచుతుంది.',
  trustItems: [
    { title: 'ధృవీకరించిన నెట్‌వర్క్', copy: 'విక్రేత ధృవీకరణ మరియు పాత్ర ఆధారిత ఖాతా యాక్సెస్.' },
    { title: 'సురక్షిత చెల్లింపులు', copy: 'విక్రేత ఆమోదం తర్వాత సర్వర్-ధృవీకరించిన Razorpay చెల్లింపు.' },
    { title: 'అనుసంధానమైన ఫుల్ఫిల్మెంట్', copy: 'చెల్లించిన ఆర్డర్ షిప్పింగ్ మరియు ట్రాకింగ్ అదే ఆర్డర్‌కు అనుసంధానంగా ఉంటాయి.' },
  ],
  footerHowToUse: 'ఎలా ఉపయోగించాలి', footerHelp: 'సహాయం', footerPrivacy: 'గోప్యత', footerTerms: 'నిబంధనలు',
};

const dictionaries: Record<SupportedLanguageCode, PublicLandingCopy> = {
  en,
  hi,
  bn,
  gu,
  kn,
  ml,
  mr,
  pa,
  ta,
  te,
};

export function getPublicLandingCopy(language: SupportedLanguageCode): PublicLandingCopy {
  return dictionaries[language] || en;
}
