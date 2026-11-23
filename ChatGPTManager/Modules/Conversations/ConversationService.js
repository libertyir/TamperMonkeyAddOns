export class ConversationService {
  constructor(api) { this.api = api; this.items = []; this.offset = 0; this.total = null; }
  async load({archived=false,reset=true,search=""}={}) {
    if (reset) { this.items=[]; this.offset=0; }
    const result = await this.api.conversations({archived,offset:this.offset,limit:28});
    const rows = (result.items || []).map(item => ({
      id:item.id, title:item.title || "Untitled", projectId:item.gizmo_id || null,
      archived:Boolean(item.is_archived), updatedAt:item.update_time || item.create_time,
      snippet:item.snippet || ""
    }));
    const known = new Set(this.items.map(item=>item.id));
    this.items.push(...rows.filter(item=>!known.has(item.id)));
    this.offset += rows.length;
    this.total = result.total ?? this.total;
    return search ? this.items.filter(item=>item.title.toLowerCase().includes(search.toLowerCase())) : this.items;
  }
  async detail(id) { return this.api.conversation(id); }
  async archiveMany(ids, archived=true) {
    return runSequential(ids, id=>this.api.archive(id,archived));
  }
  async deleteMany(ids) {
    return runSequential(ids, id=>this.api.removeConversation(id));
  }
  async moveMany(ids, projectId) {
    return runSequential(ids, id=>this.api.moveConversation(id,projectId));
  }
}
async function runSequential(ids, operation) {
  let success=0;
  const failed=[];
  for (let i=0;i<ids.length;i++) {
    try { await operation(ids[i]); success++; }
    catch(error) {
      failed.push(error?.message || "Failed");
      if (/HTTP (401|403|429)|اتصال مجدد|نشست|دسترسی را رد کرد/i.test(error?.message || "")) break;
    }
    if (i<ids.length-1) await new Promise(resolve=>setTimeout(resolve,350));
  }
  return {success,failed};
}
