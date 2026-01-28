// Script de ejemplo para poblar datos iniciales (ejecutar manualmente para pruebas).
const fs = require('fs');
const path = require('path');

const sample = {
  menus: [
    { id: 'menu-main', name: 'Menú Principal', sections: [{ id: 's1', title: 'Entradas', itemIds: [] }, { id: 's2', title: 'Combos', itemIds: [] }] }
  ],
  items: [
    { id: 'i1', title: 'Hamburguesa clásica', price: 6.5, description: 'Carne, lechuga, tomate, queso' },
    { id: 'i2', title: 'Papas fritas', price: 2.5, description: 'Papas crocantes' }
  ],
  offers: [
    { id: 'o1', title: 'Combo clásico', templateId: 'tpl-combo', payload: { components: ['i1','i2'], originalPrice: 9.5, comboPrice: 8.0 } }
  ]
};

fs.writeFileSync(path.join(__dirname, 'sample_payload.json'), JSON.stringify(sample, null, 2));
console.log('sample_payload.json creado');
