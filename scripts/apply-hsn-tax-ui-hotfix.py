from pathlib import Path


def replace_exact(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


def replace_all_exact(path: str, old: str, new: str, expected: int) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(
            f"{path}: expected {expected} matches, found {count}: {old[:100]!r}"
        )
    p.write_text(text.replace(old, new))


product = "src/app/product-detail/components/ProductInfoV2.tsx"
replace_exact(
    product,
    "import { useProduct } from '@/lib/hooks/useProduct';\n",
    "import { useProduct } from '@/lib/hooks/useProduct';\n"
    "import { describeHsn, indiaGstRuleText, resolveIndiaGstRate } from '@/lib/indiaTax';\n",
)
replace_exact(
    product,
    "  const gstRate = Number(\n"
    "    effective?.gst_rate ?? productPolicy?.gst_rate ?? (product.gst === false ? 0 : 5)\n"
    "  );\n",
    "  const hsnCode = productPolicy?.hsn_code || '';\n"
    "  const storedGstRate = Number(\n"
    "    effective?.gst_rate ?? productPolicy?.gst_rate ?? (product.gst === false ? 0 : 5)\n"
    "  );\n"
    "  const gstRate = resolveIndiaGstRate({ hsnCode, unitPrice: price, storedRate: storedGstRate });\n"
    "  const hsnDescription = describeHsn(hsnCode);\n"
    "  const gstRuleText = indiaGstRuleText(hsnCode, price);\n",
)
replace_exact(
    product,
    "<p className=\"mt-1 font-800 text-foreground\">{effective?.gtin || 'Not assigned'}</p>",
    "<p className=\"mt-1 font-800 text-foreground\">{effective?.gtin || 'Not provided'}</p>",
)
replace_exact(
    product,
    "              {productPolicy?.hsn_code || 'HSN pending'} · {gstRate}% GST\n",
    "              {hsnCode ? `HSN ${hsnCode}` : 'HSN required'} · {gstRate}% GST\n",
)
replace_exact(
    product,
    "            <p className=\"mt-1 text-[10px] text-muted-foreground\">\n"
    "              {priceIncludesGst ? 'Included in displayed price' : 'Added to displayed price'}\n"
    "            </p>\n",
    "            {hsnDescription && (\n"
    "              <p className=\"mt-1 text-[10px] leading-4 text-muted-foreground\">{hsnDescription}</p>\n"
    "            )}\n"
    "            {gstRuleText && (\n"
    "              <p className=\"mt-1 text-[10px] leading-4 text-muted-foreground\">{gstRuleText}</p>\n"
    "            )}\n"
    "            <p className=\"mt-1 text-[10px] text-muted-foreground\">\n"
    "              {priceIncludesGst ? 'Included in displayed price' : 'Added to displayed price'}\n"
    "            </p>\n",
)

rules = "src/app/seller-product-rules/page.tsx"
replace_exact(
    rules,
    "import { normalizeGtin, validateGtin } from '@/lib/commerceIdentifiers';\n",
    "import { normalizeGtin, validateGtin } from '@/lib/commerceIdentifiers';\n"
    "import { describeHsn, normalizeHsn, resolveIndiaGstRate, validateHsn } from '@/lib/indiaTax';\n",
)
replace_all_exact(
    rules,
    "  available_quantity: number;\n  gtin: string | null;\n",
    "  available_quantity: number;\n  price_per_unit: number;\n  gtin: string | null;\n",
    2,
)
replace_exact(
    rules,
    "    const gtin = normalizeGtin(form.gtin);\n"
    "    if (gtin && !validateGtin(gtin)) return toast.error('The GTIN check digit is invalid.');\n",
    "    const gtin = normalizeGtin(form.gtin);\n"
    "    if (gtin && !validateGtin(gtin)) return toast.error('The GTIN check digit is invalid.');\n"
    "    const hsn = normalizeHsn(form.hsnCode);\n"
    "    if (!selectedVariant && !validateHsn(hsn)) {\n"
    "      return toast.error('Enter a valid 4, 6 or 8 digit HSN before publishing this product.');\n"
    "    }\n"
    "    const taxUnitPrice = Number(selectedVariant?.price_per_unit ?? selectedProduct.price_per_unit ?? 0);\n"
    "    const resolvedGstRate = resolveIndiaGstRate({\n"
    "      hsnCode: hsn || selectedProduct.hsn_code,\n"
    "      unitPrice: taxUnitPrice,\n"
    "      storedRate: Number(form.gstRate || 0),\n"
    "    });\n",
)
replace_exact(rules, "          hsnCode: form.hsnCode,\n", "          hsnCode: hsn,\n")
replace_exact(rules, "          gstRate: form.gstRate,\n", "          gstRate: resolvedGstRate,\n")
replace_exact(
    rules,
    "<label className=\"text-sm font-700 text-foreground\">HSN code<input value={form.hsnCode} onChange={(event) => setForm({ ...form, hsnCode: event.target.value.replace(/\\D/g, '').slice(0, 12) })} className=\"input-base mt-1.5 w-full px-4 py-3 font-mono font-400\" inputMode=\"numeric\" placeholder=\"Product-specific HSN\" /><span className=\"mt-1.5 block text-xs text-muted-foreground\">Use the correct classification for the actual textile/product.</span></label>",
    "<label className=\"text-sm font-700 text-foreground\">HSN code<input value={form.hsnCode} onChange={(event) => setForm({ ...form, hsnCode: normalizeHsn(event.target.value) })} className=\"input-base mt-1.5 w-full px-4 py-3 font-mono font-400\" inputMode=\"numeric\" maxLength={8} placeholder=\"e.g. 62032990\" /><span className={`mt-1.5 block text-xs ${!form.hsnCode || validateHsn(form.hsnCode) ? 'text-muted-foreground' : 'text-error'}`}>{!form.hsnCode ? 'Required for a live listing. Use 4, 6 or 8 digits.' : validateHsn(form.hsnCode) ? (describeHsn(form.hsnCode) || 'Valid HSN format. Confirm the classification matches the actual product.') : 'HSN must contain 4, 6 or 8 digits.'}</span></label>",
)
replace_exact(
    rules,
    "<label className=\"text-sm font-700 text-foreground\">GST rate (%)<input type=\"number\" min=\"0\" max=\"100\" step=\"0.01\" value={form.gstRate} onChange={(event) => setForm({ ...form, gstRate: event.target.value })} className=\"input-base mt-1.5 w-full px-4 py-3 font-400\" /></label>",
    "<label className=\"text-sm font-700 text-foreground\">GST rate (%)<input type=\"number\" value={resolveIndiaGstRate({ hsnCode: form.hsnCode || selectedProduct.hsn_code, unitPrice: Number(selectedVariant?.price_per_unit ?? selectedProduct.price_per_unit ?? 0), storedRate: Number(form.gstRate || 0) })} readOnly className=\"input-base mt-1.5 w-full bg-muted px-4 py-3 font-700\" /><span className=\"mt-1.5 block text-xs text-muted-foreground\">Calculated by FabricTrad from HSN and the current unit transaction value; sellers cannot zero GST by entering a buyer GSTIN.</span></label>",
)

api = "src/app/api/seller/product-rules/route.ts"
replace_exact(
    api,
    "import { normalizeGtin, validateGtin } from '@/lib/commerceIdentifiers';\n",
    "import { normalizeGtin, validateGtin } from '@/lib/commerceIdentifiers';\n"
    "import { normalizeHsn, validateHsn } from '@/lib/indiaTax';\n",
)
replace_exact(
    api,
    "'id,name,sku,status,approval_status,sale_channel,unit,moq,available_quantity,gtin,gtin_status,gtin_verified_at,hsn_code,brand_name,manufacturer_name,country_of_origin,gst_rate,price_includes_gst,retail_store_min_quantity,retail_store_max_quantity,end_user_enabled,end_user_limit_mode,end_user_min_quantity,end_user_max_quantity,updated_at'",
    "'id,name,sku,status,approval_status,sale_channel,unit,moq,available_quantity,price_per_unit,gtin,gtin_status,gtin_verified_at,hsn_code,brand_name,manufacturer_name,country_of_origin,gst_rate,price_includes_gst,retail_store_min_quantity,retail_store_max_quantity,end_user_enabled,end_user_limit_mode,end_user_min_quantity,end_user_max_quantity,updated_at'",
)
replace_exact(
    api,
    "'id,product_id,variant_code,color_name,design_name,status,unit,moq,available_quantity,gtin,gtin_status,gtin_verified_at,gst_rate,price_includes_gst,retail_store_min_quantity,retail_store_max_quantity,end_user_enabled,end_user_limit_mode,end_user_min_quantity,end_user_max_quantity,updated_at'",
    "'id,product_id,variant_code,color_name,design_name,status,unit,moq,available_quantity,price_per_unit,gtin,gtin_status,gtin_verified_at,gst_rate,price_includes_gst,retail_store_min_quantity,retail_store_max_quantity,end_user_enabled,end_user_limit_mode,end_user_min_quantity,end_user_max_quantity,updated_at'",
)
replace_exact(
    api,
    "  const productId = clean(input.productId, 64);\n"
    "  const variantId = clean(input.variantId, 64);\n"
    "  if (!productId) return json({ error: 'Choose a product.' }, 400);\n",
    "  const productId = clean(input.productId, 64);\n"
    "  const variantId = clean(input.variantId, 64);\n"
    "  if (!productId) return json({ error: 'Choose a product.' }, 400);\n"
    "  const hsnCode = normalizeHsn(input.hsnCode);\n"
    "  if (!variantId && hsnCode && !validateHsn(hsnCode)) {\n"
    "    return json({ error: 'HSN must contain 4, 6 or 8 digits.' }, 400);\n"
    "  }\n",
)
replace_exact(
    api,
    "    hsn_code: clean(input.hsnCode, 12).replace(/\\D/g, '') || null,\n",
    "    hsn_code: hsnCode || null,\n",
)

print("HSN/GST UI hotfix source patch applied.")
