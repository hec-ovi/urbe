import {ReaderData} from './data.js';
import {ReaderView} from './views/reader.js';
import {route,configureFileLinks} from './ui/elements.js';
import {ReaderTheme} from './theme.js';

class ReaderController {
  constructor(data,view,catalog,labels,theme){
    this.data=data;this.view=view;this.catalog=catalog;this.labels=labels;this.limit=80;
    this.theme=theme;
    this.actions={search:query=>{location.hash=route({view:this.model?.view==='images'?'images':'documents',q:query,topic:this.model?.topic||''});},more:()=>{this.model.limit+=80;this.render();}};
    this.actions.theme=()=>{this.theme.toggle();this.theme.apply(document.documentElement);this.model.theme=this.theme.value;this.render();};
  }
  navigate(){
    const params=new URLSearchParams(location.hash.slice(1));
    const view=params.get('view')||'';
    const query=params.get('q')||'';
    const topic=params.get('topic')||(!view&&!params.get('doc')?'product':'');
    const model={catalog:this.catalog,view,query,topic,theme:this.theme.value,limit:this.limit,related:[],document:null,collection:null,error:null};
    try {
      if(params.has('missing')) throw new Error(this.labels.missing+': '+params.get('missing'));
      if(view){
        let entries;
        if(view==='repositories') entries=this.catalog.repositories;
        else if(query) entries=this.data.search(query,view==='images'?'images':'documents',topic);
        else if(view==='images') entries=this.catalog.images;
        else if(view==='instructions') entries=this.catalog.documents.filter(doc=>doc.kind==='instructions'||/WORKING_RULES|START.md|SESSION.md/.test(doc.id));
        else entries=this.catalog.documents;
        if(topic&&view!=='repositories')entries=entries.filter(entry=>entry.topics.includes(topic));
        model.collection={title:this.labels[view]||this.labels.documents,eyebrow:query?'Search: '+query:entries.length+' entries',entries};
      } else {
        const selected=this.catalog.topics.find(entry=>entry.id===topic);
        const id=params.get('doc')||selected?.guide||'docs/viewer/START.md';
        model.document=this.data.document(id);
        if(selected) model.related=this.catalog.documents.filter(doc=>doc.id!==id&&doc.topics.includes(selected.id));
      }
    } catch(error) {
      model.error=error.message;
    }
    this.model=model;this.render();
    const anchor=params.get('anchor');
    if(anchor)document.getElementById('section-'+anchor)?.scrollIntoView();
    else window.scrollTo(0,0);
  }
  render(){this.view.render(this.model,this.actions);}
}

try{
  const data=new ReaderData(JSON.parse(document.getElementById('reader-data').textContent));
  const catalog=data.catalog(),layout=data.layout();
  configureFileLinks(data.files());
  let storage;
  try{storage=window.localStorage;}catch{}
  const theme=new ReaderTheme(storage);
  theme.apply(document.documentElement);
  const controller=new ReaderController(data,new ReaderView(document.getElementById('reader'),layout),catalog,layout.labels,theme);
  window.addEventListener('hashchange',()=>controller.navigate());
  controller.navigate();
}catch(error){document.getElementById('reader').textContent=error.message;}
