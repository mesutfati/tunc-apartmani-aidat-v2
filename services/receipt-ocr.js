const nativePlugin = name => globalThis.Capacitor?.Plugins?.[name] || null;

function parseReceiptText(rawText = '') {
  const text = String(rawText).replace(/\s+/g, ' ').trim();
  const lowerText = text.toLocaleLowerCase('tr-TR');
  const moneyMatches = [...text.matchAll(/(\d{1,3}(?:\.\d{3})+,\d{2}|\d+(?:[.,]\d{2}))\s*(?:TL|₺)?/gi)].map(m => Number(m[1].replace(/\./g, '').replace(',', '.'))).filter(n => n > 1);
  const literMatch = text.match(/(\d+[.,]\d{2,3})\s*(?:lt|l|litre)/i);
  const plateMatch = text.match(/\b\d{2}\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,4}\b/i);
  const fuel = /motorin|diesel|mazot/.test(lowerText) ? 'Motorin' : /lpg|otogaz/.test(lowerText) ? 'LPG' : 'Benzin';
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
  if (!camera || !globalThis.Capacitor?.isNativePlatform?.()) return browserCapture();
  try {
    const photo = await camera.getPhoto({ quality:86, allowEditing:false, resultType:'uri', source:'CAMERA', promptLabelHeader:'Fiş fotoğrafı', promptLabelPhoto:'Galeriden seç', promptLabelPicture:'Fotoğraf çek', correctOrientation:true, saveToGallery:false });
    const imageUri = photo?.path || photo?.webPath;
    if (!imageUri) throw new Error('Kamera fotoğraf yolu döndürmedi.');
    if (!ocr?.detectText || !photo.path) return { ok:true, native:true, ocr:false, imageUri, parsed:{}, rawText:'', message:'Fiş fotoğrafı alındı. OCR servisi kullanılamadı; bilgileri formda elle kontrol edin.' };
    try {
      const result = await ocr.detectText({ filename:photo.path, orientation:'UP' });
      const rawText = (result?.textDetections || []).map(item => item.text).join('\n');
      return { ok:true, native:true, ocr:true, imageUri, parsed:parseReceiptText(rawText), rawText, message:'Fiş metni cihazda OCR ile okundu.' };
    } catch (ocrError) {
      return { ok:true, native:true, ocr:false, imageUri, parsed:{}, rawText:'', message:`Fiş fotoğrafı alındı; OCR çalışmadı. Bilgileri elle kontrol edin. (${ocrError?.message || 'OCR hatası'})` };
    }
  } catch (error) {
    return { ok:false, native:true, ocr:false, message:error?.message || 'Kamera/OCR işlemi tamamlanamadı.' };
  }
}

export { parseReceiptText };
