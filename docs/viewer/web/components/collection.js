import {element, link, button, route, fileLink} from '../ui/elements.js';

function repositoryCard(repo, labels) {
  const details = element('dl', {class:'repo-details'});
  for (const [label,value] of [[labels.dependencies,repo.depends.join(', ')],[labels.revision,repo.revision],[labels.dirty,repo.changedFiles]]) {
    details.append(element('dt',{},[label]), element('dd',{},[value ?? 'Unavailable']));
  }
  return element('article',{class:'repo-card'},[
    link(repo.id,route({doc:repo.contract}),'card-title'), element('p',{},[repo.purpose]),
    element('p',{class:'isolation-note'},[repo.isolation]), details,
    element('p',{class:'source-path'},[repo.version])]);
}

export function collection(model, labels, actions) {
  if (!model.collection) return element('div', {hidden:''});
  const region = element('main',{class:'collection',id:'content'},[
    element('p',{class:'eyebrow'},[model.collection.eyebrow]), element('h1',{},[model.collection.title])]);
  if (model.collection.description) region.append(element('p',{class:'intro'},[model.collection.description]));
  const entries = model.collection.entries;
  if (!entries.length) region.append(element('p',{class:'empty'},[labels.empty]));
  const list = element('div',{class:model.view === 'images' ? 'image-grid' : model.view === 'repositories' ? 'repo-grid' : 'source-list'});
  for (const entry of entries.slice(0,model.limit)) {
    if (model.view === 'repositories') list.append(repositoryCard(entry,labels));
    else if (model.view === 'images') list.append(element('figure',{class:'image-card'},[
      element('a',{href:fileLink(entry.id),target:'_blank',rel:'noopener'},[element('img',{src:fileLink(entry.id),alt:entry.title,loading:'lazy'})]),
      element('figcaption',{},[link(entry.title,fileLink(entry.id)),element('span',{class:'source-path'},[entry.id]),
        ...(entry.sources || []).slice(0,3).map(id=>link(id,route({doc:id}),'source-path'))])
    ]));
    else list.append(link(element('span',{},[element('strong',{},[entry.title]),element('span',{class:'source-path'},[entry.id])]),route({doc:entry.id}),'source-row'));
  }
  region.append(list);
  if(entries.length>model.limit) region.append(button(labels.more,actions.more));
  return region;
}
