export class ProjectService {
  constructor(api) { this.api=api; this.items=[]; }
  async load() {
    const found=new Map();
    const seenCursors=new Set();
    let cursor=null;
    for(let page=0;page<1000;page++) {
      const result=await this.api.projects(cursor);
      for(const row of result.items || []) {
        const p=row.gizmo?.gizmo || row.gizmo || row;
        const project={id:p.id || p.project_id,name:p.display?.name || p.name || "Untitled",description:p.display?.description || "",raw:p};
        if(project.id) found.set(project.id,project);
      }
      const next=result.cursor;
      if(next===null||next===undefined||next==="") break;
      const key=String(next);
      if(seenCursors.has(key)) throw new Error("صفحه‌بندی پروژه‌ها با cursor تکراری متوقف شد.");
      seenCursors.add(key);
      cursor=next;
      if(page===999) throw new Error("تعداد صفحات پروژه‌ها از حد ایمن عبور کرد.");
    }
    this.items=[...found.values()];
    return this.items;
  }
  create(name) { return this.api.createProject(name); }
  rename(id,name) { return this.api.renameProject(id,name); }
  remove(id) { return this.api.deleteProject(id); }
  conversations(id) { return this.api.projectConversations(id); }
}
