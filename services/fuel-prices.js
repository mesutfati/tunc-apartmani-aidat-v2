import { districts } from '../data/fixtures.js';

// Sonraki aşamada getFuelPrices içindeki fixture dönüşü gerçek API istemcisiyle değiştirilebilir.
export async function getFuelPrices({ city='İstanbul', type='benzin' } = {}) {
  await new Promise(r => setTimeout(r, 180));
  return districts.map(item => ({ city, district:item.name, price:item[type], updatedAt:'Bugün · 10:24', type }));
}
