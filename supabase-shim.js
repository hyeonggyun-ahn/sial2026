/* ===========================================================
   Supabase 어댑터 — 앱이 쓰던 claude.use(...) 인터페이스를
   그대로 흉내 내서, 앱 본문은 한 줄도 고치지 않게 한다.
   =========================================================== */
(function(){
"use strict";
const CFG = window.SIAL_CONFIG || {};
let sb = null, session = null, myName = "";

/* ---------- 로그인 화면 ---------- */
function authScreen(msg, mode){
  mode = mode || "in";
  const el = document.createElement("div");
  el.id = "authwrap";
  el.innerHTML =
    '<div class="authbox">'
    + '<img src="sempio.png" alt="샘표" class="authci">'
    + '<div class="authbrand">SEMPIO</div>'
    + '<h1>SIAL Paris 2026</h1>'
    + '<p class="authsub">부스 노트 · 우리맛연구1팀</p>'
    + (msg ? '<p class="autherr">' + msg + '</p>' : '')
    + '<input id="aemail" type="email" inputmode="email" autocapitalize="none" '
    +   'autocomplete="username" placeholder="회사 이메일">'
    + '<input id="apw" type="password" autocomplete="current-password" placeholder="비밀번호">'
    + (mode === "up" ? '<input id="aname" placeholder="이름 (예: 안형균)">' : '')
    + '<button class="authbtn" id="ago">' + (mode === "up" ? "가입하고 시작" : "로그인") + '</button>'
    + '<button class="authlink" id="aswap">'
    +   (mode === "up" ? "이미 계정이 있습니다 — 로그인" : "처음이신가요? 가입하기")
    + '</button>'
    + '</div>';
  document.body.appendChild(el);
  const go = () => submit(mode);
  document.getElementById("ago").onclick = go;
  document.getElementById("apw").addEventListener("keydown", e => { if (e.key === "Enter") go(); });
  document.getElementById("aswap").onclick = () => {
    el.remove(); authScreen("", mode === "up" ? "in" : "up");
  };
}
async function submit(mode){
  const email = (document.getElementById("aemail").value || "").trim();
  const pw    = document.getElementById("apw").value || "";
  const nm    = mode === "up" ? (document.getElementById("aname").value || "").trim() : "";
  if (!email || !pw) return redo("이메일과 비밀번호를 입력해 주세요.", mode);
  if (mode === "up" && !nm) return redo("이름을 입력해 주세요.", mode);
  const btn = document.getElementById("ago");
  btn.disabled = true; btn.textContent = "처리 중…";
  try{
    const r = mode === "up"
      ? await sb.auth.signUp({ email, password: pw, options:{ data:{ name: nm } } })
      : await sb.auth.signInWithPassword({ email, password: pw });
    if (r.error) throw r.error;
    if (!r.data || !r.data.session)
      return redo("메일함에서 인증 링크를 눌러 주신 뒤 다시 로그인해 주세요.", "in");
    location.reload();
  }catch(err){
    redo(friendly(err), mode);
  }
}
function friendly(e){
  const m = (e && e.message || "").toLowerCase();
  if (m.includes("invalid login"))     return "이메일 또는 비밀번호가 맞지 않습니다.";
  if (m.includes("already registered"))return "이미 가입된 이메일입니다. 로그인해 주세요.";
  if (m.includes("signups not allowed"))return "가입이 닫혀 있습니다. 관리자에게 계정을 요청하세요.";
  if (m.includes("password"))          return "비밀번호는 6자 이상이어야 합니다.";
  if (m.includes("fetch") || m.includes("network")) return "네트워크에 연결되지 않았습니다.";
  return (e && e.message) || "로그인하지 못했습니다.";
}
function redo(msg, mode){
  const w = document.getElementById("authwrap"); if (w) w.remove();
  authScreen(msg, mode);
}

/* ---------- db : 앱이 쓰는 doc/collection 흉내 ---------- */
function mkDB(){
  const uid = () => session && session.user && session.user.id;
  function docRef(path){
    const seg = path.split("/");
    return {
      async get(){
        if (seg[0] === "notes"){
          const { data } = await sb.from("notes").select("data").eq("user_id", seg[1]).maybeSingle();
          return { exists: !!data, data: () => (data && data.data) || {} };
        }
        const { data } = await sb.from("config").select("value").eq("key", seg[1]).maybeSingle();
        return { exists: !!data, data: () => (data && data.value) || {} };
      },
      async set(obj){
        if (seg[0] === "notes"){
          const { error } = await sb.from("notes")
            .upsert({ user_id: uid(), name: myName, data: obj, updated_at: new Date().toISOString() },
                    { onConflict: "user_id" });
          if (error) throw error;
        } else {
          const { error } = await sb.from("config")
            .upsert({ key: seg[1], value: obj, updated_at: new Date().toISOString() },
                    { onConflict: "key" });
          if (error) throw error;
        }
      },
      onSnapshot(cb){                       /* 주기적으로 다시 읽어 전달 */
        const tick = async () => { try{ cb(await docRef(path).get()); }catch(e){} };
        tick(); const t = setInterval(tick, 60000);
        return () => clearInterval(t);
      }
    };
  }
  return {
    doc: docRef,
    collection(name){
      return { limit(){ return this; },
        async get(){
          if (name !== "notes") return { docs: [] };
          const { data } = await sb.from("notes").select("user_id,name,data");
          window.__names = {};
          (data || []).forEach(r => { window.__names[r.user_id] = { name: r.name || "팀원" }; });
          return { docs: (data || []).map(r => ({ id: r.user_id, exists: true, data: () => r.data || {} })) };
        } };
    }
  };
}

/* ---------- user ---------- */
function mkUser(){
  const u = session.user;
  return {
    async id(){ return u.id; },
    async me(){ return { id: u.id, name: myName || u.email }; },
    async can(){ return true; },
    async profiles(ids){
      const out = {}; const n = window.__names || {};
      (ids || []).forEach(i => { out[i] = { name: (n[i] && n[i].name) || "팀원" }; });
      return out;
    }
  };
}

/* ---------- assets : 사진 ---------- */
function mkAssets(){
  const uid = session.user.id;
  return {
    async upload(blob){
      const key = uid + "/" + Date.now() + "-" + Math.random().toString(36).slice(2,8) + ".jpg";
      const { error } = await sb.storage.from("photos").upload(key, blob, { contentType: "image/jpeg" });
      if (error){ const e = new Error(error.message);
        e.code = /exceed|size|large/i.test(error.message) ? "too_large" : "unavailable"; throw e; }
      return { id: key };
    },
    async list(){ return { usage: null }; },
    async delete(key){ await sb.storage.from("photos").remove([key]); }
  };
}

/* ---------- 부팅 ---------- */
window.claude = {
  use(name){
    if (!session) return Promise.resolve(null);
    if (name === "db")     return Promise.resolve(mkDB());
    if (name === "user")   return Promise.resolve(mkUser());
    if (name === "assets") return Promise.resolve(mkAssets());
    return Promise.resolve(null);              /* downloads 는 앱이 자체 폴백 */
  },
  /* 사진 주소 — 비공개 보관함이라 서명 URL이 필요하다 */
  async blobURL(key){
    try{ const { data } = await sb.storage.from("photos").createSignedUrl(key, 60*60*6);
         return (data && data.signedUrl) || null; }catch(e){ return null; }
  },
  async signOut(){ await sb.auth.signOut(); location.reload(); }
};

window.SIAL_BOOT = (async function(){
  if (!CFG.url || !CFG.anon || CFG.anon.indexOf("PASTE_") === 0){
    document.body.innerHTML = '<p style="padding:40px;font:15px system-ui">'
      + 'config.js 에 Supabase 주소와 anon 키를 넣어 주세요.</p>';
    return false;
  }
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  sb = createClient(CFG.url, CFG.anon, { auth:{ persistSession:true, autoRefreshToken:true } });
  const { data } = await sb.auth.getSession();
  session = data && data.session;
  if (!session){ authScreen(); return false; }
  myName = (session.user.user_metadata && session.user.user_metadata.name) || session.user.email;
  return true;
})();
})();
