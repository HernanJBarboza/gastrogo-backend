const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

function loadTemplate(id){
  const file = path.join(__dirname, '..', 'templates', `${id}.json`);
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e){ return null }
}

function buildPresentation(menu, template){
  const presentation = {
    menu: { id: menu.id, title: menu.title, items: menu.items },
    template: template || { id: null, name: null, config: { backgroundColor: '#fff', accentColor: '#000', sections: [] } },
    meta: {
      generatedAt: new Date().toISOString(),
      rotate: (template && template.config && template.config.behaviors && template.config.behaviors.autoRotate) || false,
      rotateIntervalSec: (template && template.config && template.config.behaviors && template.config.behaviors.rotateIntervalSec) || 8
    }
  };

  const slides = [];
  const sections = presentation.template.config.sections || [];
  for (const section of sections) {
    if (section.type === 'hero') {
      slides.push({ type: 'hero', height: section.height, content: menu.items.slice(0, 1) });
    } else if (section.type === 'carousel') {
      slides.push({ type: 'carousel', height: section.height, content: menu.items });
    } else if (section.type === 'grid') {
      slides.push({ type: 'grid', height: section.height, content: menu.items });
    } else if (section.type === 'list') {
      slides.push({ type: 'list', height: section.height, content: menu.items });
    } else if (section.type === 'video') {
      slides.push({ type: 'video', height: section.height, content: { url: section.videoUrl || null } });
    } else if (section.type === 'ticker') {
      slides.push({ type: 'ticker', height: section.height, content: menu.items.map(i => i.name).join(' • ') });
    } else {
      slides.push({ type: section.type || 'unknown', height: section.height, content: menu.items });
    }
  }

  presentation.slides = slides;
  return presentation;
}

// sample menu
const menu = {
  id: uuid(),
  title: 'Menu Promocional',
  items: [
    { name: 'Combo A', price: 5.99 },
    { name: 'Combo B', price: 7.5 },
    { name: 'Papas Medianas', price: 2.0 }
  ],
  templateId: 'mc-style'
};

const template = loadTemplate(menu.templateId);
const pres = buildPresentation(menu, template);
console.log(JSON.stringify(pres, null, 2));
