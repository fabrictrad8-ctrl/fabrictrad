import { readFile, writeFile } from 'node:fs/promises';

const path = 'src/app/seller-dashboard/components/SellerCatalogAssistant.tsx';
let source = await readFile(path, 'utf8');

const beforeRef = "  const inputRef = useRef<HTMLInputElement>(null);\n";
const afterRef = "  const inputRef = useRef<HTMLInputElement>(null);\n  const attachmentUrlsRef = useRef<string[]>([]);\n";
if (!source.includes(beforeRef)) throw new Error('Input ref block not found.');
source = source.replace(beforeRef, afterRef);

const beforeEffect = `  useEffect(
    () => () => {
      attachments.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
    },
    [attachments]
  );`;
const afterEffect = `  useEffect(() => {
    attachmentUrlsRef.current = attachments.map((attachment) => attachment.previewUrl);
  }, [attachments]);

  useEffect(
    () => () => {
      attachmentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    []
  );`;
if (!source.includes(beforeEffect)) throw new Error('Attachment cleanup effect not found.');
source = source.replace(beforeEffect, afterEffect);

await writeFile(path, source);
console.log('Media preview cleanup fixed.');
