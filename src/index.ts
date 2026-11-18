/**
 * @file index.ts (Cloudflare Worker)
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-24
 * @brief Main Cloudflare Worker entry point. Handles all API routes for authentication, waza data, progress tracking, labels, list sharing (KV), account management, contributions, groups, admin panel, and serves the HTML frontend.
 */

import {
  getUserFromSession,
} from "./auth";

import {
  readGroupBody,
  validateGroupCreate,
  validateGroupUpdate,
  GroupCreateInput,
  GroupUpdateInput,
} from "./groupsValidation";

import { renderHtml } from "./renderHtml";

import {
  ValidationError,
} from "./validation";

import { parseStoredLabels } from "./utils/labels";

import {
  parseStoredMarkings,
} from "./utils/markings";

import {
  readJsonObject,
} from "./utils/request";

import {
  isRateLimited,
} from "./utils/rateLimit";

import {
  err,
  json,
} from "./utils/responses";

import {
  handleAuthRoutes,
} from "./routes/authRoutes";

import {
  handleWazaRoutes,
} from "./routes/wazaRoutes";

import {
  handleProgressRoutes,
} from "./routes/progressRoutes";

import {
  handleLabelRoutes,
} from "./routes/labelRoutes";

import {
  handleSharedListRoutes,
} from "./routes/sharedListRoutes";

import {
  handleAccountRoutes,
} from "./routes/accountRoutes";

import {
  handleContributionRoutes,
} from "./routes/contributionRoutes";

import {
  handleAdminRoutes,
} from "./routes/adminRoutes";

import {
  handleGroupRoutes,
} from "./routes/groupRoutes";

