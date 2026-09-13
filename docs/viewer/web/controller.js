import {ReaderData} from './data.js';
import {ReaderView} from './views/reader.js';
import {ReaderTheme} from './theme.js';

class ReaderController {
  constructor(data,view,theme){
    this.data=data;this.view=view;this.theme=theme;
    this.actions={theme:()=>{this.theme.toggle();this.theme.apply(document.documentElement);this.render();}};
  }
  navigate(){
    const params=new URLSearchParams(location.hash.slice(1));
    const id=params.get('stage')||this.data.stages()[0].id;
    this.model={stages:this.data.stages(),stage:null,error:null};
    try{this.model.stage=this.data.stage(id);}catch(error){this.model.error=error.message;}
    this.render();
    const anchor=params.get('anchor');
    if(anchor)document.getElementById('section-'+anchor)?.scrollIntoView();
    else window.scrollTo(0,0);
  }
  render(){this.view.render({...this.model,theme:this.theme.value},this.actions);}
}

try{
  const data=new ReaderData(JSON.parse(document.getElementById('reader-data').textContent));
  let storage;
  try{storage=window.localStorage;}catch{}
  const theme=new ReaderTheme(storage);
  theme.apply(document.documentElement);
  const controller=new ReaderController(data,new ReaderView(document.getElementById('reader'),data.layout()),theme);
  window.addEventListener('hashchange',()=>controller.navigate());
  controller.navigate();
}catch(error){document.getElementById('reader').textContent=error.message;}
