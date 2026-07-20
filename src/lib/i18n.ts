'use client';

export type SupportedLanguageCode = 'en' | 'hi' | 'bn' | 'gu' | 'kn' | 'ml' | 'mr' | 'pa' | 'ta' | 'te';

export const SUPPORTED_LANGUAGES: Array<{ code: SupportedLanguageCode; label: string; nativeLabel: string }> = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
  { code: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' },
];

const en = {
  'nav.marketplace': 'Marketplace',
  'nav.aiTools': 'AI tools',
  'nav.howItWorks': 'How it works',
  'nav.sell': 'Sell on FabricTrad',
  'nav.signIn': 'Sign in',
  'nav.createAccount': 'Create account',
  'nav.dashboard': 'Dashboard',
  'nav.orders': 'My orders',
  'nav.profile': 'Profile',
  'nav.signOut': 'Sign out',
  'landing.badge': 'India’s verified B2B textile network',
  'landing.title': 'Source textiles with confidence. Sell across India.',
  'landing.subtitle': 'FabricTrad connects GST-verified textile businesses with transparent pricing, secure orders, multilingual support and AI-assisted fabric visualisation.',
  'landing.browse': 'Browse marketplace',
  'landing.sell': 'Start selling',
  'landing.drape': 'Try AI Drape Studio',
  'landing.verified': 'Verified businesses',
  'landing.states': 'States and UTs supported',
  'landing.languages': 'Indian languages',
  'landing.workflow': 'One connected workflow',
  'landing.workflowSubtitle': 'From discovery to dispatch, every step is designed for business buyers and textile sellers.',
  'landing.discover': 'Discover verified textiles',
  'landing.discoverText': 'Search by fabric, work, price, MOQ, dispatch speed and seller location.',
  'landing.negotiate': 'Negotiate and order',
  'landing.negotiateText': 'Create bulk enquiries, receive counter-offers and track confirmed orders.',
  'landing.fulfil': 'Pay and fulfil securely',
  'landing.fulfilText': 'Server-verified payments, shipping updates and business documents in one place.',
  'landing.buyers': 'Built for buyers',
  'landing.sellers': 'Built for sellers',
  'landing.buyerText': 'Compare suppliers, save fabrics, manage pending orders and track delivery progress.',
  'landing.sellerText': 'Add products, update stock, respond to orders, upload bills and manage fulfilment.',
  'landing.cta': 'Ready to modernise your textile sourcing?',
  'landing.ctaText': 'Create your FabricTrad business account and choose your state and preferred language.',
  'preferences.language': 'Language',
  'preferences.theme': 'Theme',
  'preferences.light': 'Light',
  'preferences.dark': 'Dark',
  'preferences.system': 'System',
  'registration.state': 'State / Union Territory',
  'registration.language': 'Preferred language',
  'registration.address': 'Business / delivery address',
} as const;

export type TranslationKey = keyof typeof en;
type Dictionary = Partial<Record<TranslationKey, string>>;

