export class ReaderData {
  async get(path, signal) {
    const response=await fetch(path,{signal});
    const result=await response.json();
    if(!response.ok) throw new Error(result.error || 'Unable to load documentation');
    return result;
  }
  catalog(){return this.get('/api/catalog');}
  layout(){return this.get('/views/layout.json');}
  document(id,signal){return this.get('/api/document?'+new URLSearchParams({id}),signal);}
  search(query,kind,topic,signal){return this.get('/api/search?'+new URLSearchParams({q:query,kind,topic}),signal);}
}
