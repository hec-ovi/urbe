export class ReaderTheme {
  constructor(storage) {
    this.storage=storage;
    this.value='dark';
    try {
      const saved=storage?.getItem('urbe-reader-theme');
      if(saved==='light'||saved==='dark')this.value=saved;
    } catch {}
  }
  apply(root){root.dataset.theme=this.value;}
  toggle(){
    this.value=this.value==='dark'?'light':'dark';
    try {this.storage?.setItem('urbe-reader-theme',this.value);} catch {}
    return this.value;
  }
}
