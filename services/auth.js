// Google OAuth için gerekli istemci kimliği ve doğrulama sunucusu bu projeye bağlanmadı.
// UI'da sahte oturum gösterilmez; bu modül bilinçli olarak kullanıcı/session oluşturmaz.
export async function googleSignInUnavailable() {
  return { ok:false, message:'Google girişi yapılandırılmadı; sahte kullanıcı oluşturulmadı.' };
}
