import { CONNECTOR_CATALOG } from "@/lib/nova/connectors";
import { NOVA_CORE_VERSION } from "@/lib/nova/domain";

export async function GET() {
  return Response.json({
    name: "Atlas Core",
    version: NOVA_CORE_VERSION,
    mode: "foundation",
    safety: { defaultPermission: "observe", writeActionsRequireApproval: true, autonomousTrading: false },
    connectors: CONNECTOR_CATALOG,
  });
}
