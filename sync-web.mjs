import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
const output = 'www';
if (existsSync(output)) rmSync(output, { recursive:true, force:true });
mkdirSync(output, { recursive:true });
for (const item of ['index.html', 'styles.css', 'app.js', 'data', 'services', 'public']) {
  if (existsSync(item)) cpSync(item, `${output}/${item}`, { recursive:true });
}
if (existsSync('www/public/manus-routes.json')) cpSync('www/public/manus-routes.json', 'www/manus-routes.json');
console.log('Web kaynakları www/ içine hazırlandı.');
