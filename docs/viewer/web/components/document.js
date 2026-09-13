import {element, link, route} from '../ui/elements.js';
import {lightbox} from '../ui/lightbox.js';

export function documentPanel(model, labels) {
  const region=element('main',{class:'document-layout',id:'content'});
  if(model.error) { region.append(element('p',{role:'alert',class:'error'},[model.error])); return region; }
  const stage=model.stage;
  const body=element('article',{class:'prose'});
  body.innerHTML=stage.html;
  for(const image of body.querySelectorAll('img')) {
    image.addEventListener('click',()=>lightbox(image,image.closest('p')?.textContent.trim()||'',labels));
  }
  const sections=element('nav',{'aria-label':labels.sections});
  for(const section of stage.headings.filter(heading=>heading.level>1)) {
    sections.append(link(section.title,route({stage:stage.id,anchor:section.anchor}),'level-'+section.level));
  }
  region.append(
    element('div',{class:'reading-column'},[element('p',{class:'source-path'},[stage.file]),body]),
    element('aside',{class:'page-nav'},[element('p',{class:'nav-label'},[labels.sections]),sections]));
  return region;
}
