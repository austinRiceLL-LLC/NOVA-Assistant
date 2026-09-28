# Atlas Companion architecture

Atlas now exposes one assistant state through three web surfaces:

- **Edge** is the 58 px persistent rail. It carries attention state and expands without changing assistant context.
- **Brief** is the compact daily feed, provider search, recent conversation, and quick drafting surface.
- **Workspace** is the full inbox, chat, drafts, connections, and settings application.

`WorkspaceClient` owns the shared workspace, selected source, conversation, drafts, pending action, and current surface. `AtlasCompanion` receives that state and the same action handlers used by Workspace. Surface preference is durable in local storage; active conversation and selection survive navigation in session storage. The server remains authoritative for connections, synchronized content, action proposals, and confirmation state.

## Assistant boundary

`answerWithAtlas` separates general assistant reasoning from application evidence. It sends only compact selected or retrieved records, connected capability metadata, and recent conversation to the configured model. The OpenAI Responses provider can call two bounded read-only tools: workspace search and exact source retrieval. Each call is executed on the server against the authenticated user's already synchronized data, with four model rounds at most. When no model is configured or a request fails, Atlas returns the deterministic grounded answer.

External writes continue through the existing proposal and confirmation routes. The model cannot send mail, create events, alter files, or report success by itself.

## App capability registry

`/api/atlas/apps` loads the live Composio v3 toolkit registry, normalizes categories, ranks matches, and joins it to the user's saved connections. Toolkit names, descriptions, categories, versions, and tool counts come from Composio. Atlas only advertises specific capabilities when actual tool names establish them.

Known providers use their existing auth configuration variables. Additional toolkits can be enabled without a code restart by adding their toolkit slug and Composio auth configuration id to the server-side `COMPOSIO_AUTH_CONFIGS_JSON` map. A toolkit without an auth configuration is shown as **Setup required** rather than offering a connection that cannot complete. API keys and auth configuration ids never enter the browser response.

## Desktop packaging path

The companion is deliberately implemented as an ordinary responsive React surface first. A future Tauri or Electron shell can host the same route and add operating-system behavior through a narrow adapter:

1. Map Edge, Brief, and Workspace to shell window dimensions and remembered screen position.
2. Implement always-on-top, tray/menu-bar access, global shortcuts, launch-at-login, and multi-monitor placement in the native main process.
3. Keep OAuth in the system browser and return through an allow-listed deep link.
4. Keep tokens and provider secrets in the server or platform credential vault; send only short-lived session state to the renderer.
5. Expose native commands through an allow-list. Never give the renderer unrestricted filesystem or shell access.

The web build does not claim operating-system persistence or global shortcut support. It provides the interaction model and state boundary required for a later native wrapper.
