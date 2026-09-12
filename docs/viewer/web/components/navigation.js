import {element, link, route} from '../ui/elements.js';

export function navigation(model, labels) {
  const primary = element('nav', {'aria-label': labels.title, class:'primary-nav'});
  for (const kind of ['repositories','documents','images','instructions']) {
    primary.append(link(labels[kind], route({view:kind}), model.view === kind ? 'active' : ''));
  }
  const topics = element('nav', {'aria-label':labels.topics, class:'topic-nav'});
  for (const topic of model.catalog.topics) {
    topics.append(link(topic.title, route({topic:topic.id}), model.topic === topic.id ? 'active' : ''));
  }
  return element('aside', {class:'navigation'}, [primary, element('p',{class:'nav-label'},[labels.topics]), topics,
    link(labels.isolation, route({doc:'docs/viewer/ISOLATION.md'}), 'isolation-link'),
    element('p',{class:'catalog-count'},[model.catalog.counts.files + ' Markdown · ' + model.catalog.counts.images + ' images'])]);
}
