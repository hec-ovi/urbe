import {header} from '../components/header.js';
import {navigation} from '../components/navigation.js';
import {documentPanel} from '../components/document.js';

const widgets={header,navigation,document:documentPanel};

export class ReaderView {
  constructor(root,layout){this.root=root;this.layout=layout;}
  render(model,actions){
    this.root.replaceChildren(...this.layout.widgets.map(widget=>widgets[widget.type](model,this.layout.labels,actions)));
  }
}
