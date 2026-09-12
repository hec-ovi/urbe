import {element, link, route, fileLink} from '../ui/elements.js';

function reference(ref, labels) {
  if(ref.status==='available') return element('li',{},[link(ref.label,ref.kind==='document'?route({doc:ref.id}):fileLink(ref.id)),element('span',{class:'source-path'},[ref.id])]);
  if(ref.status==='external') return element('li',{},[link(ref.label,ref.url)]);
  return element('li',{class:'unresolved'},[element('span',{},[ref.label]),element('span',{class:'reference-status'},[ref.status]),
    ...(ref.candidates||[]).map(id=>link(id,fileLink(id),'source-path'))]);
}

export function documentPanel(model, labels) {
  if(!model.document && !model.error) return element('div',{hidden:''});
  const region = element('main',{class:'document-layout',id:'content'});
  if(model.error) { region.append(element('p',{role:'alert',class:'error'},[model.error])); return region; }
  const doc=model.document;
  const body=element('article',{class:'prose'});
  body.innerHTML=doc.html;
  const article=element('div',{class:'reading-column'},[
    element('div',{class:'document-meta'},[element('span',{class:'source-path'},[doc.id]),link(labels.original,fileLink(doc.id))]),body]);
  if(model.topic) article.insertBefore(element('nav',{class:'topic-actions','aria-label':labels.related},[
    link(labels.documents,route({view:'documents',topic:model.topic})),
    link(labels.images,route({view:'images',topic:model.topic}))
  ]),body);
  if(doc.aliases.length) article.append(element('details',{},[element('summary',{},[labels.aliases]),...doc.aliases.map(id=>link(id,route({doc:id}),'source-path'))]));
  if(model.related.length) {
    const list=element('details',{class:'related'},[element('summary',{},[labels.related+' ('+model.related.length+')'])]);
    for(const entry of model.related) list.append(link(entry.title+' · '+entry.id,route({doc:entry.id}),'source-row'));
    article.append(list);
  }
  const nav=element('aside',{class:'page-nav'},[element('p',{class:'nav-label'},[labels.sections])]);
  const toc=element('nav',{'aria-label':labels.sections});
  for(const section of doc.headings) toc.append(link(section.title,route({doc:doc.id,anchor:section.anchor}),'level-'+section.level));
  nav.append(toc);
  const images=doc.references.filter(ref=>ref.kind==='image');
  if(images.length) {
    nav.append(element('p',{class:'nav-label'},[labels.references+' ('+images.length+')']));
    nav.append(element('ul',{class:'references'},images.map(ref=>reference(ref,labels))));
  }
  region.append(article,nav);
  return region;
}
