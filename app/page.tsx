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

  // 防止 Next.js 伺服器端與客戶端渲染不一致的防呆機制
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

      // 連線到 Google 試算表的「系統設定」分頁
      const res = await fetch(`${SHEETDB_URL}?sheet=系統設定`, { cache: "no-store" });
      const users = await res.json();

      if (!Array.isArray(users)) {
        setError("❌ 系統連線異常，請稍後再試！");
        return;
      }

      // 檢查匹配的帳號與密碼，並自動清除空格防呆
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
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-slate-400 font-bold">⏳ 系統載入中...</p>
      </div>
    );
  }

  // ================= 狀況一：尚未登入 =================
  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm bg-white p-8 rounded-3xl shadow-xl text-center space-y-6">
          <div>
            <span className="text-4xl">🏔️</span>
            <h1 className="text-2xl font-black text-slate-800 mt-3">岳野登山公司</h1>
            <p className="text-sm font-bold text-slate-500 mt-1">嚮導工作平台 - 登入系統</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1 pl-1">嚮導帳號</label>
              <input
                type="text"
                placeholder="輸入帳號"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 font-bold focus:outline-none focus:border-blue-500 transition-all bg-slate-50"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1 pl-1">專屬密碼</label>
              <input
                type="password"
                placeholder="輸入密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full border-2 border-slate-200 rounded-2xl px-4 py-3 font-bold focus:outline-none focus:border-blue-500 transition-all bg-slate-50"
              />
            </div>

            {error && <p className="text-sm font-bold text-red-500 text-center">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl shadow-md active:scale-95 transition-all text-center disabled:bg-slate-400"
            >
              {loading ? "⏳ 雲端安全驗證中..." : "安全登入 ➔"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // ================= 狀況二：登入成功 (主功能選單) =================
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white p-6 rounded-3xl shadow-md border border-slate-200 space-y-6 text-center">
        <div>
          <span className="text-3xl">🥾</span>
          <h1 className="text-xl font-black text-slate-800 mt-2">岳野嚮導平台</h1>
          <p className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full inline-block mt-1">
            🔒 歡迎回來，雲端驗證成功
          </p>
        </div>

        {/* 🌟 依您的要求改版的三大系列出團選單 */}
        <div className="flex flex-col gap-3">
          
          {/* 1. 富士山三日團 入口 */}
          <Link
            href="/three-days"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-sm active:scale-[0.98] transition-all text-center block text-base"
          >
            🗻 前往「富士山三日團」
          </Link>
          
          {/* 2. 富士山五日團 入口 */}
          <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-center relative overflow-hidden group">
            <span className="text-slate-700 font-bold text-base block opacity-60">
              🇯🇵 富士山五日團
            </span>
            <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-bold inline-block mt-1">
              🔒 系統規劃中
            </span>
          </div>

          {/* 3. 日本登山系列團 入口 */}
          <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 px-4 text-center relative overflow-hidden group">
            <span className="text-slate-700 font-bold text-base block opacity-60">
              🥾 日本登山系列團
            </span>
            <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full font-bold inline-block mt-1">
              🔒 系統規劃中
            </span>
          </div>

        </div>

        <div className="border-t border-slate-100 pt-4">
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-slate-600 text-xs font-bold transition-all"
          >
            登出系統 ↩
          </button>
        </div>
      </div>
    </main>
  );
}
