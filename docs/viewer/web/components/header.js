import {element, link, route, button} from '../ui/elements.js';

export function header(model, labels, actions) {
  const theme=button(model.theme==='dark'?labels.lightMode:labels.darkMode,actions.theme);
  theme.className='theme-toggle';
  return element('header', {class: 'header'}, [
    link(labels.brand, route({}), 'brand'),
    element('span', {class:'header-title'}, [labels.title]), theme
  ]);
}
