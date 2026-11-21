export class ChatGPTApi {
  constructor(bridge) { this.bridge = bridge; }
  call(action,params={}) { return this.bridge.request("api."+action,params); }
  conversations(options={}) { return this.call("conversations",options); }
  projects() { return this.call("projects"); }
  projectConversations(projectId) { return this.call("projectConversations",{projectId}); }
  conversation(id) { return this.call("conversation",{id}); }
  archive(id, archived=true) { return this.call("archive",{id,archived}); }
  removeConversation(id) { return this.call("deleteConversation",{id}); }
  renameConversation(id,title) { return this.call("renameConversation",{id,title}); }
  moveConversation(id,projectId) { return this.call("moveConversation",{id,projectId}); }
  createProject(name) { return this.call("createProject",{name}); }
  renameProject(id,name) { return this.call("renameProject",{id,name}); }
  deleteProject(id) { return this.call("deleteProject",{id}); }
  sendMessage(id,text) { return this.call("sendMessage",{id,text}); }
}
