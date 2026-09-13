import {element, link, route} from '../ui/elements.js';

export function navigation(model, labels) {
  const stages = element('nav', {'aria-label':labels.stages, class:'stage-nav'});
  for (const stage of model.stages) {
    stages.append(link(stage.title, route({stage:stage.id}), model.stage?.id === stage.id ? 'active' : ''));
  }
  return element('aside', {class:'navigation'}, [element('p',{class:'nav-label'},[labels.stages]), stages]);
}
