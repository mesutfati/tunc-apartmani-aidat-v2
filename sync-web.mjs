import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
const output = 'www';
if (existsSync(output)) rmSync(output, { recursive:true, force:true });
mkdirSync(output, { recursive:true });
for (const item of ['index.html', 'styles.css', 'app.js', 'data', 'services', 'public', 'assets']) {
  if (existsSync(item)) cpSync(item, `${output}/${item}`, { recursive:true });
}
mkdirSync(`${output}/vendor`, { recursive:true });
const vendor = [
  ['node_modules/@capacitor/camera/dist/plugin.js', 'camera.js'],
  ['node_modules/@capacitor-community/image-to-text/dist/plugin.js', 'ocr.js'],
  ['node_modules/@capacitor-community/bluetooth-le/dist/plugin.js', 'bluetooth-le.js'],
  ['node_modules/@e-is/capacitor-bluetooth-serial/dist/plugin.js', 'bluetooth-serial.js'],
  ['node_modules/@capacitor/local-notifications/dist/plugin.js', 'local-notifications.js'],
  ['node_modules/@capacitor/geolocation/dist/plugin.js', 'geolocation.js'],
];
for (const [source, target] of vendor) if (existsSync(source)) cpSync(source, `${output}/vendor/${target}`);
if (existsSync('www/public/manus-routes.json')) cpSync('www/public/manus-routes.json', 'www/manus-routes.json');
console.log('Web kaynakları www/ içine hazırlandı.');
