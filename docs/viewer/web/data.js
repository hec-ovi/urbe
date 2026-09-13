export class ReaderData {
  constructor(snapshot) {
    this.snapshot=snapshot;
  }
  layout(){return this.snapshot.layout;}
  stages(){return this.snapshot.stages;}
  stage(id){
    const stage=this.snapshot.stages.find(entry=>entry.id===id);
    if(!stage)throw new Error('Stage not found: '+id);
    return stage;
  }
}
