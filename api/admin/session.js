// Who is signed in, plus portal-user management for owners (kept here to stay
// within Vercel's function limit).
//   GET                         -> { authed, user: { name, email, role }, roles }
//   GET ?users=1                (owner) -> { users }
//   POST { action: "invite", name, email, role }       (owner) -> { user, token }
//   POST { action: "link", id }                         (owner) -> new invitation / password-reset link
//   POST { action: "update", id, role?, active? }       (owner)
//   POST { action: "remove", id }                       (owner)
//   GET ?backups=1 · POST { action: "backup", label } · POST { action: "restore", pathname }   (owner)
const crypto = require("crypto");
const A = require("../../lib/auth");
const { readData, writeData, newId, backupData, listBackups, restoreBackup } = require("../../lib/blob-store");

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, lastLoginAt: u.lastLoginAt || null, createdAt: u.createdAt, invitePending: !!(u.invite && u.invite.exp > Date.now()), resetRequestedAt: u.resetRequestedAt || null };
}

module.exports = async function handler(req, res) {
  if (req.method === "GET" && !req.query.users && !req.query.backups) {
    if (!A.readSession(req)) { res.status(200).json({ authed: false }); return; }
    if (!(await A.requireAuth(req, res))) return;
    res.status(200).json({ authed: true, user: req.wnUser, roles: A.ROLES });
    return;
  }
  if (!(await A.requireAuth(req, res, { owner: true }))) return;
  var data = await readData(); data.users = data.users || [];

  if (req.method === "GET" && req.query.backups) {
    res.status(200).json({ backups: await listBackups() });
    return;
  }
  if (req.method === "GET") {
    res.status(200).json({ users: data.users.map(publicUser), roles: A.ROLES, me: req.wnUser });
    return;
  }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }

  var b = req.body || {}, now = new Date().toISOString();
  var token = function (days) { return { token: crypto.randomBytes(24).toString("base64url"), exp: Date.now() + days * 864e5 }; };

  if (b.action === "backup") {
    res.status(200).json(await backupData(b.label || "manual"));
    return;
  }
  if (b.action === "restore") {
    try { res.status(200).json(await restoreBackup(b.pathname)); } catch (e) { res.status(400).json({ error: e.message }); }
    return;
  }
  if (b.action === "invite") {
    var name = String(b.name || "").trim(), email = String(b.email || "").trim().toLowerCase();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: "Enter a name and a valid email" }); return; }
    if (data.users.some(function (u) { return u.email === email; })) { res.status(409).json({ error: "That email already has access" }); return; }
    var u = { id: newId("user"), name: name, email: email, role: A.ROLES[b.role] ? b.role : "planner", status: "invited", tv: 0, invite: token(7), createdAt: now, invitedBy: req.wnUser.name };
    data.users.push(u);
    await writeData(data);
    res.status(201).json({ user: publicUser(u), token: u.invite.token });
    return;
  }

  var target = data.users.find(function (x) { return x.id === b.id; });
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  var self = target.id === req.wnUser.id;

  if (b.action === "link") {
    if (target.status === "deactivated") { res.status(400).json({ error: "Reactivate this person first" }); return; }
    target.invite = token(target.hash ? 2 : 7);
    target.resetRequestedAt = null;
    await writeData(data);
    res.status(200).json({ user: publicUser(target), token: target.invite.token, reset: !!target.hash });
    return;
  }
  if (b.action === "update") {
    if (self) { res.status(400).json({ error: "You can't change your own access" }); return; }
    if (b.role && A.ROLES[b.role]) target.role = b.role; // read on every request, so it applies at once
    if (b.active === false && target.status !== "deactivated") { target.status = "deactivated"; target.invite = null; target.tv = (target.tv || 0) + 1; }
    if (b.active === true && target.status === "deactivated") { target.status = target.hash ? "active" : "invited"; }
    await writeData(data);
    res.status(200).json({ user: publicUser(target) });
    return;
  }
  if (b.action === "remove") {
    if (self) { res.status(400).json({ error: "You can't remove yourself" }); return; }
    data.users = data.users.filter(function (x) { return x.id !== target.id; });
    await writeData(data);
    res.status(200).json({ ok: true });
    return;
  }
  res.status(400).json({ error: "Unknown action" });
};
