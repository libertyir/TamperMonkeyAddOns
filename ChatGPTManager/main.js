import { BridgeClient } from "./Core/BridgeClient.js";
import { I18n } from "./Core/I18n.js";
import { Preferences } from "./Storage/Preferences.js";
import { ChatGPTApi } from "./API/ChatGPTApi.js";
import { ConversationService } from "./Modules/Conversations/ConversationService.js";
import { ProjectService } from "./Modules/Projects/ProjectService.js";
import { ManagerApp } from "./UI/App.js";

const bridge = new BridgeClient();
await bridge.ready;

const i18n = new I18n();
const preferences = new Preferences(bridge);
const api = new ChatGPTApi(bridge);
const conversations = new ConversationService(api);
const projects = new ProjectService(api);
const app = new ManagerApp({ api, bridge, preferences, i18n, conversations, projects });

await app.init();
