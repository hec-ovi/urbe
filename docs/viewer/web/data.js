export class ReaderData {
  constructor(snapshot) {
    this.snapshot=snapshot;
  }
  catalog(){return this.snapshot.catalog;}
  layout(){return this.snapshot.layout;}
  files(){return this.snapshot.files;}
  document(id){
    if(!Object.hasOwn(this.snapshot.documents,id))throw new Error('Document not found: '+id);
    return this.snapshot.documents[id];
  }
  search(query,kind,topic){
    if(!['documents','images'].includes(kind))throw new Error('Unknown search kind');
    const terms=query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const records=kind==='images'?this.snapshot.catalog.images:this.snapshot.catalog.documents;
    return records.filter(record=>{
      if(topic&&!record.topics.includes(topic))return false;
      const text=kind==='images'?(record.id+' '+record.title).toLocaleLowerCase():this.snapshot.search[record.id];
      return terms.every(term=>text.includes(term));
    });
  }
}
