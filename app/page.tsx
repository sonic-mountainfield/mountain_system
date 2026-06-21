"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function HomePage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isClient, setIsClient] = useState(false);

  const SHEETDB_URL = "https://sheetdb.io/api/v1/ng85gs3977snc";

  useEffect(() => {
    setIsClient(true);
    const loginStatus = localStorage.getItem("yuenor_login");
    if (loginStatus === "true") {
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("❌ 請填寫帳號與密碼！");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${SHEETDB_URL}?sheet=系統設定`, { cache: "no-store" });
      const users = await res.json();

      if (!Array.isArray(users)) {
        setError("❌ 系統連線異常，請稍後再試！");
        return;
      }

      const matchedUser = users.find(
        (u: any) =>
          String(u.帳號 || "").trim() === username.trim() &&
          String(u.密碼 || "").trim() === password.trim()
      );

      if (matchedUser) {
        localStorage.setItem("yuenor_login", "true");
        localStorage.setItem("yuenor_user_name", String(matchedUser.導遊姓名 || matchedUser.帳號));
        setIsLoggedIn(true);
        setError("");
      } else {
        setError("❌ 帳號或密碼錯誤，請重新輸入！");
      }
    } catch (err) {
      console.error("登入驗證出錯:", err);
      setError("❌ 無法連線至雲端驗證系統！");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("yuenor_login");
    localStorage.removeItem("yuenor_user_name");
    setIsLoggedIn(false);
    setUsername("");
    setPassword("");
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center">
        <p className="text-emerald-400 font-bold animate-pulse">🌲 岳野山林系統載入中...</p>
      </div>
    );
  }

  // ================= 🌲 森林系登入畫面 (狀況一) =================
  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-emerald-950 via-emerald-900 to-stone-900 flex flex-col items-center justify-center px-6 relative overflow-hidden">
        {/* 背景裝飾小樹 */}
        <div className="absolute -bottom-10 -left-10 text-9xl opacity-10 select-none">🌲</div>
        <div className="absolute -top-10 -right-10 text-9xl opacity-10 select-none">🏔️</div>

        <div className="w-full max-w-sm bg-stone-900/80 backdrop-blur-md p-8 rounded-3xl shadow-2xl border-2 border-emerald-800/40 text-center space-y-6">
          <div>
            <span className="text-5xl inline-block drop-shadow-md animate-bounce">🏔️</span>
            <h1 className="text-2xl font-black text-emerald-100 mt-3 tracking-wide drop-shadow">岳野登山公司</h1>
            <p className="text-xs font-bold text-emerald-400/80 tracking-widest mt-1">YUENOR MOUNTAIN SYSTEM</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-black text-emerald-400 block mb-1.5 pl-1 tracking-wider">嚮導帳號</label>
              {/* 💡 修正：背景改為墨綠黑，字體直接改為純白高對比度 (text-white)，框線強化 */}
              <input
                type="text"
                placeholder="請輸入帳號"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="w-full border-2 border-emerald-800/60 rounded-2xl px-4 py-3.5 font-bold text-white placeholder-emerald-700/70 focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-900/50 transition-all bg-stone-950 text-base"
              />
            </div>

            <div>
              <label className="text-xs font-black text-emerald-400 block mb-1.5 pl-1 tracking-wider">專屬密碼</label>
              {/* 💡 修正：同樣修正密碼框的對比度，輸入字體為亮白 */}
              <input
                type="password"
                placeholder="請輸入密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full border-2 border-emerald-800/60 rounded-2xl px-4 py-3.5 font-bold text-white placeholder-emerald-700/70 focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-900/50 transition-all bg-stone-950 text-base"
              />
            </div>

            {error && <p className="text-sm font-bold text-orange-400 text-center drop-shadow-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-emerald-950/50 active:scale-95 transition-all text-center disabled:bg-stone-700 disabled:text-stone-500 text-base tracking-wider"
            >
              {loading ? "⏳ 雲端安全驗證中..." : "🌲 進入嚮導工作台 ➔"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ================= 🌲 森林系主功能選單 (狀況二) =================
  return (
    <main className="min-h-screen bg-gradient-to-b from-stone-100 to-emerald-50/40 flex flex-col items-center justify-center p-6 relative">
      <div className="w-full max-w-sm bg-white p-6 rounded-3xl shadow-xl border border-emerald-100 space-y-6 text-center">
        <div>
          <span className="text-4xl inline-block drop-shadow">🥾</span>
          <h1 className="text-2xl font-black text-stone-800 mt-2">岳野嚮導平台</h1>
          <p className="text-xs font-bold text-emerald-700 bg-emerald-100/70 px-4 py-1.5 rounded-full inline-block mt-2 border border-emerald-200">
            🌲 歡迎回來，雲端驗證成功
          </p>
        </div>

        <div className="flex flex-col gap-3.5 pt-2">
          
          {/* 1. 富士山三日團 */}
          <Link
            href="/three-days"
            className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-md shadow-emerald-900/10 active:scale-[0.98] transition-all text-center block text-base tracking-wide"
          >
            🏔️ 前往「富士山三日團」
          </Link>
          
          {/* 2. 富士山五日團 */}
          <div className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 px-4 text-center relative overflow-hidden">
            <span className="text-stone-700 font-extrabold text-base block opacity-40">
              🇯🇵 富士山五日團
            </span>
            <span className="text-[10px] bg-stone-200 text-stone-500 px-2.5 py-0.5 rounded-full font-bold inline-block mt-1">
              🔒 系統規劃中
            </span>
          </div>

          {/* 3. 日本登山系列團 */}
          <div className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-4 px-4 text-center relative overflow-hidden">
            <span className="text-stone-700 font-extrabold text-base block opacity-40">
              🧗 日本登山系列團
            </span>
            <span className="text-[10px] bg-stone-200 text-stone-500 px-2.5 py-0.5 rounded-full font-bold inline-block mt-1">
              🔒 系統規劃中
            </span>
          </div>

        </div>

        <div className="border-t border-stone-100 pt-4">
          <button
            onClick={handleLogout}
            className="text-stone-400 hover:text-orange-600 hover:bg-orange-50 px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
          >
            登出系統 ↩
          </button>
        </div>
      </div>
    </main>
  );
}