const dictionaries: Record<SupportedLanguageCode, Dictionary> = {
  en,
  hi: {
    'nav.marketplace': 'मार्केटप्लेस', 'nav.aiTools': 'एआई टूल्स', 'nav.howItWorks': 'यह कैसे काम करता है', 'nav.sell': 'FabricTrad पर बेचें', 'nav.signIn': 'साइन इन', 'nav.createAccount': 'खाता बनाएँ', 'nav.dashboard': 'डैशबोर्ड', 'nav.orders': 'मेरे ऑर्डर', 'nav.profile': 'प्रोफ़ाइल', 'nav.signOut': 'साइन आउट',
    'landing.badge': 'भारत का सत्यापित B2B टेक्सटाइल नेटवर्क', 'landing.title': 'विश्वास के साथ कपड़ा खरीदें। पूरे भारत में बेचें।', 'landing.subtitle': 'FabricTrad सत्यापित टेक्सटाइल व्यवसायों को पारदर्शी कीमत, सुरक्षित ऑर्डर, भारतीय भाषाओं और एआई फैब्रिक विज़ुअलाइज़ेशन से जोड़ता है।', 'landing.browse': 'मार्केटप्लेस देखें', 'landing.sell': 'बेचना शुरू करें', 'landing.drape': 'एआई ड्रेप स्टूडियो आज़माएँ', 'landing.verified': 'सत्यापित व्यवसाय', 'landing.states': 'राज्य और केंद्र शासित प्रदेश', 'landing.languages': 'भारतीय भाषाएँ', 'landing.workflow': 'एक जुड़ा हुआ कार्यप्रवाह', 'landing.buyers': 'खरीदारों के लिए', 'landing.sellers': 'विक्रेताओं के लिए', 'landing.cta': 'टेक्सटाइल सोर्सिंग को आधुनिक बनाने के लिए तैयार हैं?', 'preferences.language': 'भाषा', 'preferences.theme': 'थीम', 'preferences.light': 'लाइट', 'preferences.dark': 'डार्क', 'preferences.system': 'सिस्टम', 'registration.state': 'राज्य / केंद्र शासित प्रदेश', 'registration.language': 'पसंदीदा भाषा', 'registration.address': 'व्यवसाय / डिलीवरी पता',
  },
  mr: {
    'nav.marketplace': 'मार्केटप्लेस', 'nav.aiTools': 'एआय साधने', 'nav.sell': 'FabricTrad वर विका', 'nav.signIn': 'साइन इन', 'nav.createAccount': 'खाते तयार करा', 'landing.title': 'विश्वासाने कापड खरेदी करा. संपूर्ण भारतात विका.', 'landing.browse': 'मार्केटप्लेस पहा', 'landing.sell': 'विक्री सुरू करा', 'landing.drape': 'एआय ड्रेप स्टुडिओ वापरा', 'preferences.language': 'भाषा', 'preferences.theme': 'थीम', 'registration.state': 'राज्य / केंद्रशासित प्रदेश', 'registration.language': 'पसंतीची भाषा',
  },
  gu: {
    'nav.marketplace': 'માર્કેટપ્લેસ', 'nav.aiTools': 'AI સાધનો', 'nav.sell': 'FabricTrad પર વેચો', 'nav.signIn': 'સાઇન ઇન', 'nav.createAccount': 'ખાતું બનાવો', 'landing.title': 'વિશ્વાસથી કાપડ ખરીદો. સમગ્ર ભારતમાં વેચો.', 'landing.browse': 'માર્કેટપ્લેસ જુઓ', 'landing.sell': 'વેચાણ શરૂ કરો', 'preferences.language': 'ભાષા', 'preferences.theme': 'થીમ', 'registration.state': 'રાજ્ય / કેન્દ્રશાસિત પ્રદેશ',
  },
  bn: {
    'nav.marketplace': 'মার্কেটপ্লেস', 'nav.aiTools': 'এআই টুলস', 'nav.sell': 'FabricTrad-এ বিক্রি করুন', 'nav.signIn': 'সাইন ইন', 'nav.createAccount': 'অ্যাকাউন্ট তৈরি করুন', 'landing.title': 'আস্থার সঙ্গে কাপড় সংগ্রহ করুন। সারা ভারতে বিক্রি করুন।', 'landing.browse': 'মার্কেটপ্লেস দেখুন', 'landing.sell': 'বিক্রি শুরু করুন', 'preferences.language': 'ভাষা', 'preferences.theme': 'থিম', 'registration.state': 'রাজ্য / কেন্দ্রশাসিত অঞ্চল',
  },
  ta: {
    'nav.marketplace': 'சந்தை', 'nav.aiTools': 'AI கருவிகள்', 'nav.sell': 'FabricTrad-ல் விற்கவும்', 'nav.signIn': 'உள்நுழைக', 'nav.createAccount': 'கணக்கை உருவாக்கவும்', 'landing.title': 'நம்பிக்கையுடன் துணிகளை வாங்குங்கள். இந்தியா முழுவதும் விற்கவும்.', 'landing.browse': 'சந்தையைப் பாருங்கள்', 'landing.sell': 'விற்பனையைத் தொடங்குங்கள்', 'preferences.language': 'மொழி', 'preferences.theme': 'தீம்', 'registration.state': 'மாநிலம் / யூனியன் பிரதேசம்',
  },
  te: {
    'nav.marketplace': 'మార్కెట్‌ప్లేస్', 'nav.aiTools': 'AI సాధనాలు', 'nav.sell': 'FabricTradలో విక్రయించండి', 'nav.signIn': 'సైన్ ఇన్', 'nav.createAccount': 'ఖాతా సృష్టించండి', 'landing.title': 'నమ్మకంతో వస్త్రాలను కొనండి. భారతదేశమంతటా అమ్మండి.', 'landing.browse': 'మార్కెట్‌ప్లేస్ చూడండి', 'landing.sell': 'అమ్మకం ప్రారంభించండి', 'preferences.language': 'భాష', 'preferences.theme': 'థీమ్', 'registration.state': 'రాష్ట్రం / కేంద్ర పాలిత ప్రాంతం',
  },
  kn: {
    'nav.marketplace': 'ಮಾರುಕಟ್ಟೆ', 'nav.aiTools': 'AI ಸಾಧನಗಳು', 'nav.sell': 'FabricTradನಲ್ಲಿ ಮಾರಾಟ ಮಾಡಿ', 'nav.signIn': 'ಸೈನ್ ಇನ್', 'nav.createAccount': 'ಖಾತೆ ರಚಿಸಿ', 'landing.title': 'ವಿಶ್ವಾಸದಿಂದ ಬಟ್ಟೆ ಖರೀದಿಸಿ. ಭಾರತದಾದ್ಯಂತ ಮಾರಾಟ ಮಾಡಿ.', 'landing.browse': 'ಮಾರುಕಟ್ಟೆ ನೋಡಿ', 'landing.sell': 'ಮಾರಾಟ ಪ್ರಾರಂಭಿಸಿ', 'preferences.language': 'ಭಾಷೆ', 'preferences.theme': 'ಥೀಮ್', 'registration.state': 'ರಾಜ್ಯ / ಕೇಂದ್ರಾಡಳಿತ ಪ್ರದೇಶ',
  },
  ml: {
    'nav.marketplace': 'മാർക്കറ്റ്‌പ്ലേസ്', 'nav.aiTools': 'AI ഉപകരണങ്ങൾ', 'nav.sell': 'FabricTrad-ൽ വിൽക്കുക', 'nav.signIn': 'സൈൻ ഇൻ', 'nav.createAccount': 'അക്കൗണ്ട് സൃഷ്ടിക്കുക', 'landing.title': 'വിശ്വാസത്തോടെ തുണിത്തരങ്ങൾ വാങ്ങുക. ഇന്ത്യയിലുടനീളം വിൽക്കുക.', 'landing.browse': 'മാർക്കറ്റ്‌പ്ലേസ് കാണുക', 'landing.sell': 'വിൽപ്പന ആരംഭിക്കുക', 'preferences.language': 'ഭാഷ', 'preferences.theme': 'തീം', 'registration.state': 'സംസ്ഥാനം / കേന്ദ്രഭരണ പ്രദേശം',
  },
  pa: {
    'nav.marketplace': 'ਮਾਰਕੀਟਪਲੇਸ', 'nav.aiTools': 'AI ਟੂਲ', 'nav.sell': 'FabricTrad ਉੱਤੇ ਵੇਚੋ', 'nav.signIn': 'ਸਾਈਨ ਇਨ', 'nav.createAccount': 'ਖਾਤਾ ਬਣਾਓ', 'landing.title': 'ਭਰੋਸੇ ਨਾਲ ਕੱਪੜਾ ਖਰੀਦੋ। ਪੂਰੇ ਭਾਰਤ ਵਿੱਚ ਵੇਚੋ।', 'landing.browse': 'ਮਾਰਕੀਟਪਲੇਸ ਵੇਖੋ', 'landing.sell': 'ਵੇਚਣਾ ਸ਼ੁਰੂ ਕਰੋ', 'preferences.language': 'ਭਾਸ਼ਾ', 'preferences.theme': 'ਥੀਮ', 'registration.state': 'ਰਾਜ / ਕੇਂਦਰ ਸ਼ਾਸਿਤ ਪ੍ਰਦੇਸ਼',
  },
};

export function translate(language: SupportedLanguageCode, key: TranslationKey): string {
  return dictionaries[language]?.[key] || en[key];
}
