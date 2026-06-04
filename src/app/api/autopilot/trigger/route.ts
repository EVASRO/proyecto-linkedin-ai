import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { runAutopilotForWorkspace } from "@/app/dashboard/agentes-ia/actions";

const WEBHOOK_SECRET =
  process.env.AUTOPILOT_WEBHOOK_SECRET ?? "nexusai-autopilot-2024";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    if (token !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const record = body.record as Record<string, unknown> | undefined;

    // Skip if the inserted message is not from a prospect
    if (record && record.sender !== "prospect") {
      return NextResponse.json({ skipped: true, reason: "not a prospect message" });
    }

    // Resolve workspace_id from the message record or conversation
    let workspaceId = record?.workspace_id as string | undefined;

    if (!workspaceId && record?.conversation_id) {
      const { data } = await supabase
        .from("conversations")
        .select("workspace_id")
        .eq("id", record.conversation_id)
        .single();
      workspaceId = data?.workspace_id as string | undefined;
    }

    if (!workspaceId) {
      return NextResponse.json(
        { success: false, error: "Could not determine workspace_id" },
        { status: 400 }
      );
    }

    const result = await runAutopilotForWorkspace(workspaceId);

    return NextResponse.json({
      success: result.success,
      processed: result.data?.processed ?? 0,
      error: result.error,
    });
  } catch (err) {
    console.error("[Autopilot] trigger error:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "autopilot-trigger" });
}
