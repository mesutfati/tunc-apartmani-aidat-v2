const QUEUE_KEY = 'yakit-alarmi-cloud-queue';

export async function queueCloudBackup(state) {
  const snapshot = { queuedAt:new Date().toISOString(), data:state };
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(snapshot));
    return { queued:true, local:true, message:'Yedek yerel bulut kuyruğuna yazıldı. Hesap sunucusu bağlanınca otomatik gönderime hazır.' };
  } catch {
    return { queued:false, local:false, message:'Yerel yedek kuyruğu dolu; önce eski kayıtları dışa aktarın.', error:true };
  }
}

export function readQueuedCloudBackup() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || 'null'); } catch { return null; }
}
