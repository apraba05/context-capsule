import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { encrypt, getDatabase, users, workspaces } from "@capsule/db";
import { newUserId, newWorkspaceId } from "@capsule/core";
import { setSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Dev-only login. Useful for previewing the UI without finishing the Slack
 * OAuth flow. In production, gate behind an explicit flag.
 */
export default async function DevLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="min-h-screen bg-paper flex items-center justify-center">
      <form
        action={async () => {
          "use server";
          if (process.env.NODE_ENV === "production" && !process.env.ALLOW_DEV_LOGIN) {
            throw new Error("dev login disabled in production");
          }
          const db = getDatabase();
          let workspace = await db.query.workspaces.findFirst({
            where: eq(workspaces.slackTeamId, "T_DEV"),
          });
          if (!workspace) {
            const id = newWorkspaceId();
            const [created] = await db
              .insert(workspaces)
              .values({
                id,
                slackTeamId: "T_DEV",
                name: "Dev workspace",
                encryptedOauthToken: encrypt("xoxb-dev-no-real-token"),
                installedBy: "U_DEV",
              })
              .returning();
            workspace = created!;
          }

          let user = await db.query.users.findFirst({
            where: and(
              eq(users.workspaceId, workspace.id),
              eq(users.slackUserId, "U_DEV"),
            ),
          });
          if (!user) {
            const id = newUserId();
            const [created] = await db
              .insert(users)
              .values({
                id,
                slackUserId: "U_DEV",
                workspaceId: workspace.id,
                mcpSubject: "dev:local",
              })
              .returning();
            user = created!;
          }

          await setSession(user.id);
          redirect(next ?? "/capsules");
        }}
        className="card-elevated p-10 max-w-md w-full"
      >
        <h1 className="text-h2 font-medium tracking-tight">Dev login</h1>
        <p className="mt-2 text-body text-muted">
          Sign in as a local dev user. Useful for previewing the UI before completing the Slack OAuth flow.
        </p>
        <button className="btn-primary mt-6 w-full py-3 text-body">Continue</button>
      </form>
    </main>
  );
}
