import { readFile, writeFile } from 'node:fs/promises';

async function replace(path, before, after) {
  const source = await readFile(path, 'utf8');
  if (!source.includes(before)) throw new Error(`Expected block not found in ${path}`);
  await writeFile(path, source.replace(before, after));
}

await replace(
  'src/app/seller-dashboard/components/SellerCatalogAssistant.tsx',
`      if (!response.ok || !payload.draft) throw new Error(payload.error || 'Unable to organise the catalogue.');

      setDraft(payload.draft);
      setProvider(payload.provider || 'rules');
      setMessages((current) => [
        ...current,
        {
          id: \`assistant-\${Date.now()}\`,
          role: 'assistant',
          text: \`\${payload.message || 'Catalogue organised.'} I found \${payload.draft.variants.length || 1} variation\${payload.draft.variants.length === 1 ? '' : 's'}. Attach media, choose its colour/view, and review before saving.\`,
        },
      ]);`,
`      if (!response.ok || !payload.draft) throw new Error(payload.error || 'Unable to organise the catalogue.');
      const organisedDraft = payload.draft;

      setDraft(organisedDraft);
      setProvider(payload.provider || 'rules');
      setMessages((current) => [
        ...current,
        {
          id: \`assistant-\${Date.now()}\`,
          role: 'assistant',
          text: \`\${payload.message || 'Catalogue organised.'} I found \${organisedDraft.variants.length || 1} variation\${organisedDraft.variants.length === 1 ? '' : 's'}. Attach media, choose its colour/view, and review before saving.\`,
        },
      ]);`
);

await replace(
  'src/app/seller-dashboard/components/SellerCatalogAssistant.tsx',
`            payload.draft?.variants.some(
              (variant) => catalogVariantKey(variant.colorName, variant.designName) === attachment.targetKey
            )`,
`            organisedDraft.variants.some(
              (variant) => catalogVariantKey(variant.colorName, variant.designName) === attachment.targetKey
            )`
);

await replace(
  'src/lib/catalogAssistant.ts',
`  const variants: ParsedCatalogVariant[] = variantsRaw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Record<string, unknown>;
      const colorName = String(item.colorName || '').trim();
      const variantPrice = Number(item.pricePerUnit || price);
      if (!colorName || !Number.isFinite(variantPrice) || variantPrice <= 0) return null;
      return {
        colorName: titleCase(colorName),
        colorHex: normalizeHex(item.colorHex ? String(item.colorHex) : null),
        designName: titleCase(String(item.designName || raw.workType || 'Standard')),
        description: String(item.description || '').trim().slice(0, 1000),
        pricePerUnit: variantPrice,
        unit: inferCatalogUnit(String(item.unit || raw.unit || 'mtr')),
        availableQuantity: Math.max(0, Number(item.availableQuantity || 0)),
        moq: Math.max(0.01, Number(item.moq || raw.moq || 1)),
        mediaLabel: String(item.mediaLabel || colorName),
      } satisfies ParsedCatalogVariant;
    })
    .filter((item): item is ParsedCatalogVariant => Boolean(item));`,
`  const variants = variantsRaw.reduce<ParsedCatalogVariant[]>((result, entry) => {
    if (!entry || typeof entry !== 'object') return result;
    const item = entry as Record<string, unknown>;
    const colorName = String(item.colorName || '').trim();
    const variantPrice = Number(item.pricePerUnit || price);
    if (!colorName || !Number.isFinite(variantPrice) || variantPrice <= 0) return result;
    result.push({
      colorName: titleCase(colorName),
      colorHex: normalizeHex(item.colorHex ? String(item.colorHex) : null),
      designName: titleCase(String(item.designName || raw.workType || 'Standard')),
      description: String(item.description || '').trim().slice(0, 1000),
      pricePerUnit: variantPrice,
      unit: inferCatalogUnit(String(item.unit || raw.unit || 'mtr')),
      availableQuantity: Math.max(0, Number(item.availableQuantity || 0)),
      moq: Math.max(0.01, Number(item.moq || raw.moq || 1)),
      mediaLabel: item.mediaLabel ? String(item.mediaLabel) : colorName,
    });
    return result;
  }, []);`
);

console.log('Catalog overhaul TypeScript fixes applied.');
