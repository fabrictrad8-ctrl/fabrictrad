from pathlib import Path
import re


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:160]!r}')
    p.write_text(text.replace(old, new, 1))


def regex_once(path: str, pattern: str, replacement: str):
    p = Path(path)
    text = p.read_text()
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'Expected one regex match in {path}; got {count}: {pattern[:140]}')
    p.write_text(next_text)


# 1) Webhook: seller WhatsApp identity gets routing priority, strict catalogue engine owns seller ingestion.
webhook = 'src/app/api/integrations/whatsapp/webhook/route.ts'
replace_once(
    webhook,
    "import { parseCatalogMessage } from '@/lib/catalogAssistant';\n",
    "import { tryHandleSellerCatalogMessage } from '@/lib/whatsappSellerCatalog';\n",
)
replace_once(
    webhook,
    "import {\n  downloadGupshupMedia,\n  FABRICTRAD_GUPSHUP_APP_NAME,\n  sendGupshupText,\n} from '@/lib/gupshupWhatsApp';",
    "import { FABRICTRAD_GUPSHUP_APP_NAME, sendGupshupText } from '@/lib/gupshupWhatsApp';",
)
replace_once(
    webhook,
    "const MAX_MEDIA_BYTES = 50 * 1024 * 1024;\nconst MEDIA_BUCKET = 'seller-whatsapp-inbox';\n",
    "",
)
regex_once(
    webhook,
    r"const extensionFor = \(mime: string\) => \{.*?\n\};\n\nasync function acknowledgeSeller",
    "async function acknowledgeSeller",
)
regex_once(
    webhook,
    r"async function ingestSellerMessage\(message: WhatsAppMessage\) \{.*?\n\}\n\nasync function processMessage\(message: WhatsAppMessage\) \{.*?\n\}",
    """async function ingestSellerMessage(message: WhatsAppMessage): Promise<boolean> {
  const media = extractMedia(message);
  const result = await tryHandleSellerCatalogMessage({
    id: String(message.id || '').trim(),
    from: String(message.from || '').trim(),
    appName: message.appName || null,
    type: String(message.type || 'unknown'),
    text: extractText(message),
    mediaUrl: media?.id || null,
    mediaMimeType: media?.mime || null,
  });
  return result.handled;
}

async function processMessage(message: WhatsAppMessage) {
  // Exact seller WhatsApp identity wins before buyer automation. This prevents a
  // dual-workspace account from having catalogue uploads consumed as buyer chat.
  const sellerHandled = await ingestSellerMessage(message);
  if (sellerHandled) return;
  await handleBuyerWhatsAppMessage(message);
}""",
)

