export class ConversationService {
  constructor(api) { this.api = api; this.items = []; this.offset = 0; this.total = null; this.hasMore = true; this.loading = false; }
  async load({archived=false,reset=true,search="",onProgress}={}) {
    if (reset) { this.items=[]; this.offset=0; this.total=null; this.hasMore=true; }
    if (this.loading || !this.hasMore) return this.items;
    this.loading=true;
    onProgress?.({label:"در حال دریافت گفتگوها…",current:0,total:null});
    let result;
    try { result = await this.api.conversations({archived,offset:this.offset,limit:28}); }
    catch(error) { this.loading=false; throw error; }
    const rows = (result.items || []).map(item => ({
      id:item.id, title:item.title || "Untitled", projectId:item.gizmo_id || null,
      archived:Boolean(item.is_archived), updatedAt:item.update_time || item.create_time,
      snippet:item.snippet || ""
    }));
    const known = new Set(this.items.map(item=>item.id));
    this.items.push(...rows.filter(item=>!known.has(item.id)));
    this.offset += rows.length;
    this.total = result.total ?? this.total;
    this.hasMore = rows.length === 28 && (this.total === null || this.offset < this.total);
    this.loading=false;
    onProgress?.({label:"گفتگوها دریافت شدند",current:this.items.length,total:this.total});
    return search ? this.items.filter(item=>item.title.toLowerCase().includes(search.toLowerCase())) : this.items;
  }
  async detail(id) { return this.api.conversation(id); }
  async archiveMany(ids, archived=true, onProgress) {
    return runSequential(ids, id=>this.api.archive(id,archived), onProgress, archived?"در حال بایگانی گفتگوها…":"در حال بازیابی گفتگوها…");
  }
  async deleteMany(ids, onProgress) {
    return runSequential(ids, id=>this.api.removeConversation(id), onProgress, "در حال حذف گفتگوها…");
  }
  async moveMany(ids, projectId, onProgress) {
    return runSequential(ids, id=>this.api.moveConversation(id,projectId), onProgress, "در حال انتقال گفتگوها…");
  }
}
async function runSequential(ids, operation, onProgress, label) {
  let success=0;
  const failed=[];
  onProgress?.({label,current:0,total:ids.length});
  for (let i=0;i<ids.length;i++) {
    try { await operation(ids[i]); success++; }
    catch(error) {
      failed.push(error?.message || "Failed");
      if (/HTTP (401|403|429)|اتصال مجدد|نشست|دسترسی را رد کرد/i.test(error?.message || "")) break;
    }
    onProgress?.({label,current:i+1,total:ids.length,success,failed:failed.length});
    if (i<ids.length-1) await new Promise(resolve=>setTimeout(resolve,350));
  }
  return {success,failed};
}
