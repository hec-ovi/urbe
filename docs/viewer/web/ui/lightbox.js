import {element, button} from './elements.js';

export function lightbox(image, caption, labels) {
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = event => { if (event.key === 'Escape') close(); };
  const shut = button(labels.close, close);
  shut.className = 'lightbox-close';
  const overlay = element('div', {class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': image.alt}, [
    element('img', {src: image.getAttribute('src'), alt: image.alt}),
    caption ? element('p', {}, [caption]) : null,
    shut
  ]);
  overlay.addEventListener('click', event => { if (event.target === overlay || event.target.tagName === 'IMG') close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(overlay);
  shut.focus();
}