# 2) Seller onboarding: collect a dedicated seller identity, separate from buyer/account identity.
form_path = 'src/app/seller-registration/components/SellerRegistrationFlowV2.tsx'
replace_once(
    form_path,
    "  phone: string;\n  password: string;",
    "  phone: string;\n  sellerContactName: string;\n  sellerContactEmail: string;\n  sellerPhone: string;\n  sellerWhatsapp: string;\n  password: string;",
)
replace_once(
    form_path,
    "  phone: '',\n  password: '',",
    "  phone: '',\n  sellerContactName: '',\n  sellerContactEmail: '',\n  sellerPhone: '',\n  sellerWhatsapp: '',\n  password: '',",
)
replace_once(
    form_path,
    "        phone: form.phone,\n        businessName: form.businessName,",
    "        phone: form.phone,\n        sellerContactName: form.sellerContactName,\n        sellerContactEmail: form.sellerContactEmail,\n        sellerPhone: form.sellerPhone,\n        sellerWhatsapp: form.sellerWhatsapp,\n        businessName: form.businessName,",
)
replace_once(
    form_path,
    "        phone: normalizeIndianPhone(source.phone),\n        businessName: source.businessName,",
    "        phone: normalizeIndianPhone(source.phone),\n        sellerContactName: source.sellerContactName.trim(),\n        sellerContactEmail: normalizeEmail(source.sellerContactEmail),\n        sellerPhone: normalizeIndianPhone(source.sellerPhone),\n        sellerWhatsapp: normalizeIndianPhone(source.sellerWhatsapp),\n        businessName: source.businessName,",
)
replace_once(
    form_path,
    "    if (!form.businessType) return setError('Select the business type before continuing.');",
    """    if (!form.businessType) return setError('Select the business type before continuing.');
    const sellerContactName = form.sellerContactName.trim();
    const sellerContactEmail = normalizeEmail(form.sellerContactEmail);
    const sellerPhone = normalizeIndianPhone(form.sellerPhone);
    const sellerWhatsapp = normalizeIndianPhone(form.sellerWhatsapp);
    if (!sellerContactName) return setError('Enter the seller contact/display name.');
    if (!sellerContactEmail) return setError('Enter a valid seller contact email.');
    const sellerPhoneCheck = validateIndianPhone(sellerPhone);
    if (!sellerPhoneCheck.valid) return setError(`Seller phone: ${sellerPhoneCheck.message}`);
    const sellerWhatsappCheck = validateIndianPhone(sellerWhatsapp);
    if (!sellerWhatsappCheck.valid) return setError(`Seller WhatsApp: ${sellerWhatsappCheck.message}`);
    const buyerAccountName = form.ownerName.trim().toLowerCase();
    const buyerAccountEmail = normalizeEmail(form.email);
    const buyerAccountPhone = normalizeIndianPhone(form.phone);
    if (sellerContactName.toLowerCase() === buyerAccountName) return setError('Seller name cannot be the same as the buyer/account name. Use a different seller contact/display name.');
    if (sellerContactEmail === buyerAccountEmail) return setError('Seller email cannot be the same as the buyer/account email. Use a different seller email.');
    if (sellerPhone === buyerAccountPhone) return setError('Seller phone cannot be the same as the buyer/account phone. Use a different seller phone.');
    if (sellerWhatsapp === buyerAccountPhone) return setError('Seller WhatsApp cannot be the same as the buyer/account phone/WhatsApp. Use a different seller WhatsApp number.');
    setForm((current) => ({ ...current, sellerContactName, sellerContactEmail, sellerPhone, sellerWhatsapp }));""",
)
replace_once(
    form_path,
    "              <div className=\"grid gap-4 sm:grid-cols-2\"><label className=\"text-sm font-700 text-foreground\">Legal business name *<input value={form.businessName} onChange={(event) => update('businessName', event.target.value)} className=\"input-base mt-1.5 w-full px-4 py-3 font-400\" required /></label><label className=\"text-sm font-700 text-foreground\">Business type *<select value={form.businessType} onChange={(event) => update('businessType', event.target.value)} className=\"input-base mt-1.5 w-full px-3 py-3 font-400\" required><option value=\"\">Select business type</option>{businessTypes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>",
    """              <div className=\"grid gap-4 sm:grid-cols-2\"><label className=\"text-sm font-700 text-foreground\">Legal business name *<input value={form.businessName} onChange={(event) => update('businessName', event.target.value)} className=\"input-base mt-1.5 w-full px-4 py-3 font-400\" required /></label><label className=\"text-sm font-700 text-foreground\">Business type *<select value={form.businessType} onChange={(event) => update('businessType', event.target.value)} className=\"input-base mt-1.5 w-full px-3 py-3 font-400\" required><option value=\"\">Select business type</option>{businessTypes.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>
              <div className=\"rounded-2xl border border-teal-200 bg-teal-50/50 p-4\">
                <p className=\"text-sm font-800 text-teal-950\">Seller contact & WhatsApp identity *</p>
                <p className=\"mt-1 text-xs leading-5 text-teal-800\">These seller details must be different from the buyer/account name, email and phone. Only the WhatsApp number saved here can add products to this seller store.</p>
                <div className=\"mt-4 grid gap-4 sm:grid-cols-2\">
                  <label className=\"text-sm font-700 text-foreground\">Seller contact/display name *<input value={form.sellerContactName} onChange={(event) => update('sellerContactName', event.target.value)} className=\"input-base mt-1.5 w-full px-4 py-3 font-400\" placeholder=\"e.g. FabricTrad Surat Sales\" /></label>
                  <label className=\"text-sm font-700 text-foreground\">Seller email *<input type=\"email\" value={form.sellerContactEmail} onChange={(event) => update('sellerContactEmail', event.target.value)} className=\"input-base mt-1.5 w-full px-4 py-3 font-400\" placeholder=\"sales@yourbusiness.com\" /></label>
                  <label className=\"text-sm font-700 text-foreground\">Seller phone *<input value={form.sellerPhone} onChange={(event) => update('sellerPhone', event.target.value.replace(/\\D/g, '').slice(0, 10))} className=\"input-base mt-1.5 w-full px-4 py-3 font-mono font-400\" inputMode=\"numeric\" placeholder=\"10 digit seller phone\" /></label>
                  <label className=\"text-sm font-700 text-foreground\">Seller WhatsApp *<input value={form.sellerWhatsapp} onChange={(event) => update('sellerWhatsapp', event.target.value.replace(/\\D/g, '').slice(0, 10))} className=\"input-base mt-1.5 w-full px-4 py-3 font-mono font-400\" inputMode=\"numeric\" placeholder=\"WhatsApp used for catalogue uploads\" /></label>
                </div>
              </div>""",
)

