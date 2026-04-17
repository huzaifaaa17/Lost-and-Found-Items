const el = (id) => document.getElementById(id);

const authEmail = el("authEmail");
const authPassword = el("authPassword");
const btnSignUp = el("btnSignUp");
const btnLogin = el("btnLogin");
const btnLogout = el("btnLogout");
const userInfo = el("userInfo");
const authMsg = el("authMsg");

const itemType = el("itemType");
const itemTitle = el("itemTitle");
const itemDescription = el("itemDescription");
const itemCategory = el("itemCategory");
const itemLocation = el("itemLocation");
const itemContactEmail = el("itemContactEmail");
const btnCreate = el("btnCreate");
const createMsg = el("createMsg");

const q = el("q");
const filterType = el("filterType");
const filterStatus = el("filterStatus");
const filterCategory = el("filterCategory");
const btnApply = el("btnApply");
const btnClear = el("btnClear");
const btnRefresh = el("btnRefresh");

const list = el("list");
const listMsg = el("listMsg");

function setMsg(node, text, kind = "") {
  node.className = "msg " + (kind || "");
  node.textContent = text || "";
}

function badge(text, cls) {
  return `<span class="badge ${cls || ""}">${escapeHtml(text)}</span>`;
}

function escapeHtml(s) {
  return (s ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function refreshAuthUI() {
  const { data: { user } } = await window.sb.auth.getUser();

  if (user) {
    userInfo.textContent = `Logged in: ${user.email}`;
    btnLogout.classList.remove("hidden");
    btnCreate.disabled = false;
  } else {
    userInfo.textContent = "Not logged in";
    btnLogout.classList.add("hidden");
    btnCreate.disabled = true;
  }
}

/**
 * IMPORTANT (Email confirm redirect fix):
 * We set emailRedirectTo to the current site origin so Supabase confirmation links
 * return to the same place you are running the app (e.g., http://localhost:5500).
 *
 * You must ALSO add this URL in Supabase:
 * Dashboard -> Authentication -> URL Configuration -> Redirect URLs
 */
function getEmailRedirectTo() {
  // Usually enough:
  // - http://localhost:5500
  // - http://localhost:5173
  // - https://yourdomain.com
  return window.location.origin;
}

btnSignUp.addEventListener("click", async () => {
  setMsg(authMsg, "");
  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || !password) return setMsg(authMsg, "Email and password are required.", "err");

  const { error } = await window.sb.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getEmailRedirectTo()
    }
  });

  if (error) return setMsg(authMsg, error.message, "err");

  setMsg(authMsg, "Sign-up success. Check your email to confirm (if enabled).", "ok");
  await refreshAuthUI();
});

btnLogin.addEventListener("click", async () => {
  setMsg(authMsg, "");
  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || !password) return setMsg(authMsg, "Email and password are required.", "err");

  const { error } = await window.sb.auth.signInWithPassword({ email, password });
  if (error) return setMsg(authMsg, error.message, "err");

  setMsg(authMsg, "Logged in.", "ok");
  await refreshAuthUI();
  await loadItems();
});

btnLogout.addEventListener("click", async () => {
  await window.sb.auth.signOut();
  setMsg(authMsg, "Logged out.", "ok");
  await refreshAuthUI();
  await loadItems();
});

btnCreate.addEventListener("click", async () => {
  setMsg(createMsg, "");
  const { data: { user } } = await window.sb.auth.getUser();
  if (!user) return setMsg(createMsg, "Please log in first.", "err");

  const payload = {
    user_id: user.id,
    type: itemType.value,
    title: itemTitle.value.trim(),
    description: itemDescription.value.trim(),
    category: itemCategory.value || null,
    location: itemLocation.value.trim() || null,
    contact_email: itemContactEmail.value.trim() || null,
    status: "open",
  };

  if (!payload.title) return setMsg(createMsg, "Title is required.", "err");

  const { error } = await window.sb.from("items").insert(payload);
  if (error) return setMsg(createMsg, error.message, "err");

  setMsg(createMsg, "Post published.", "ok");
  itemTitle.value = "";
  itemDescription.value = "";
  itemLocation.value = "";
  itemContactEmail.value = "";
  itemCategory.value = "";

  await loadItems();
});

