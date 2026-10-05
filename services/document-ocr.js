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
    const photo = await camera.getPhoto({ quality:88, allowEditing:false, resultType:'uri', source:'CAMERA', promptLabelHeader:'Belge fotoğrafı', promptLabelPhoto:'Galeriden seç', promptLabelPicture:'Fotoğraf çek', correctOrientation:true, saveToGallery:false });
    const imageUri = photo?.path || photo?.webPath;
    if (!imageUri) throw new Error('Kamera fotoğraf yolu döndürmedi.');
    if (!ocr?.detectText || !photo.path) return { ok:true, native:true, ocr:false, imageUri, parsed:{}, rawText:'', message:'Belge fotoğrafı alındı. OCR servisi kullanılamadı; alanları formda elle tamamlayın.' };
    try {
      const result = await ocr.detectText({ filename:imageUri, orientation:'UP' });
      const rawText = result?.text || (result?.textDetections || []).map(item => item.text).join('\n');
      return { ok:true, native:true, ocr:true, imageUri, parsed:parseDocumentText(rawText, type), rawText, message:'Belge metni cihazda OCR ile okundu.' };
    } catch (ocrError) {
      return { ok:true, native:true, ocr:false, imageUri, parsed:{}, rawText:'', message:`Belge fotoğrafı alındı; OCR çalışmadı. Alanları formda elle tamamlayın. (${ocrError?.message || 'OCR hatası'})` };
    }
  } catch (error) {
    return { ok:false, native:true, ocr:false, parsed:{}, message:error?.message || 'Kamera/OCR işlemi tamamlanamadı.' };
  }
}

export { parseDocumentText };