# 3) Seller enable API: server-side identity checks + persistence.
api_path = 'src/app/api/account/enable-selling/route.ts'
replace_once(
    api_path,
    "  pan: string | null;\n};",
    "  pan: string | null;\n  contact_name: string | null;\n  contact_email: string | null;\n  contact_phone: string | null;\n  whatsapp_no: string | null;\n};",
)
replace_once(
    api_path,
    "  if (userError || !user) return json({ error: 'Sign in to continue the seller application.' }, 401);",
    "  if (userError || !user) return json({ error: 'Sign in to continue the seller application.' }, 401);\n  const admin = createAdminClient();",
)
replace_once(
    api_path,
    ".select('id,legal_business_name,display_name,business_type,gstin,pan')",
    ".select('id,legal_business_name,display_name,business_type,gstin,pan,contact_name,contact_email,contact_phone,whatsapp_no')",
)
replace_once(
    api_path,
    "  if (!businessName || !ownerName || !/^[6-9]\\d{9}$/.test(phone)) {",
    """  const sellerContactName = clean(input.sellerContactName, 160) || clean(existingSeller?.contact_name, 160);
  const sellerContactEmail = (clean(input.sellerContactEmail, 320) || clean(existingSeller?.contact_email, 320)).toLowerCase();
  const sellerPhone = digits(input.sellerPhone, 32).slice(-10) || digits(existingSeller?.contact_phone, 32).slice(-10);
  const sellerWhatsapp = digits(input.sellerWhatsapp, 32).slice(-10) || digits(existingSeller?.whatsapp_no, 32).slice(-10);

  if (!businessName || !ownerName || !/^[6-9]\\d{9}$/.test(phone)) {""",
)
replace_once(
    api_path,
    "  let existingBank: ExistingBank | null = null;",
    """  if (!sellerContactName) return json({ error: 'Enter a seller contact/display name.' }, 400);
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(sellerContactEmail)) return json({ error: 'Enter a valid seller email address.' }, 400);
  if (!/^[6-9]\\d{9}$/.test(sellerPhone)) return json({ error: 'Enter a valid 10 digit seller phone number.' }, 400);
  if (!/^[6-9]\\d{9}$/.test(sellerWhatsapp)) return json({ error: 'Enter a valid 10 digit seller WhatsApp number.' }, 400);

  const accountName = clean(existingProfile?.full_name, 160).toLowerCase();
  const accountEmail = String(user.email || '').trim().toLowerCase();
  const accountPhone = digits(existingProfile?.phone, 32).slice(-10);
  if (sellerContactName.toLowerCase() === accountName) return json({ error: 'Seller name cannot be the same as the buyer/account name. Use a different seller contact/display name.' }, 409);
  if (sellerContactEmail === accountEmail) return json({ error: 'Seller email cannot be the same as the buyer/account email. Use a different seller email.' }, 409);
  if (sellerPhone === accountPhone) return json({ error: 'Seller phone cannot be the same as the buyer/account phone. Use a different seller phone.' }, 409);
  if (sellerWhatsapp === accountPhone) return json({ error: 'Seller WhatsApp cannot be the same as the buyer/account phone/WhatsApp. Use a different seller WhatsApp number.' }, 409);

  const { data: identityConflicts, error: identityConflictError } = await admin.rpc('seller_identity_conflicts', {
    p_contact_name: sellerContactName,
    p_contact_email: sellerContactEmail,
    p_contact_phone: sellerPhone,
    p_whatsapp_no: sellerWhatsapp,
  });
  if (identityConflictError) return json({ error: 'Seller identity could not be checked. Please retry.' }, 500);
  const conflictFields = Array.isArray(identityConflicts) ? identityConflicts.map(String) : [];
  if (conflictFields.length) {
    return json({
      error: `Seller ${conflictFields.join(', ')} already matches a buyer identity. Change ${conflictFields.length === 1 ? 'it' : 'those fields'} before continuing.`,
      conflicts: conflictFields,
    }, 409);
  }

  let existingBank: ExistingBank | null = null;""",
)
replace_once(
    api_path,
    "  const admin = createAdminClient();\n\n  const bankWasChanged",
    """  const { error: sellerContactSaveError } = await admin
    .from('seller_profiles')
    .update({
      contact_name: sellerContactName,
      contact_email: sellerContactEmail,
      contact_phone: sellerPhone,
      whatsapp_no: sellerWhatsapp,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sellerProfileId);
  if (sellerContactSaveError) {
    const detail = String(sellerContactSaveError.message || '');
    const conflict = detail.includes('IDENTITY_CONFLICT') || detail.includes('duplicate key');
    return json({ error: conflict
      ? 'Seller name, email, phone or WhatsApp conflicts with an existing buyer/seller identity. Change the conflicting value and retry.'
      : 'Seller contact and WhatsApp identity could not be saved.' }, conflict ? 409 : 500);
  }

  const bankWasChanged""",
)

# 4) Always return the exact predefined format on incomplete/media flows.
module_path = 'src/lib/whatsappSellerCatalog.ts'
replace_once(
    module_path,
    "    `Saved image/video ${nextQueue.length}. Now send this product's details using the FabricTrad format. Send FORMAT anytime to see the template.`,",
    "    `Saved image/video ${nextQueue.length}. Now send this product's details using the FabricTrad format.\\n\\n${SELLER_CATALOG_FORMAT_MESSAGE}` ,",
)
replace_once(
    module_path,
    "      'Nothing was added yet. Send the missing/corrected fields, or send FORMAT for the full template.',",
    "      `Nothing was added yet. Send the missing/corrected fields using this template:\\n\\n${SELLER_CATALOG_FORMAT_MESSAGE}` ,",
)

print('Seller WhatsApp catalogue patch applied.')
