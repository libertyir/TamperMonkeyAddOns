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
    const results = await Promise.allSettled(ids.map(id=>this.api.archive(id,archived)));
    return summarize(results);
  }
  async deleteMany(ids) {
    const results = await Promise.allSettled(ids.map(id=>this.api.removeConversation(id)));
    return summarize(results);
  }
  async moveMany(ids, projectId) {
    const results = await Promise.allSettled(ids.map(id=>this.api.moveConversation(id,projectId)));
    return summarize(results);
  }
}
function summarize(results) {
  return {success:results.filter(x=>x.status==="fulfilled").length,failed:results.filter(x=>x.status==="rejected").map(x=>x.reason?.message || "Failed")};
}
