export async function queueCloudBackup() {
  await new Promise(r => setTimeout(r, 320));
  return { queued:true, message:'Bulut yedekleme sıraya alındı (demo). Gerçek hesap eşitlemesi sonraki aşamada bağlanacak.' };
}
