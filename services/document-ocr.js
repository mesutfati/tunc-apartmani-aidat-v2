const nativePlugin = name => globalThis.Capacitor?.Plugins?.[name] || null;

const normalizeText = value => String(value || '').replace(/\s+/g, ' ').trim();
const toIsoDate = value => {
  const match = String(value || '').match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (!match) return '';
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};
const unique = values => [...new Set(values.filter(Boolean))];

function parseDocumentText(rawText = '', type = 'insurance') {
  const text = normalizeText(rawText);
  const lines = String(rawText || '').split(/\r?\n/).map(normalizeText).filter(Boolean);
  const dates = unique([...text.matchAll(/\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/g)].map(match => toIsoDate(match[0])));
  const phones = unique([...text.matchAll(/\b(?:\+90|0)?\s*(?:5\d{2}|850)[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g)].map(match => normalizeText(match[0])));
  const plates = unique([...text.matchAll(/\b\d{2}\s?[A-ZÇĞİÖŞÜ]{1,3}\s?\d{2,4}\b/gi)].map(match => normalizeText(match[0]).toLocaleUpperCase('tr-TR')));
  const policyMatch = text.match(/(?:poli[cç]e|pol[iı]çe|poli[cç]e\s*no|s[oö]zle[sş]me\s*no)\s*[:#№-]?\s*([A-Z0-9][A-Z0-9./-]{4,})/i);
  const knownProviders = ['Allianz','Aksigorta','Anadolu Sigorta','Mapfre','Türkiye Sigorta','Sompo','Ray Sigorta','HDI','Quick Sigorta','Doğa Sigorta','Neova','Generali','Bereket','Corpus','Zurich','Koru'];
  const provider = knownProviders.find(name => new RegExp(name.replace(' ', '\\s+'), 'i').test(text)) || lines.find(line => /sigorta|insurance/i.test(line) && line.length < 80) || '';
  const result = {
    rawText: text,
    provider: normalizeText(provider.replace(/^(sigorta|insurance)\s*[:.-]?\s*/i, '')),
    policyNo: policyMatch?.[1] || '',
    startDate: dates[0] || '',
    expiry: dates[1] || dates[0] || '',
    assistancePhone: phones[0] || '',
    plate: plates[0] || '',
  };
  if (type === 'accident') {
    result.otherPlate = plates[1] || '';
    result.otherPhone = phones[0] || '';
    result.insuranceCompany = result.provider;
    result.title = 'OCR ile oluşturulan kaza tutanağı taslağı';
    result.locationText = '';
    result.note = text ? `Belge OCR metni: ${text}` : '';
  }
  return result;
}

function browserCapture() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { reject(new Error('Belge fotoğrafı seçilmedi.')); return; }
      resolve({ ok:true, native:false, ocr:false, imageName:file.name, parsed:{}, rawText:'', message:'Belge fotoğrafı alındı. Gerçek cihaz içi OCR APK içinde çalışır.' });
    };
    input.click();
  });
}

export async function readDocument(type = 'insurance') {
  const camera = nativePlugin('Camera');
  const ocr = nativePlugin('Vision');
  if (!camera || !globalThis.Capacitor?.isNativePlatform?.()) return browserCapture();
  try {
    let imageUri = '';
    let imageUris = [];
    let scanMode = 'camera';
    let pageCount = 1;
    if (ocr?.scanDocument) {
      try {
        const scanned = await ocr.scanDocument({ pageLimit:type === 'accident' ? 2 : 1 });
        imageUri = scanned?.imageUri || '';
        imageUris = Array.isArray(scanned?.imageUris) ? scanned.imageUris.filter(Boolean) : (imageUri ? [imageUri] : []);
        pageCount = Number(scanned?.pageCount) || 1;
        scanMode = scanned?.scanMode || 'document';
      } catch (scannerError) {
        if (/iptal|cancel/i.test(scannerError?.message || '')) return { ok:false, native:true, cancelled:true, message:'Belge taraması iptal edildi.' };
        // Google Play Services veya cihaz desteklemiyorsa standart kameraya düş.
      }
    }
    if (!imageUri) {
      const photo = await camera.getPhoto({ quality:95, allowEditing:false, resultType:'uri', source:'CAMERA', promptLabelHeader:'Belgenin tamamını düz kadraja alın', promptLabelPhoto:'Galeriden seç', promptLabelPicture:'Fotoğraf çek', correctOrientation:true, saveToGallery:false });
      imageUri = photo?.path || photo?.webPath;
      imageUris = imageUri ? [imageUri] : [];
      scanMode = 'camera';
    }
    if (!imageUri) throw new Error('Kamera fotoğraf yolu döndürmedi.');
    if (!ocr?.detectText) return { ok:true, native:true, ocr:false, imageUri, scanMode, pageCount, parsed:{}, rawText:'', message:'Belge görüntüsü alındı. OCR servisi kullanılamadı; alanları formda elle tamamlayın.' };
    try {
      const pages = imageUris.length ? imageUris : [imageUri];
      const texts = [];
      let passes = 0;
      let enhanced = false;
      for (const pageUri of pages) {
        const result = await ocr.detectText({ filename:pageUri, orientation:'UP' });
        const pageText = result?.text || (result?.textDetections || []).map(item => item.text).join('\n');
        if (pageText) texts.push(pageText);
        passes += Number(result?.passes) || 1;
        enhanced = enhanced || result?.enhanced === true;
      }
      const rawText = texts.join('\n\n');
      return { ok:true, native:true, ocr:true, imageUri, imageUris:pages, scanMode, pageCount:pages.length, passes, enhanced, parsed:parseDocumentText(rawText, type), rawText, message:scanMode === 'document' ? `Belge tarandı, perspektif düzeltildi ve ${pages.length} sayfa iki OCR geçişiyle okundu.` : 'Belge metni iki OCR geçişiyle cihazda okundu.' };
    } catch (ocrError) {
      return { ok:true, native:true, ocr:false, imageUri, scanMode, pageCount, parsed:{}, rawText:'', message:`Belge görüntüsü alındı; OCR çalışmadı. Alanları formda elle tamamlayın. (${ocrError?.message || 'OCR hatası'})` };
    }
  } catch (error) {
    return { ok:false, native:true, ocr:false, parsed:{}, message:error?.message || 'Kamera/OCR işlemi tamamlanamadı.' };
  }
}

export { parseDocumentText };