btnApply.addEventListener("click", loadItems);
btnRefresh.addEventListener("click", loadItems);

btnClear.addEventListener("click", async () => {
  q.value = "";
  filterType.value = "";
  filterStatus.value = "";
  filterCategory.value = "";
  await loadItems();
});

function buildQuery() {
  let query = window.sb.from("items").select("*").order("created_at", { ascending: false });

  if (filterType.value) query = query.eq("type", filterType.value);
  if (filterStatus.value) query = query.eq("status", filterStatus.value);
  if (filterCategory.value) query = query.eq("category", filterCategory.value);

  const term = q.value.trim();
  if (term) {
    const t = term.replaceAll(",", "");
    query = query.or(`title.ilike.%${t}%,description.ilike.%${t}%,location.ilike.%${t}%`);
  }

  return query;
}

async function loadItems() {
  setMsg(listMsg, "Loading...");
  list.innerHTML = "";

  const { data, error } = await buildQuery();
  if (error) {
    setMsg(listMsg, error.message, "err");
    return;
  }

  setMsg(listMsg, data.length ? "" : "No posts found.", data.length ? "" : "");
  const { data: { user } } = await window.sb.auth.getUser();

  list.innerHTML = data.map((it) => renderItem(it, user)).join("");

  // smooth reveal effect
  [...list.children].forEach((node, i) => {
    node.classList.add("fade-in");
    node.style.animationDelay = `${Math.min(i * 35, 220)}ms`;
  });

  wireItemActions();
}

function renderItem(it, user) {
  const isOwner = user?.id === it.user_id;
  const created = new Date(it.created_at).toLocaleString();

  return `
    <article class="item" data-id="${it.id}">
      <div class="top">
        <div>
          <h3 style="margin:0 0 4px;">${escapeHtml(it.title)}</h3>
          <div class="muted small">${escapeHtml(created)}</div>
        </div>
        <div class="badges">
          ${badge(it.type, it.type)}
          ${badge(it.status, it.status)}
          ${it.category ? badge(it.category, "") : ""}
        </div>
      </div>

      ${it.location ? `<div class="muted">Location: ${escapeHtml(it.location)}</div>` : ""}
      ${it.description ? `<p>${escapeHtml(it.description)}</p>` : ""}

      ${it.contact_email ? `<div class="muted small">Contact: ${escapeHtml(it.contact_email)}</div>` : ""}

      <div class="actions">
        ${isOwner ? `
          <button class="btn secondary action-toggle">
            Mark ${it.status === "open" ? "resolved" : "open"}
          </button>
          <button class="btn danger action-delete">Delete</button>
        ` : `
          <span class="muted small">Login as the owner to manage this post.</span>
        `}
      </div>
    </article>
  `;
}

function wireItemActions() {
  document.querySelectorAll(".action-toggle").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const article = e.target.closest(".item");
      const id = article.dataset.id;

      const statusBadge = article.querySelector(".badge.open, .badge.resolved");
      const current = statusBadge?.textContent?.trim() || "open";
      const next = current === "open" ? "resolved" : "open";

      const { error } = await window.sb.from("items").update({ status: next }).eq("id", id);
      if (error) return setMsg(listMsg, error.message, "err");

      await loadItems();
    });
  });

  document.querySelectorAll(".action-delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const article = e.target.closest(".item");
      const id = article.dataset.id;

      if (!confirm("Delete this post?")) return;

      const { error } = await window.sb.from("items").delete().eq("id", id);
      if (error) return setMsg(listMsg, error.message, "err");

      await loadItems();
    });
  });
}

window.sb.auth.onAuthStateChange(() => {
  refreshAuthUI();
});

// initial
(async function init() {
  await refreshAuthUI();
  await loadItems();
})();