from pathlib import Path

path = Path('src/lib/whatsappSellerCatalog.ts')
text = path.read_text()
old = "onConflict: 'seller_id,storage_path'"
new = "onConflict: 'storage_path'"
if old not in text:
    raise SystemExit('Expected seller media onConflict target was not found.')
path.write_text(text.replace(old, new, 1))
print('Seller WhatsApp media upsert now matches seller_product_media_storage_path_key.')
