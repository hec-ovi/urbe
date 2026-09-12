import {element, link, route} from '../ui/elements.js';

export function header(model, labels, actions) {
  const form = element('form', {role: 'search', class: 'search'});
  const input = element('input', {type: 'search', name: 'query', value: model.query || '', placeholder: labels.search, 'aria-label': labels.search});
  form.append(input, element('button', {type: 'submit'}, [labels.submit]));
  form.addEventListener('submit', event => { event.preventDefault(); actions.search(input.value); });
  return element('header', {class: 'header'}, [
    link(labels.brand, route({topic:'product'}), 'brand'),
    element('span', {class:'header-title'}, [labels.title]), form,
    link(labels.fresh, route({doc:'docs/viewer/START.md'}), 'header-link')
  ]);
}