export default {
	async fetch(request, env) {
		// D1 has foreign key enforcement OFF by default, and it's a per-connection
		// SQLite setting rather than something baked into the database file —
		// so it has to be (re-)enabled at the start of every request. Wrapped in
		// try/catch defensively: if a future D1 runtime ever rejects this PRAGMA,
		// the app should degrade to "no FK enforcement" (today's behavior),
		// not fail every single request.
		try {
			await env.DB.exec("PRAGMA foreign_keys = ON;");
		} catch (e) {
			console.error("Failed to enable foreign_keys PRAGMA:", e);
		}

		let url: URL;
		try {
			url = new URL(request.url);
		} catch {
			console.error("Bad request.url:", JSON.stringify(request.url), "referer:", request.headers.get("referer"));
			return new Response("Bad Request", { status: 400 });
		}
		const path = url.pathname;

		// ── Auth helpers ──────────────────────────────────────────
		const authHeader = request.headers.get("Authorization");
		const sessionToken = authHeader?.replace("Bearer ", "") || "";
		
const getUser = () =>
  sessionToken
    ? getUserFromSession(env, sessionToken)
    : null;

const getGroupRole = async (
  groupId: number,
  userId: number,
): Promise<string | null> => {
  const row = await env.DB.prepare(
    "SELECT role FROM group_members WHERE group_id = ? AND user_id = ?",
  )
    .bind(groupId, userId)
    .first();

  return row
    ? (row.role as string)
    : null;
};

const ctx = {
  request,
  env,
  url,
  path,
  getUser,
  getGroupRole,
};

		// ── Say no to robots ──────────────────────────────────────
		if (path === "/robots.txt") {
			return new Response("User-agent: *\nDisallow: /", {
				headers: { "Content-Type": "text/plain" },
			});
		}

		const authResponse =
		  await handleAuthRoutes(ctx);
		
		if (authResponse) {
		  return authResponse;
		}
		
const wazaResponse =
  await handleWazaRoutes(ctx);

if (wazaResponse) {
  return wazaResponse;
}

		const progressResponse =
  await handleProgressRoutes(ctx);

if (progressResponse) {
  return progressResponse;
}

		const labelResponse =
  await handleLabelRoutes(ctx);

if (labelResponse) {
  return labelResponse;
}

		const sharedListResponse =
  await handleSharedListRoutes(ctx);

if (sharedListResponse) {
  return sharedListResponse;
}

		const accountResponse =
  await handleAccountRoutes(ctx);

if (accountResponse) {
  return accountResponse;
}

		const contributionResponse =
  await handleContributionRoutes(ctx);

if (contributionResponse) {
  return contributionResponse;
}

		const adminResponse =
  await handleAdminRoutes(ctx);

if (adminResponse) {
  return adminResponse;
}
		
		const groupResponse =
  await handleGroupRoutes(ctx);

if (groupResponse) {
  return groupResponse;
}

		// ── Groups ────────────────────────────────────────────────────

		// POST /api/groups — create a group
		if (path === "/api/groups" && request.method === "POST") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		// ── Rate limit: max 5 groups created per user per 24 hours ──
		// Admins are exempt — they may need to create groups freely for
		// testing or moderation purposes.
		if (!user.is_admin) {
			const limited = await isRateLimited(
			env.DB,
			"groups",
			"created_by",
			"created_at",
			user.id,
			5,
			"-24 hours",
			);
			if (limited) {
			return err(
				"You have created too many groups recently. Please wait before creating another.",
				429,
			);
			}
		}

		let input: GroupCreateInput;
		
		try {
		  const body = await readGroupBody(request);
		  input = validateGroupCreate(body);
		} catch (error) {
		  if (error instanceof ValidationError) {
		    return err(error.message, 400);
		  }
		
		  throw error;
		}
		
		const { name, join_policy, social } = input;

		// Generate invite key if needed
		let invite_key: string | null = null;
		const buf = crypto.getRandomValues(new Uint8Array(32));
		invite_key = Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join("");

		try {
		  const [groupResult] = await env.DB.batch([
		    // Statement 1: create the group.
		    env.DB.prepare(`
		      INSERT INTO groups
		        (name, join_policy, invite_key, social, created_by)
		      VALUES (?, ?, ?, ?, ?)
		    `).bind(
		      name,
		      join_policy,
		      invite_key,
		      JSON.stringify(social),
		      user.id,
		    ),
		
		    // Statement 2: add this group's creator as its admin.
		    // The unique invite key identifies the group created above.
		    env.DB.prepare(`
		      INSERT INTO group_members (group_id, user_id, role)
		      VALUES (
		        (SELECT id FROM groups WHERE invite_key = ?),
		        ?,
		        'admin'
		      )
		    `).bind(
		      invite_key,
		      user.id,
		    ),
		  ]);
		
		  const groupId = groupResult.meta.last_row_id;
		
		  return json({
		    success: true,
		    group_id: groupId,
		    invite_key,
		  });
		} catch (error) {
		  // Do not log the invite key or return raw database errors.
		  console.error("Atomic group creation failed:", error);
		
		  return err(
		    "Could not create the group. Please try again.",
		    500,
		  );
		}
		}

		// PUT /api/groups/:id — update group (Group admin only)
		if (path.match(/^\/api\/groups\/\d+$/) && request.method === "PUT") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const groupId = +path.split("/")[3];
		const role = await getGroupRole(groupId, user.id);
		if (role !== "admin") return err("Forbidden", 403);

		let input: GroupUpdateInput;
		
		try {
		  const body = await readGroupBody(request);
		  input = validateGroupUpdate(body);
		} catch (error) {
		  if (error instanceof ValidationError) {
		    return err(error.message, 400);
		  }
		
		  throw error;
		}
		
		const updates: string[] = [];
		const values: (string | number)[] = [];
		
		if (input.name !== undefined) {
		  updates.push("name = ?");
		  values.push(input.name);
		}
		
		if (input.join_policy !== undefined) {
		  updates.push("join_policy = ?");
		  values.push(input.join_policy);
		}
		
		if (input.social !== undefined) {
		  updates.push("social = ?");
		  values.push(JSON.stringify(input.social));
		}

		values.push(groupId);
		await env.DB.prepare(`UPDATE groups SET ${updates.join(", ")} WHERE id = ?`)
			.bind(...values).run();

		return json({ success: true });
		}

		// DELETE /api/groups/:id — delete group (Group admin only)
		if (path.match(/^\/api\/groups\/\d+$/) && request.method === "DELETE") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const groupId = +path.split("/")[3];
		const role = await getGroupRole(groupId, user.id);
		if (role !== "admin") return err("Forbidden", 403);

		await env.DB.prepare("DELETE FROM groups WHERE id = ?").bind(groupId).run();
		return json({ success: true });
		}

		// POST /api/groups/:id/invite-key — regenerate invite key (Group admin only)
		if (path.match(/^\/api\/groups\/\d+\/invite-key$/) && request.method === "POST") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const groupId = +path.split("/")[3];
		const role = await getGroupRole(groupId, user.id);
		if (role !== "admin") return err("Forbidden", 403);

		const buf = crypto.getRandomValues(new Uint8Array(32));
		const invite_key = Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join("");

		await env.DB.prepare("UPDATE groups SET invite_key = ? WHERE id = ?")
			.bind(invite_key, groupId).run();

		return json({ success: true, invite_key });
		}

		// GET /api/groups/by-key/:key — public lookup, resolves a join key to just
		// enough info to show "Sign in to join [Group Name]" before the visitor
		// has authenticated. Deliberately returns ONLY name + member_count — never
		// id, join_policy, invite_key, or anything else — so a logged-out visitor
		// can't use this to fish for information about a group beyond "does this
		// key point to something real, and what's it called."
		if (path.match(/^\/api\/groups\/by-key\/[0-9a-f]{64}$/) && request.method === "GET") {
			const key = path.split("/")[4];

			const group = await env.DB.prepare(
				"SELECT name, (SELECT COUNT(*) FROM group_members WHERE group_id = groups.id) AS member_count FROM groups WHERE invite_key = ?"
			).bind(key).first();

			if (!group) return err("Invalid or expired join link", 404);

			return json({ name: group.name, member_count: group.member_count });
		}

		// POST /api/groups/join-by-key — auth required. Looks up a group by its
		// invite_key and joins the caller DIRECTLY as a member, bypassing
		// join_policy entirely (open/approval/invite all resolve the same way
		// here) — this is the explicit behavior difference from the existing
		// POST /api/groups/:id/join route, which always respects join_policy.
		// A join-by-key link is meant to function like a direct invite: whoever
		// holds the key is trusted to join immediately, no application step.
		if (path === "/api/groups/join-by-key" && request.method === "POST") {
			const user = await getUser();
			if (!user) return err("Authentication required", 401);

			let body: Record<string, unknown>;

			try {
				body = await readJsonObject(request);
			} catch (error) {
				if (error instanceof ValidationError) {
					return err(error.message, 400);
				}
			
				throw error;
			}
			
			if (typeof body.key !== "string") {
				return err("Invalid join link");
			}

			const key = body.key.trim();

			if (!/^[0-9a-f]{64}$/.test(key)) {
				return err("Invalid join link");
			}

			const group = await env.DB.prepare(
				"SELECT id, name FROM groups WHERE invite_key = ?"
			).bind(key).first();
			if (!group) return err("Invalid or expired join link", 404);

			const groupId = group.id as number;

			const existing = await getGroupRole(groupId, user.id);
			if (existing) {
				return json({ success: true, status: "already_member", group_id: groupId, group_name: group.name });
			}

			await env.DB.prepare(`
				INSERT INTO group_members (group_id, user_id, role)
				VALUES (?, ?, 'member')
			`).bind(groupId, user.id).run();

			// Clean up any stale pending application — joining directly via key
			// supersedes whatever application-flow state may have existed.
			await env.DB.prepare(
				"DELETE FROM group_applications WHERE group_id = ? AND user_id = ? AND status = 'pending'"
			).bind(groupId, user.id).run();

			return json({ success: true, status: "joined", group_id: groupId, group_name: group.name });
		}

		// GET /api/groups/:id/members — member list (members only)
		if (path.match(/^\/api\/groups\/\d+\/members$/) && request.method === "GET") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const groupId = +path.split("/")[3];
		const role = await getGroupRole(groupId, user.id);
		if (!role) return err("Forbidden", 403);

		const { results } = await env.DB.prepare(`
			SELECT
			gm.user_id,
			u.username,
			gm.role,
			gm.tag,
			gm.joined_at
			FROM group_members gm
			JOIN users u ON u.id = gm.user_id
			WHERE gm.group_id = ?
			ORDER BY
			CASE gm.role WHEN 'admin' THEN 0 ELSE 1 END,
			gm.joined_at ASC
		`).bind(groupId).all();

		return json(results);
		}

		// POST /api/groups/:id/join — join or apply to join
		if (path.match(/^\/api\/groups\/\d+\/join$/) && request.method === "POST") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const groupId = +path.split("/")[3];

		// Already a member?
		const existing = await getGroupRole(groupId, user.id);
		if (existing) return err("Already a member of this group");

		const group = await env.DB.prepare(
			"SELECT join_policy, invite_key FROM groups WHERE id = ?"
		).bind(groupId).first();
		if (!group) return err("Group not found", 404);

		const policy = group.join_policy as string;

		// ── Rate limit: max 10 join applications per user per hour ──
		// Only applies to policies that write to group_applications
		// (approval + invite). Open-policy joins go directly to
		// group_members and don't need this limit.
		// Admins are exempt.
		if (!user.is_admin && policy !== "open") {
			const limited = await isRateLimited(
			env.DB,
			"group_applications",
			"user_id",
			"applied_at",
			user.id,
			10,
			"-1 hour",
			);
			if (limited) {
			return err(
				"You have submitted too many join requests recently. Please wait before applying again.",
				429,
			);
			}
		}

		if (policy === "open") {
			await env.DB.prepare(`
			INSERT INTO group_members (group_id, user_id, role)
			VALUES (?, ?, 'member')
			`).bind(groupId, user.id).run();
			// Clean up any stale application row
			await env.DB.prepare(
			"DELETE FROM group_applications WHERE group_id = ? AND user_id = ?"
			).bind(groupId, user.id).run();
			return json({ success: true, status: "joined" });
		}

		if (policy === "approval") {
			try {
				await env.DB.prepare(`
				INSERT INTO group_applications (group_id, user_id, status)
				VALUES (?, ?, 'pending')
				`).bind(groupId, user.id).run();
			} catch {
				return err("You already have a pending application for this group");
			}
			return json({ success: true, status: "pending" });
		}

		if (policy === "invite") {
			let body: Record<string, unknown>;

			try {
				body = await readJsonObject(request);
			} catch (error) {
				if (error instanceof ValidationError) {
					return err(error.message, 400);
				}
			
				throw error;
			}
			if (typeof body.invite_key !== "string") {
				return err(
					"An invite key is required to join this group",
				);
			}

			const provided = body.invite_key.trim();

			if (!provided) {
				return err(
					"An invite key is required to join this group",
				);
			}

			if (provided !== group.invite_key) {
				return err("Invalid invite key");
			}
			
			// Key is valid — create a pending application (still needs admin approval).
			// No pre-delete here: the partial unique index on group_applications
			// (group_id, user_id) WHERE status = 'pending' is what now prevents a
			// duplicate pending row, while still letting past approved/rejected rows
			// accumulate as history.
			try {
				await env.DB.prepare(`
				INSERT INTO group_applications (group_id, user_id, status)
				VALUES (?, ?, 'pending')
				`).bind(groupId, user.id).run();
			} catch {
				return err("You already have a pending application for this group");
			}
			return json({ success: true, status: "pending" });
		}

		return err("Unknown join policy");
		}

		// POST /api/groups/:id/members/:uid/approve — approve application
		if (path.match(/^\/api\/groups\/\d+\/members\/\d+\/approve$/) && request.method === "POST") {
			const user = await getUser();
			if (!user) return err("Authentication required", 401);

			const parts = path.split("/");
			const groupId = +parts[3];
			const targetId = +parts[5];

			const role = await getGroupRole(groupId, user.id);
			if (role !== "admin") return err("Forbidden", 403);

			// With application history now preserved, a (group, user) pair can have
			// multiple past rows — always act on the MOST RECENT one, and update by
			// its specific id, never by (group_id, user_id), so older historical
			// rows are never touched.
			const app = await env.DB.prepare(
				"SELECT id, status FROM group_applications WHERE group_id = ? AND user_id = ? ORDER BY applied_at DESC LIMIT 1"
			).bind(groupId, targetId).first();
			if (!app) return err("Application not found", 404);
			if ((app.status as string) !== "pending") return err("Application is not pending");

			await env.DB.batch([
				env.DB.prepare(
				"UPDATE group_applications SET status = 'approved' WHERE id = ?"
				).bind(app.id as number),
				env.DB.prepare(
				"INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')"
				).bind(groupId, targetId),
			]);

			return json({ success: true });
		}

		// POST /api/groups/:id/members/:uid/reject — reject application
		if (path.match(/^\/api\/groups\/\d+\/members\/\d+\/reject$/) && request.method === "POST") {
			const user = await getUser();
			if (!user) return err("Authentication required", 401);

			const parts = path.split("/");
			const groupId = +parts[3];
			const targetId = +parts[5];

			const role = await getGroupRole(groupId, user.id);
			if (role !== "admin") return err("Forbidden", 403);

			const app = await env.DB.prepare(
				"SELECT id, status FROM group_applications WHERE group_id = ? AND user_id = ? ORDER BY applied_at DESC LIMIT 1"
			).bind(groupId, targetId).first();
			if (!app) return err("Application not found", 404);
			if ((app.status as string) !== "pending") return err("Application is not pending");

			await env.DB.prepare(
				"UPDATE group_applications SET status = 'rejected' WHERE id = ?"
			).bind(app.id as number).run();

			return json({ success: true });
		}

		// PUT /api/groups/:id/members/:uid — update member tag or role
		if (path.match(/^\/api\/groups\/\d+\/members\/\d+$/) && request.method === "PUT") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const parts = path.split("/");
		const groupId = +parts[3];
		const targetId = +parts[5];

		const callerRole = await getGroupRole(groupId, user.id);
		if (callerRole !== "admin") return err("Forbidden", 403);

		let body: Record<string, unknown>;

		try {
			body = await readJsonObject(request);
		} catch (error) {
			if (error instanceof ValidationError) {
				return err(error.message, 400);
			}
		
			throw error;
		}
		const updates: string[] = [];
		const values: unknown[] = [];

		if (body.tag !== undefined) {
			updates.push("tag = ?");
			values.push(body.tag === null ? null : String(body.tag).slice(0, 64));
		}
		if (body.role !== undefined) {
			if (!["admin", "member"].includes(body.role as string))
			return err("Invalid role");
			// Prevent demoting the last admin
			if (body.role === "member") {
			const adminCount = await env.DB.prepare(
				"SELECT COUNT(*) AS n FROM group_members WHERE group_id = ? AND role = 'admin'"
			).bind(groupId).first();
			const targetMember = await env.DB.prepare(
				"SELECT role FROM group_members WHERE group_id = ? AND user_id = ?"
			).bind(groupId, targetId).first();
			if (
				(targetMember?.role as string) === "admin" &&
				((adminCount?.n as number) ?? 0) <= 1
			) {
				return err("Cannot demote the only admin. Promote another member first.");
			}
			}
			updates.push("role = ?");
			values.push(body.role);
		}
		if (!updates.length) return err("Nothing to update");

		// Only a requested demotion needs the admin-count guard.
		const demotingToMember = body.role === "member" ? 1 : 0;
		
		const result = await env.DB.prepare(`
		  UPDATE group_members
		  SET ${updates.join(", ")}
		  WHERE group_id = ?
		    AND user_id = ?
		
		    -- Recheck the caller's authority inside the write.
		    AND EXISTS (
		      SELECT 1
		      FROM group_members AS caller
		      WHERE caller.group_id = ?
		        AND caller.user_id = ?
		        AND caller.role = 'admin'
		    )
		
		    -- Do not demote the final admin.
		    AND (
		      ? = 0
		      OR role <> 'admin'
		      OR (
		        SELECT COUNT(*)
		        FROM group_members AS admins
		        WHERE admins.group_id = ?
		          AND admins.role = 'admin'
		      ) > 1
		    )
		`).bind(
		  ...values,
		  groupId,
		  targetId,
		  groupId,
		  user.id,
		  demotingToMember,
		  groupId,
		).run();
		
		if (result.meta.changes !== 1) {
		  return err(
		    "Member update was not applied. The member or your permissions may have changed, or this would demote the only admin. Refresh and try again.",
		    409,
		  );
		}
		
		return json({ success: true });
		}

		// DELETE /api/groups/:id/members/:uid — leave or remove member
		if (path.match(/^\/api\/groups\/\d+\/members\/\d+$/) && request.method === "DELETE") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const parts = path.split("/");
		const groupId = +parts[3];
		const targetId = +parts[5];

		const callerRole = await getGroupRole(groupId, user.id);
		if (!callerRole) return err("Forbidden", 403);

		const isSelf = user.id === targetId;
		if (!isSelf && callerRole !== "admin") return err("Forbidden", 403);

		// Prevent sole admin from leaving
		const targetMember = await env.DB.prepare(
			"SELECT role FROM group_members WHERE group_id = ? AND user_id = ?"
		).bind(groupId, targetId).first();
		if (!targetMember) return err("Member not found", 404);

		if ((targetMember.role as string) === "admin") {
			const adminCount = await env.DB.prepare(
			"SELECT COUNT(*) AS n FROM group_members WHERE group_id = ? AND role = 'admin'"
			).bind(groupId).first();
			if (((adminCount?.n as number) ?? 0) <= 1) {
			return err(
				isSelf
				? "Cannot leave — you are the only admin. Promote another member first."
				: "Cannot remove the only admin. Promote another member first."
			);
			}
		}

		const result = await env.DB.prepare(`
		  DELETE FROM group_members
		  WHERE group_id = ?
		    AND user_id = ?
		
		    -- The caller must still be a member.
		    -- Admins can remove others; members can only leave themselves.
		    AND EXISTS (
		      SELECT 1
		      FROM group_members AS caller
		      WHERE caller.group_id = ?
		        AND caller.user_id = ?
		        AND (
		          caller.role = 'admin'
		          OR caller.user_id = ?
		        )
		    )
		
		    -- Never remove the final admin through this route.
		    AND (
		      role <> 'admin'
		      OR (
		        SELECT COUNT(*)
		        FROM group_members AS admins
		        WHERE admins.group_id = ?
		          AND admins.role = 'admin'
		      ) > 1
		    )
		`).bind(
		  groupId,
		  targetId,
		  groupId,
		  user.id,
		  targetId,
		  groupId,
		).run();
		
		if (result.meta.changes !== 1) {
		  return err(
		    "Member removal was not applied. The member or your permissions may have changed, or this would remove the only admin. Refresh and try again.",
		    409,
		  );
		}
		
		return json({ success: true });
		}

		// GET /api/groups/:id/members/:uid/progress — fetch a member's progress for Compare
		if (path.match(/^\/api\/groups\/\d+\/members\/\d+\/progress$/) && request.method === "GET") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const parts = path.split("/");
		const groupId = +parts[3];
		const targetId = +parts[5];

		// Caller must be a member
		const callerRole = await getGroupRole(groupId, user.id);
		if (!callerRole) return err("Forbidden", 403);

		// Target must also be a member
		const targetRole = await getGroupRole(groupId, targetId);
		if (!targetRole) return err("Target user is not a member of this group", 403);

		const { results: progressRows } = await env.DB.prepare(
			"SELECT waza_id, markings, like FROM progress WHERE user_id = ?"
		).bind(targetId).all();

		const labelsRow = await env.DB.prepare(
			"SELECT shape_labels FROM users WHERE id = ?"
		).bind(targetId).first();

		const markings: Record<
			number,
			{
				markings: boolean[];
				like: number | null;
			}
		> = {};

		for (const row of progressRows) {
			markings[row.waza_id as number] = {
				markings: parseStoredMarkings(row.markings),
				like:
					row.like === 1 || row.like === -1
						? row.like
						: null,
			};
		}

		const labels = parseStoredLabels(labelsRow?.shape_labels);

		return json({ markings, labels });
		}

		// POST /api/groups/:id/bulk-progress — fetch markings for multiple members at once
		if (path.match(/^\/api\/groups\/\d+\/bulk-progress$/) && request.method === "POST") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const parts = path.split("/");
		const groupId = +parts[3];

		// Caller must be a member
		const callerRole = await getGroupRole(groupId, user.id);
		if (!callerRole) return err("Forbidden", 403);

		let body: Record<string, unknown>;
		
		try {
			body = await readJsonObject(request);
		} catch (error) {
			if (error instanceof ValidationError) {
				return err(error.message, 400);
			}
		
			throw error;
		}

		const submittedUserIds = body.user_ids;

		if (
			!Array.isArray(submittedUserIds) ||
			submittedUserIds.length === 0
		) {
			return err("user_ids must be a non-empty array");
		}

		if (submittedUserIds.length > 10) {
			return err("Maximum 10 users per bulk request");
		}

		if (
			!submittedUserIds.every(
				(id) =>
					Number.isSafeInteger(id) &&
					(id as number) > 0,
			)
		) {
			return err(
				"user_ids must contain only positive integers",
			);
		}

		const userIds = submittedUserIds as number[];

		if (new Set(userIds).size !== userIds.length) {
			return err("user_ids must not contain duplicates");
		}

		// Verify all requested users are members of this group
		const placeholders = userIds.map(() => "?").join(",");
			
		const memberCheck = await env.DB.prepare(
			`SELECT user_id FROM group_members WHERE group_id = ? AND user_id IN (${placeholders})`
		).bind(groupId, ...userIds).all();

		const validIds = new Set(memberCheck.results.map((r: any) => r.user_id));
		const invalidIds = userIds.filter((id: number) => !validIds.has(id));
		if (invalidIds.length > 0) {
			return err(`Users not in group: ${invalidIds.join(", ")}`);
		}

		// Fetch progress for all requested users
		const result: Record<number, { markings: Record<number, boolean[]>; labels: string[] }> = {};

		for (const uid of userIds) {
			const { results: progressRows } = await env.DB.prepare(
			"SELECT waza_id, markings FROM progress WHERE user_id = ?"
			).bind(uid).all();

			const labelsRow = await env.DB.prepare(
			"SELECT shape_labels FROM users WHERE id = ?"
			).bind(uid).first();

			const markings: Record<number, boolean[]> = {};

			for (const row of progressRows) {
				markings[row.waza_id as number] =
					parseStoredMarkings(row.markings);
			}

			const labels = parseStoredLabels(
				labelsRow?.shape_labels,
			);
			
			result[uid] = { markings, labels };
		}

		return json(result);
		}

		// GET /api/groups/:id/applications — pending applications (Group admin only)
		if (path.match(/^\/api\/groups\/\d+\/applications$/) && request.method === "GET") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const groupId = +path.split("/")[3];
		const role = await getGroupRole(groupId, user.id);
		if (role !== "admin") return err("Forbidden", 403);

		const { results } = await env.DB.prepare(`
			SELECT
			ga.id,
			ga.user_id,
			u.username,
			ga.status,
			ga.applied_at
			FROM group_applications ga
			JOIN users u ON u.id = ga.user_id
			WHERE ga.group_id = ? AND ga.status = 'pending'
			ORDER BY ga.applied_at ASC
		`).bind(groupId).all();

		return json(results);
		}

		// GET /api/groups/mine — groups the current user belongs to (for Compare dropdown)
		if (path === "/api/groups/mine" && request.method === "GET") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const { results } = await env.DB.prepare(`
			SELECT
			g.id,
			g.name,
			gm.role
			FROM group_members gm
			JOIN groups g ON g.id = gm.group_id
			WHERE gm.user_id = ?
			ORDER BY gm.joined_at ASC
		`).bind(user.id).all();

		return json(results);
		}

		// GET /api/groups/:id/my-status — caller's relationship to a group (public endpoint, auth optional)
		if (path.match(/^\/api\/groups\/\d+\/my-status$/) && request.method === "GET") {
			const groupId = +path.split("/")[3];
			const user = await getUser();
			if (!user) return json({ status: "guest" });

			const member = await env.DB.prepare(
				"SELECT role FROM group_members WHERE group_id = ? AND user_id = ?"
			).bind(groupId, user.id).first();
			if (member) return json({ status: "member", role: member.role });

			// Look at the user's most recent application for this group. With
			// history now preserved, an old 'approved' row can exist for someone
			// who has since left or been removed — that's not an actionable
			// "applied" state (they have no pending request), so only 'pending'
			// or 'rejected' should be surfaced as status: 'applied' here.
			const app = await env.DB.prepare(
				"SELECT status FROM group_applications WHERE group_id = ? AND user_id = ? ORDER BY applied_at DESC LIMIT 1"
			).bind(groupId, user.id).first();
			if (app && (app.status === "pending" || app.status === "rejected")) {
				return json({ status: "applied", application_status: app.status });
			}

			return json({ status: "none" });
		}

		// GET /api/groups/:id/invite-key — retrieve current invite key (Group admin only)
		if (path.match(/^\/api\/groups\/\d+\/invite-key$/) && request.method === "GET") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const groupId = +path.split("/")[3];
		const role = await getGroupRole(groupId, user.id);
		if (role !== "admin") return err("Forbidden", 403);

		const group = await env.DB.prepare(
			"SELECT join_policy, invite_key FROM groups WHERE id = ?"
		).bind(groupId).first();
		if (!group) return err("Group not found", 404);

		return json({ invite_key: group.invite_key });
		}

		// ── API fallback ───────────────────────────────────────────
		// Unknown API routes and unsupported methods must return JSON,
		// not the SPA shell.
		if (path === "/api" || path.startsWith("/api/")) {
			return err("API route not found", 404);
		}

		// ── SPA fallback ───────────────────────────────────────────
		// Non-API browser routes receive the application shell so
		// client-side routing can reconcile the requested URL.
		const html = await renderHtml(env, request);
		return new Response(html, {
			headers: { "Content-Type": "text/html" },
		});
	},
	/**
	 * @brief Cron-triggered handler. Deletes expired session rows.
	 *
	 * Runs on the schedule defined in wrangler.json's triggers.crons array.
	 * Cloudflare invokes this independently of any HTTP request — there is
	 * no request object, and nothing here is reachable from the public
	 * internet. idx_sessions_expires (migration 0002) keeps this query
	 * fast even as the sessions table grows.
	 *
	 * @param {ScheduledController} controller - Cron metadata (which
	 *   schedule fired, scheduled execution time). Unused here, but part
	 *   of the required signature.
	 * @param {Env} env - Same environment bindings fetch() receives (DB, etc).
	 * @param {ExecutionContext} ctx - Allows extending the Worker's
	 *   lifetime past the handler's return via ctx.waitUntil(), if needed.
	 * @return {Promise<void>}
	 */
	async scheduled(controller, env, ctx) {
		try {
			const result = await env.DB.prepare(
				"DELETE FROM sessions WHERE expires_at < datetime('now')"
			).run();
			console.log(
				"Session cleanup: deleted",
				result.meta.changes,
				"expired session(s)"
			);
		} catch (e) {
			// A failed cleanup run should never crash the cron invocation —
			// log it and let the next scheduled run try again. There is no
			// user-facing request to return an error to here.
			console.error("Session cleanup failed:", e);
		}
	},
} satisfies ExportedHandler<Env>;
