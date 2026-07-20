export const INDIAN_STATES_AND_UTS = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', locale: 'en-IN' },
  { code: 'hi', label: 'हिन्दी', locale: 'hi-IN' },
  { code: 'bn', label: 'বাংলা', locale: 'bn-IN' },
  { code: 'gu', label: 'ગુજરાતી', locale: 'gu-IN' },
  { code: 'kn', label: 'ಕನ್ನಡ', locale: 'kn-IN' },
  { code: 'ml', label: 'മലയാളം', locale: 'ml-IN' },
  { code: 'mr', label: 'मराठी', locale: 'mr-IN' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', locale: 'pa-IN' },
  { code: 'ta', label: 'தமிழ்', locale: 'ta-IN' },
  { code: 'te', label: 'తెలుగు', locale: 'te-IN' },
] as const;

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export function getLanguageLocale(code?: string | null) {
  return SUPPORTED_LANGUAGES.find((language) => language.code === code)?.locale || 'en-IN';
}
