const nativePlugin = name => globalThis.Capacitor?.Plugins?.[name] || null;

function parseReceiptText(rawText = '') {
  const text = String(rawText).replace(/\s+/g, ' ').trim();
  const moneyMatches = [...text.matchAll(/(\d{1,4}[.,]\d{2})\s*(?:TL|₺)?/gi)].map(m => Number(m[1].replace('.', '').replace(',', '.'))).filter(n => n > 1);
  const literMatch = text.match(/(\d+[.,]\d{2,3})\s*(?:lt|l|litre)/i);
  const plateMatch = text.match(/\b\d{2}\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,4}\b/i);
  const fuel = /motorin|diesel|mazot/i.test(text) ? 'Motorin' : /lpg|otogaz/i.test(text) ? 'LPG' : 'Benzin';
  return { rawText:text, amount:moneyMatches.length ? Math.max(...moneyMatches) : null, liters:literMatch ? Number(literMatch[1].replace(',', '.')) : null, plate:plateMatch?.[0] || '', fuel };
}

function browserCapture() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input'); input.type='file'; input.accept='image/*'; input.capture='environment';
    input.onchange = () => { const file=input.files?.[0]; if(!file){ reject(new Error('Fiş fotoğrafı seçilmedi.')); return; } const url=URL.createObjectURL(file); resolve({ ok:true, native:false, imageUri:url, imageName:file.name, ocr:false, parsed:parseReceiptText(file.name), message:'Fotoğraf alındı. Gerçek OCR Android APK içindeki cihaz içi ML Kit ile çalışır.' }); };
    input.click();
  });
}

export async function readReceipt() {
  const camera = nativePlugin('Camera');
  const ocr = nativePlugin('CapacitorOcr');
  if (!camera || !ocr || !globalThis.Capacitor?.isNativePlatform?.()) return browserCapture();
  try {
    const photo = await camera.getPhoto({ quality:86, allowEditing:false, resultType:'uri', source:'camera', correctOrientation:true, saveToGallery:false });
    if (!photo?.path) throw new Error('Kamera fotoğraf yolu döndürmedi.');
    const result = await ocr.detectText({ filename:photo.path, orientation:'UP' });
    const rawText = (result?.textDetections || []).map(item => item.text).join('\n');
    return { ok:true, native:true, ocr:true, imageUri:photo.path, parsed:parseReceiptText(rawText), message:'Fiş metni cihazda OCR ile okundu.' };
  } catch (error) {
    return { ok:false, native:true, ocr:false, message:error?.message || 'Kamera/OCR işlemi tamamlanamadı.' };
  }
}

export { parseReceiptText };
