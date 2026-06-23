"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SubView = "review" | "settings" | "backoffice";

interface Tour {
  團號: string;
  團名: string;
  出發日期: string;
  天數: string;
}

interface LogEvent {
  日期: string;
  標籤分類: string;
  關聯團號: string;
  關聯人員: string;
  詳細備註: string;
}

export default function QuarterlyLogPage() {
  const [subView, setSubView] = useState<SubView>("review");
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [isDeleting, setIsDeleting] = useState(false);

  // 資料庫資料
  const [tours, setTours] = useState<Tour[]>([]);
  const [logs, setLogs] = useState<LogEvent[]>([]);

  // 🌟 新增：編輯模式的 State 控制
  const [editingLog, setEditingLog] = useState<LogEvent | null>(null);
  const [editFormDate, setEditFormDate] = useState("");
  const [editFormTag, setEditFormTag] = useState("");
  const [editFormTourId, setEditFormTourId] = useState("");
  const [editFormPerson, setEditFormPerson] = useState("");
  const [editFormNotes, setEditFormNotes] = useState("");

  // 建團表單
  const [formTourId, setFormTourId] = useState("");
  const [formTourName, setFormTourName] = useState("富士山三日團");
  const [formCustomActivityName, setFormCustomActivityName] = useState("");
  const [formTourDate, setFormTourDate] = useState("2026-07-08");
  const [formTourDays, setFormTourDays] = useState("3");

  // 日誌事件表單
  const [formLogDate, setFormLogDate] = useState("2026-07-08");
  const [formLogTag, setFormLogTag] = useState("飯店預約");
  const [formLogTourId, setFormLogTourId] = useState("");
  const [formLogPerson, setFormLogPerson] = useState("");
  const [formLogNotes, setFormLogNotes] = useState("");

  // 一覽表篩選器
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterTour, setFilterTour] = useState<string>("all");

  const SHEETDB_URL = "https://sheetdb.io/api/v1/ng85gs3977snc";

  // 抓取全量調度資料
  async function fetchLogSystemData() {
    try {
      setLoading(true);
      const resTours = await fetch(`${SHEETDB_URL}?sheet=團期排程表`, { cache: "no-store" });
      const toursData = await resTours.json();
      setTours(Array.isArray(toursData) ? toursData : []);

      const resLogs = await fetch(`${SHEETDB_URL}?sheet=營運日誌總表`, { cache: "no-store" });
      const logsData = await resLogs.json();
      setLogs(Array.isArray(logsData) ? logsData : []);
    } catch (err) {
      console.error("調度後台讀取失敗:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogSystemData();
  }, []);

  // ==================== [建團功能] ====================
  const handleCreateTour = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTourId.trim()) {
      alert("請輸入團號！");
      return;
    }
    if (formTourName === "日本登山系列團" && !formCustomActivityName.trim()) {
      alert("請輸入確切活動名稱（如：槍岳表銀座）！");
      return;
    }

    try {
      setSyncStatus("saving");
      let finalTourName = formTourName;
      if (formTourName === "日本登山系列團") {
        finalTourName = `日本登山系列團 - ${formCustomActivityName.trim()}`;
      }

      const payload = {
        團號: formTourId.trim().toUpperCase(),
        團名: finalTourName,
        出發日期: formTourDate,
        天數: formTourDays
      };

      const res = await fetch(`${SHEETDB_URL}?sheet=團期排程表`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [payload] })
      });

      if (res.ok) {
        setSyncStatus("success");
        setFormTourId("");
        setFormCustomActivityName("");
        await fetchLogSystemData();
        setSubView("review");
      } else {
        setSyncStatus("error");
      }
    } catch (err) {
      setSyncStatus("error");
    }
  };

  // ==================== [新增日誌功能] ====================
  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formLogNotes.trim()) {
      alert("請填寫詳細工作備註內容！");
      return;
    }
    try {
      setSyncStatus("saving");
      const payload = {
        日期: formLogDate,
        標籤分類: formLogTag,
        關聯團號: formLogTourId,
        關聯人員: formLogPerson.trim(),
        詳細備註: formLogNotes.trim()
      };

      const res = await fetch(`${SHEETDB_URL}?sheet=營運日誌總表`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: [payload] })
      });

      if (res.ok) {
        setSyncStatus("success");
        setFormLogNotes("");
        setFormLogPerson("");
        await fetchLogSystemData();
        setSubView("review");
      } else {
        setSyncStatus("error");
      }
    } catch (err) {
      setSyncStatus("error");
    }
  };

  // ==================== 🌟 [編輯日誌功能] ====================
  const openEditModal = (log: LogEvent) => {
    setEditingLog(log);
    setEditFormDate(log.日期 || "");
    setEditFormTag(log.標籤分類 || "");
    setEditFormTourId(log.關聯團號 || "");
    setEditFormPerson(log.關聯人員 || "");
    setEditFormNotes(log.詳細備註 || "");
  };

  const closeEditModal = () => {
    setEditingLog(null);
  };

  const handleUpdateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog || !editFormNotes.trim()) return;

    try {
      setSyncStatus("saving");
      const payload = {
        日期: editFormDate,
        標籤分類: editFormTag,
        關聯團號: editFormTourId,
        關聯人員: editFormPerson.trim(),
        詳細備註: editFormNotes.trim()
      };

      // 透過原本的「詳細備註」來尋找並覆寫更新那一列
      const res = await fetch(`${SHEETDB_URL}/詳細備註/${encodeURIComponent(editingLog.詳細備註)}?sheet=營運日誌總表`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload })
      });

      if (res.ok) {
        setSyncStatus("success");
        await fetchLogSystemData();
        closeEditModal();
      } else {
        setSyncStatus("error");
        alert("更新失敗，請檢查網路。");
      }
    } catch (err) {
      setSyncStatus("error");
      console.error(err);
    }
  };

  // ==================== 🌟 [刪除日誌功能] ====================
  const handleDeleteLog = async (log: LogEvent) => {
    if (!confirm("確定要刪除這筆工作安排嗎？刪除後無法復原！")) return;

    try {
      setIsDeleting(true);
      setSyncStatus("saving");
      
      const res = await fetch(`${SHEETDB_URL}/詳細備註/${encodeURIComponent(log.詳細備註)}?sheet=營運日誌總表`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSyncStatus("success");
        await fetchLogSystemData();
      } else {
        setSyncStatus("error");
        alert("刪除失敗！");
      }
    } catch (err) {
      setSyncStatus("error");
    } finally {
      setIsDeleting(false);
    }
  };

  // ERP 智慧核心演算法 (鋪設時間軸)
  const generateTimeline = () => {
    const timelineMap: { [dateStr: string]: { activeTours: string[]; events: LogEvent[] } } = {};
    
    let current = new Date("2026-07-08");
    const end = new Date("2026-11-02");
    while (current <= end) {
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, "0");
      const dd = String(current.getDate()).padStart(2, "0");
      const dateKey = `${yyyy}-${mm}-${dd}`;
      timelineMap[dateKey] = { activeTours: [], events: [] };
      current.setDate(current.getDate() + 1);
    }

    tours.forEach((t) => {
      if (!t.出發日期 || !t.天數) return;
      const days = parseInt(t.天數) || 3;
      const startDate = new Date(t.出發日期);
      
      for (let d = 1; d <= days; d++) {
        const loopDate = new Date(startDate);
        loopDate.setDate(startDate.getDate() + (d - 1));
        const y = loopDate.getFullYear();
        const m = String(loopDate.getMonth() + 1).padStart(2, "0");
        const dd = String(loopDate.getDate()).padStart(2, "0");
        const loopKey = `${y}-${m}-${dd}`;
        
        if (timelineMap[loopKey]) {
          timelineMap[loopKey].activeTours.push(`${t.團號} (D${d})`);
        }
      }
    });

    logs.forEach((log) => {
      if (log.日期 && timelineMap[log.日期]) {
        timelineMap[log.日期].events.push(log);
      }
    });

    return Object.entries(timelineMap)
      .map(([date, data]) => ({ date, ...data }))
      .filter((day) => {
        if (filterMonth !== "all") {
          const m = day.date.substring(5, 7);
          if (m !== filterMonth) return false;
        }
        if (filterTour !== "all") {
          const hasTourActive = day.activeTours.some(t => t.startsWith(filterTour));
          const hasTourLogged = day.events.some(e => e.關聯團號 === filterTour);
          if (!hasTourActive && !hasTourLogged) return false;
        }
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center">
        <p className="text-amber-400 text-3xl animate-bounce">🗓️</p>
        <p className="text-emerald-400 font-bold mt-4 animate-pulse">岳野核心 ERP・跨季度調度大腦加載中...</p>
      </div>
    );
  }

  const timelineData = generateTimeline();

  return (
    <main className="min-h-screen bg-stone-100 flex flex-col items-center pb-12 relative">
      {/* 頂部導覽列 */}
      <div className="w-full bg-stone-900 text-white py-4 px-6 sticky top-0 z-20 flex items-center justify-between shadow-lg border-b border-amber-500/40">
        <div>
          <span className="text-[10px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
            Q3-Q4 ERP Control
          </span>
          <h1 className="text-lg font-black text-stone-50 mt-1 tracking-wide">
            {subView === "review" && "🏢 季度工作日誌一覽表"}
            {subView === "settings" && "📝 工作日誌設定 (每日安排)"}
            {subView === "backoffice" && "⚙️ 工作日誌後台 (前期建團)"}
          </h1>
        </div>
        <Link href="/" className="text-stone-900 text-xs font-black bg-amber-400 hover:bg-amber-300 px-4 py-2 rounded-xl transition-all active:scale-95 shadow-md">
          ↩ 回平台首頁
        </Link>
      </div>

      {/* 智慧分頁頁籤 */}
      <div className="w-full max-w-md px-4 mt-4 grid grid-cols-3 gap-1.5">
        <button
          onClick={() => setSubView("review")}
          className={`py-3 text-xs font-black rounded-xl border transition-all text-center ${
            subView === "review"
              ? "bg-stone-900 text-amber-400 border-stone-950 shadow-sm"
              : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
          }`}
        >
          📋 一覽表 Review
        </button>
        <button
          onClick={() => setSubView("settings")}
          className={`py-3 text-xs font-black rounded-xl border transition-all text-center ${
            subView === "settings"
              ? "bg-stone-900 text-amber-400 border-stone-950 shadow-sm"
              : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
          }`}
        >
          📝 日誌設定
        </button>
        <button
          onClick={() => setSubView("backoffice")}
          className={`py-3 text-xs font-black rounded-xl border transition-all text-center ${
            subView === "backoffice"
              ? "bg-stone-900 text-amber-400 border-stone-950 shadow-sm"
              : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
          }`}
        >
          ⚙️ 後台建團
        </button>
      </div>

      {/* 同步連線狀態條 */}
      <div className="w-full max-w-md px-4 mt-3">
        <div className={`text-center py-1 rounded-xl text-[10px] font-bold border ${
          syncStatus === "saving" ? "bg-amber-50 text-amber-800 border-amber-200 animate-pulse" :
          syncStatus === "success" ? "bg-emerald-800 text-emerald-50 border-emerald-700" :
          syncStatus === "error" ? "bg-orange-100 text-orange-800 border-orange-200" : "bg-stone-200 text-stone-500"
        }`}>
          {syncStatus === "saving" && "⏳ 正在與 Google 雲端試算表雙向同步中..."}
          {syncStatus === "success" && "🌲 雲端 ERP 數據已實時更新完畢"}
          {syncStatus === "error" && "❌ 雲端同步失敗，請檢查網路連線"}
          {syncStatus === "idle" && "🌿 岳野營運數據安全對接中 (7/8 - 11/2)"}
        </div>
      </div>

      <div className="w-full max-w-md px-4 mt-4">
        
        {/* ================= 區塊一：季度工作日誌一覽表 (Review) ================= */}
        {subView === "review" && (
          <div className="space-y-4">
            <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-sm space-y-3">
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Advanced Filter Panel</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black text-stone-500 block mb-1 pl-0.5">🗓️ 按月份篩選</label>
                  <select
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="w-full text-xs font-bold border-2 border-stone-200 rounded-xl px-2 py-2 bg-stone-50 text-stone-800 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="all">顯示整個工作季度</option>
                    <option value="07">7 月份 (JUL)</option>
                    <option value="08">8 月份 (AUG)</option>
                    <option value="09">9 月份 (SEP)</option>
                    <option value="10">10 月份 (OCT)</option>
                    <option value="11">11 月份 (NOV)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-stone-500 block mb-1 pl-0.5">🏔️ 按指定團號過濾</label>
                  <select
                    value={filterTour}
                    onChange={(e) => setFilterTour(e.target.value)}
                    className="w-full text-xs font-bold border-2 border-stone-200 rounded-xl px-2 py-2 bg-stone-50 text-stone-800 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="all">全公司所有梯次</option>
                    {tours.map((t) => (
                      <option key={t.團號} value={t.團號}>{t.團號} ({t.團名})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-3.5 pb-10">
              {timelineData.map((day) => {
                const hasSomething = day.activeTours.length > 0 || day.events.length > 0;
                if (!hasSomething) return null;

                return (
                  <div key={day.date} className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
                    <div className="bg-stone-50 border-b border-stone-100 px-4 py-3 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-black text-stone-800 tracking-wide">{day.date}</span>
                        <span className="text-[10px] text-stone-400 font-bold">工作調度</span>
                      </div>
                      
                      {day.activeTours.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {day.activeTours.map((t, idx) => (
                            <span key={idx} className="text-[10px] font-black bg-emerald-700 text-white px-2 py-0.5 rounded-md border border-emerald-800">
                              ⛺ {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-3 space-y-2.5">
                      {day.events.length === 0 ? (
                        <p className="text-[11px] text-stone-400 italic pl-1 py-1">本日尚無新增事件日誌說明</p>
                      ) : (
                        day.events.map((e, idx) => (
                          <div key={idx} className="bg-stone-50/70 border border-stone-200 p-3 rounded-xl space-y-2 relative">
                            {/* 標籤列 */}
                            <div className="flex flex-wrap justify-between items-center gap-1">
                              <div className="flex items-center gap-1.5 pr-14">
                                <span className="text-[10px] font-black bg-amber-400 text-stone-950 px-2 py-0.5 rounded-md">
                                  {e.標籤分類}
                                </span>
                                {e.關聯團號 && (
                                  <span className="text-[10px] font-black bg-stone-800 text-amber-400 px-1.5 py-0.5 rounded-md">
                                    {e.關聯團號}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* 備註內容 */}
                            <div>
                              {e.關聯人員 && (
                                <p className="text-[10px] font-black text-emerald-800 mb-1">
                                  👤 派員：{e.關聯人員}
                                </p>
                              )}
                              <p className="text-xs font-bold text-stone-700 leading-relaxed whitespace-pre-wrap pl-0.5">
                                {e.詳細備註}
                              </p>
                            </div>

                            {/* 🌟 編輯與刪除按鈕 */}
                            <div className="border-t border-stone-200/60 pt-2 mt-1 flex justify-end gap-2">
                              <button 
                                onClick={() => openEditModal(e)}
                                disabled={isDeleting}
                                className="text-[10px] font-black text-stone-500 bg-white border border-stone-200 hover:border-emerald-400 hover:text-emerald-700 px-3 py-1.5 rounded-lg transition-all active:scale-95 shadow-sm"
                              >
                                ✏️ 編輯修改
                              </button>
                              <button 
                                onClick={() => handleDeleteLog(e)}
                                disabled={isDeleting}
                                className="text-[10px] font-black text-stone-500 bg-white border border-stone-200 hover:border-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg transition-all active:scale-95 shadow-sm"
                              >
                                🗑️ 刪除紀錄
                              </button>
                            </div>

                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= 區塊二：工作日誌設定 (每日安排新增) ================= */}
        {subView === "settings" && (
          <form onSubmit={handleCreateLog} className="bg-white border border-stone-200 p-5 rounded-2xl shadow-sm space-y-4">
            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Log Event Factory</p>
            
            <div>
              <label className="text-xs font-black text-stone-700 block mb-1">📅 選擇調度日期 (限 7/8 - 11/2)</label>
              <input
                type="date"
                min="2026-07-08"
                max="2026-11-02"
                value={formLogDate}
                onChange={(e) => setFormLogDate(e.target.value)}
                className="w-full border-2 border-stone-200 rounded-xl px-3 py-2.5 font-bold text-stone-800 focus:outline-none focus:border-emerald-600 bg-stone-50"
              />
            </div>

            <div>
              <label className="text-xs font-black text-stone-700 block mb-1.5">🏷️ 選擇工作分類標籤</label>
              <div className="grid grid-cols-2 gap-1.5">
                {["飯店預約", "活動/交通", "人力排班", "航班狀況", "休假住宿", "團務交接"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setFormLogTag(tag)}
                    className={`py-2 rounded-xl text-xs font-black border transition-all ${
                      formLogTag === tag
                        ? "bg-amber-500 text-stone-950 border-amber-600 shadow-xs"
                        : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-black text-stone-700 block mb-1">🏔️ 關聯團號 (選填)</label>
                <select
                  value={formLogTourId}
                  onChange={(e) => setFormLogTourId(e.target.value)}
                  className="w-full text-xs font-bold border-2 border-stone-200 rounded-xl px-2 py-2.5 bg-stone-50 text-stone-800"
                >
                  <option value="">-- 無關聯團號 --</option>
                  {tours.map((t) => (
                    <option key={t.團號} value={t.團號}>{t.團號}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-black text-stone-700 block mb-1">👤 關聯人員排班 (選填)</label>
                <input
                  type="text"
                  placeholder="例如：小魚、老胡"
                  value={formLogPerson}
                  onChange={(e) => setFormLogPerson(e.target.value)}
                  className="w-full text-xs font-bold border-2 border-stone-200 rounded-xl px-3 py-2 bg-stone-50 text-stone-800 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-stone-700 block mb-1">📝 詳細調度與交接備註 (支援大量文字)</label>
              <textarea
                rows={5}
                placeholder="請輸入當天該標籤項目的具體飯店確認狀況、車輛航班變動或詳細人力交接事項..."
                value={formLogNotes}
                onChange={(e) => setFormLogNotes(e.target.value)}
                className="w-full text-xs font-bold border-2 border-stone-200 rounded-xl px-3 py-2 bg-stone-50 text-stone-800 focus:outline-none focus:border-emerald-600 shadow-inner leading-relaxed"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-stone-900 hover:bg-stone-800 text-amber-400 font-black py-4 rounded-xl shadow-md transition-all active:scale-95 text-center text-sm"
            >
              ➕ 儲存本日事件回傳雲端 ➔
            </button>
          </form>
        )}

        {/* ================= 區塊三：工作日誌後台 (前期獨立建團) ================= */}
        {subView === "backoffice" && (
          <form onSubmit={handleCreateTour} className="bg-white border border-stone-200 p-5 rounded-2xl shadow-sm space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs font-bold text-amber-900 leading-relaxed">
              💡 💡 <b>ERP 前瞻思維防呆：</b><br />
              此處供內勤人員在<b>「尚未有任何客戶報名名單」</b>的前提下，先行完成開團與鋪設行事曆！產品天數將自動連動日誌一覽表的時間軸佔位。
            </div>

            <div>
              <label className="text-xs font-black text-stone-700 block mb-1">🏔️ 創立全新團號</label>
              <input
                type="text"
                placeholder="例如：S1、S2、F1"
                value={formTourId}
                onChange={(e) => setFormTourId(e.target.value)}
                className="w-full border-2 border-stone-200 rounded-xl px-3 py-2.5 font-bold text-stone-800 focus:outline-none focus:border-emerald-600 bg-stone-50 uppercase"
              />
            </div>

            <div>
              <label className="text-xs font-black text-stone-700 block mb-1">🏷️ 產品系列團名</label>
              <select
                value={formTourName}
                onChange={(e) => setFormTourName(e.target.value)}
                className="w-full border-2 border-stone-200 rounded-xl px-3 py-2.5 font-bold text-stone-800 bg-stone-50 focus:outline-none focus:border-emerald-600"
              >
                <option value="富士山三日團">🗻 富士山三日團</option>
                <option value="富士山五日團">🇯🇵 富士山五日團</option>
                <option value="日本登山系列團">🧗 日本登山系列團</option>
              </select>
            </div>

            {formTourName === "日本登山系列團" && (
              <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 mt-2 transition-all">
                <label className="text-xs font-black text-emerald-800 block mb-1">🎯 確切活動名稱 (必填)</label>
                <input
                  type="text"
                  placeholder="例如：槍岳表銀座、北阿爾卑斯健行..."
                  value={formCustomActivityName}
                  onChange={(e) => setFormCustomActivityName(e.target.value)}
                  className="w-full border-2 border-emerald-200 rounded-xl px-3 py-2 font-bold text-stone-800 focus:outline-none focus:border-emerald-600 bg-white"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <div>
                <label className="text-xs font-black text-stone-700 block mb-1">出發日期</label>
                <input
                  type="date"
                  min="2026-07-08"
                  max="2026-11-02"
                  value={formTourDate}
                  onChange={(e) => setFormTourDate(e.target.value)}
                  className="w-full border-2 border-stone-200 rounded-xl px-3 py-2 font-bold text-stone-800 bg-stone-50 text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="text-xs font-black text-stone-700 block mb-1">出團總天數</label>
                <select
                  value={formTourDays}
                  onChange={(e) => setFormTourDays(e.target.value)}
                  className="w-full border-2 border-stone-200 rounded-xl px-3 py-2 font-bold text-stone-800 bg-stone-50 text-xs focus:outline-none focus:border-emerald-600"
                >
                  <option value="3">3 天 (常規行程)</option>
                  <option value="4">4 天</option>
                  <option value="5">5 天</option>
                  <option value="6">6 天</option>
                  <option value="7">7 天</option>
                  <option value="8">8 天</option>
                  <option value="9">9 天</option>
                  <option value="10">10 天</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-black py-4 rounded-xl shadow-md transition-all active:scale-95 text-center text-sm mt-2"
            >
              🚀 成立全新產品梯次並發布 ➔
            </button>
          </form>
        )}

      </div>

      {/* ================= 🌟 [編輯日誌的浮動視窗 Modal] ================= */}
      {editingLog && (
        <div className="fixed inset-0 bg-stone-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="bg-stone-900 text-amber-400 p-4 flex justify-between items-center border-b-2 border-amber-500">
              <span className="font-black tracking-widest text-sm">✏️ 編輯調度日誌</span>
              <button onClick={closeEditModal} className="text-stone-400 hover:text-white text-lg font-black transition-colors">✖</button>
            </div>
            
            <div className="p-5 overflow-y-auto bg-stone-100">
              <form onSubmit={handleUpdateLog} className="space-y-4">
                
                <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm space-y-3">
                  <div>
                    <label className="text-xs font-black text-stone-700 block mb-1">📅 調度日期</label>
                    <input
                      type="date"
                      min="2026-07-08"
                      max="2026-11-02"
                      value={editFormDate}
                      onChange={(e) => setEditFormDate(e.target.value)}
                      className="w-full border-2 border-stone-200 rounded-lg px-3 py-2 font-bold text-stone-800 focus:outline-none focus:border-amber-500 bg-stone-50"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black text-stone-700 block mb-1">🏷️ 標籤分類</label>
                    <select
                      value={editFormTag}
                      onChange={(e) => setEditFormTag(e.target.value)}
                      className="w-full border-2 border-stone-200 rounded-lg px-3 py-2 font-bold text-stone-800 focus:outline-none focus:border-amber-500 bg-stone-50"
                    >
                      <option value="飯店預約">飯店預約</option>
                      <option value="活動/交通">活動/交通</option>
                      <option value="人力排班">人力排班</option>
                      <option value="航班狀況">航班狀況</option>
                      <option value="休假住宿">休假住宿</option>
                      <option value="團務交接">團務交接</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-black text-stone-700 block mb-1">🏔️ 關聯團號</label>
                      <select
                        value={editFormTourId}
                        onChange={(e) => setEditFormTourId(e.target.value)}
                        className="w-full text-xs font-bold border-2 border-stone-200 rounded-lg px-2 py-2 bg-stone-50 text-stone-800"
                      >
                        <option value="">-- 無 --</option>
                        {tours.map((t) => (
                          <option key={t.團號} value={t.團號}>{t.團號}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-black text-stone-700 block mb-1">👤 關聯人員</label>
                      <input
                        type="text"
                        value={editFormPerson}
                        onChange={(e) => setEditFormPerson(e.target.value)}
                        className="w-full text-xs font-bold border-2 border-stone-200 rounded-lg px-3 py-2 bg-stone-50 text-stone-800 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-black text-stone-700 block mb-1">📝 詳細備註</label>
                    <textarea
                      rows={5}
                      value={editFormNotes}
                      onChange={(e) => setEditFormNotes(e.target.value)}
                      className="w-full text-xs font-bold border-2 border-stone-200 rounded-lg px-3 py-2 bg-stone-50 text-stone-800 focus:outline-none focus:border-amber-500 shadow-inner"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="w-1/3 bg-stone-300 hover:bg-stone-400 text-stone-700 font-black py-3.5 rounded-xl shadow-sm transition-all"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black py-3.5 rounded-xl shadow-md transition-all active:scale-95 border border-amber-600/50"
                  >
                    💾 儲存修改
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
