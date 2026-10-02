export async function demoGoogleSignIn() {
  await new Promise(r => setTimeout(r, 450));
  return { name:'Demo Sürücü', email:'demo@yakitalarmi.app', provider:'google-demo' };
}
// Gerçek OAuth sağlayıcısı ve Capacitor Browser callback akışı sonraki aşamada bağlanacak.
