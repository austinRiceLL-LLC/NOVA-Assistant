import { getChatGPTUser } from "./chatgpt-auth";
import WorkspaceClient from "./workspace/workspace-client";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getChatGPTUser();
  return <WorkspaceClient user={user ? { displayName: user.displayName, email: user.email } : null} />;
}
