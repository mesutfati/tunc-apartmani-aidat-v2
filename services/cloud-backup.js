// Bulut hesabı ve uzak yedekleme endpointi bağlanmadı.
// Uygulama yalnızca storage.js içindeki kullanıcı tarafından başlatılan JSON dışa/içe aktarmayı kullanır.
export async function cloudBackupUnavailable() {
  return { queued:false, local:false, message:'Bulut yedekleme yapılandırılmadı; JSON yedeği cihazınıza indirin.' };
}
