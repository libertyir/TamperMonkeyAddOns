export class ProjectService {
  constructor(api) { this.api=api; this.items=[]; }
  async load() {
    const result=await this.api.projects();
    this.items=(result.items || []).map(row=>{
      const p=row.gizmo?.gizmo || row.gizmo || row;
      return {id:p.id || p.project_id,name:p.display?.name || p.name || "Untitled",description:p.display?.description || "",raw:p};
    }).filter(p=>p.id);
    return this.items;
  }
  create(name) { return this.api.createProject(name); }
  rename(id,name) { return this.api.renameProject(id,name); }
  remove(id) { return this.api.deleteProject(id); }
  conversations(id) { return this.api.projectConversations(id); }
}
