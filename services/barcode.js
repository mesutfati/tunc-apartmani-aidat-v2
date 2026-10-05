const nativePlugin = name => globalThis.Capacitor?.Plugins?.[name] || null;

const formatLabels = {
  256: 'QR Code',
  4096: 'Aztec',
  2048: 'Code 128',
  32: 'EAN-13',
  64: 'EAN-8',
   UPCA: 'UPC-A',
   UPCE: 'UPC-E',
};

export async function scanBarcode() {
  const vision = nativePlugin('Vision');
  if (!vision?.scanBarcode || !globalThis.Capacitor?.isNativePlatform?.()) {
    return { ok:false, native:false, cancelled:false, message:'Karekod tarama yalnızca Android APK içindeki Google Code Scanner ile çalışır.' };
  }
  try {
    const result = await vision.scanBarcode();
    const rawValue = String(result?.rawValue || result?.displayValue || '').trim();
    if (!rawValue) return { ok:false, native:true, cancelled:false, message:'Karekod okundu ancak veri içermiyor.' };
    return {
      ok:true,
      native:true,
      rawValue,
      displayValue:String(result?.displayValue || rawValue),
      format:Number.isFinite(Number(result?.format)) ? (formatLabels[result.format] || `Kod formatı ${result.format}`) : 'Karekod / barkod',
      valueType:result?.valueType ?? null,
    };
  } catch (error) {
    const message = error?.message || 'Karekod taraması tamamlanamadı.';
    return { ok:false, native:true, cancelled:/iptal|cancel/i.test(message), message };
  }
}
