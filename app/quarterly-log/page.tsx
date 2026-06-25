"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// 擴充 View 狀態
type SubView = "my-schedule" | "review" | "settings" | "backoffice" | "print";

interface Tour {
  團號: string;
  團名: string;
  出發日期: string;
  天數: string;
  負責嚮導1?: string;
  負責嚮導2?: string;
  負責嚮導3?: string;
}

interface LogEvent {
  日誌ID?: string;
  日期: string;
  標籤分類: string;
  關聯團號: string;
  關聯人員: string;
  詳細備註: string;
}

export default function QuarterlyLogPage() {
  const [subView, setSubView] = useState<SubView>("my-schedule");
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [isDeleting, setIsDeleting] = useState(false);

  // 本地用戶權限與姓名資訊
  const [userRole, setUserRole] = useState("guide");
  const [currentUserName, setCurrentUserName] = useState("");

  // 資料庫資料
  const [tours, setTours] = useState<Tour[]>([]);
  const [logs, setLogs] = useState<LogEvent[]>([]);

  // 編輯模式的 State 控制
  const [editingLog, setEditingLog] = useState<LogEvent | null>(null);
  const [editFormDate, setEditFormDate] = useState("");
  const [editFormTag, setEditFormTag] = useState("");
  const [editFormFlightDir, setEditFormFlightDir] = useState("IN");
  const [editFormTourId, setEditFormTourId] = useState("");
  const [editFormPerson, setEditFormPerson] = useState("");
  const [editFormNotes, setEditFormNotes] = useState("");

  // 建團表單
  const [formTourId, setFormTourId] = useState("");
  const [formTourName, setFormTourName] = useState("富士山三日團");
  const [formCustomActivityName, setFormCustomActivityName] = useState("");
  const [formTourDate, setFormTourDate] = useState("2026-07-08");
  const [formTourDays, setFormTourDays] = useState("3");
  const [formTourGuide1, setFormTourGuide1] = useState("");
  const [formTourGuide2, setFormTourGuide2] = useState("");
  const [formTourGuide3, setFormTourGuide3] = useState("");

  // 日誌事件表單
  const [formLogDate, setFormLogDate] = useState("2026-07-08");
  const [formLogTag, setFormLogTag] = useState("飯店預約");
  const [formLogFlightDir, setFormLogFlightDir] = useState("IN");
  const [formLogTourId, setFormLogTourId] = useState("");
  const [formLogPerson, setFormLogPerson] = useState("");
  const [formLogNotes, setFormLogNotes] = useState("");

  // 篩選器
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterTour, setFilterTour] = useState<string>("all");

  // 🖨️ 報表列印專用篩選控制
  const [printType, setPrintType] = useState<"tour" | "date">("tour");
  const [printTourId, setPrintTourId] = useState("");
  const [printStartDate, setPrintStartDate] = useState("2026-07-08");
  const [printEndDate, setPrintEndDate] = useState("2026-07-15");

  const SHEETDB_URL = "https://sheetdb.io/api/v1/ng85gs3977snc";

  // 抓取全量調度資料
  async function fetchLogSystemData() {
    try {
      setLoading(true);
      const savedRole = localStorage.getItem("yuenor_role") || "guide";
      const savedName = localStorage.getItem("yuenor_user_name") || "嚮導";
      setUserRole(savedRole);
      setCurrentUserName(savedName);
      
      if (savedRole !== "admin" && (subView === "backoffice" || subView === "settings" || subView === "print")) {
        setSubView("my-schedule");
      }

      const resTours = await fetch(`${SHEETDB_URL}?sheet=團期排程表`, { cache: "no-store" });
      const toursData = await resTours.json();
      const validTours = Array.isArray(toursData) ? toursData : [];
      setTours(validTours);
      if (validTours.length > 0 && !printTourId) {
        setPrintTourId(validTours[0].團號);
      }

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

  const handleCreateTour = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== "admin") return;
    if (!formTourId.trim()) {
      alert("請輸入團號！");
      return;
    }
    if (formTourName === "日本登山系列團" && !formCustomActivityName.trim()) {
      alert("請輸入確切活動名稱！");
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
        天數: formTourDays,
        負責嚮導1: formTourGuide1.trim(),
        負責嚮導2: formTourGuide2.trim(),
        負責嚮導3: formTourGuide3.trim()
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
        setFormTourGuide1("");
        setFormTourGuide2("");
        setFormTourGuide3("");
        await fetchLogSystemData();
        setSubView("review");
      } else {
        setSyncStatus("error");
      }
    } catch (err) {
      setSyncStatus("error");
    }
  };

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== "admin") return;
    if (!formLogNotes.trim()) {
      alert("請填寫詳細工作備註內容！");
      return;
    }
    try {
      setSyncStatus("saving");
      let finalTag = formLogTag;
      if (formLogTag === "航班狀況") {
        finalTag = `航班狀況-${formLogFlightDir}`;
      }

      const payload = {
        日誌ID: Date.now().toString(),
        日期: formLogDate,
        標籤分類: finalTag,
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

  const openEditModal = (log: LogEvent) => {
    if (userRole !== "admin") return;
    setEditingLog(log);
    setEditFormDate(log.日期 || "");
    let baseTag = log.標籤分類 || "";
    let fDir = "IN";
    if (baseTag.startsWith("航班狀況-")) {
      fDir = baseTag.split("-")[1];
      baseTag = "航班狀況";
    }
    setEditFormTag(baseTag);
    setEditFormFlightDir(fDir);
    setEditFormTourId(log.關聯團號 || "");
    setEditFormPerson(log.關聯人員 || "");
    setEditFormNotes(log.詳細備註 || "");
  };

  const closeEditModal = () => {
    setEditingLog(null);
  };

  const handleUpdateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== "admin") return;
    if (!editingLog || !editFormNotes.trim()) return;

    try {
      setSyncStatus("saving");
      let finalTag = editFormTag;
      if (editFormTag === "航班狀況") {
        finalTag = `航班狀況-${editFormFlightDir}`;
      }

      const payload = {
        日誌ID: editingLog.日誌ID || "",
        日期: editFormDate,
        標籤分類: finalTag,
        關聯團號: editFormTourId,
        關聯人員: editFormPerson.trim(),
        詳細備註: editFormNotes.trim()
      };

      const searchKey = editingLog.日誌ID 
        ? `日誌ID/${editingLog.日誌ID}` 
        : `詳細備註/${encodeURIComponent(editingLog.詳細備註)}`;

      const res = await fetch(`${SHEETDB_URL}/${searchKey}?sheet=營運日誌總表`, {
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
      }
    } catch (err) {
      setSyncStatus("error");
    }
  };

  const handleDeleteLog = async (log: LogEvent) => {
    if (userRole !== "admin") return;
    if (!confirm("確定要刪除這筆工作安排嗎？刪除後無法復原！")) return;

    try {
      setIsDeleting(true);
      setSyncStatus("saving");
      const searchKey = log.日誌ID 
        ? `日誌ID/${log.日誌ID}` 
        : `詳細備註/${encodeURIComponent(log.詳細備註)}`;

      const res = await fetch(`${SHEETDB_URL}/${searchKey}?sheet=營運日誌總表`, {
        method: "DELETE",
      });

      if (res.ok) {
        setSyncStatus("success");
        await fetchLogSystemData();
      } else {
        setSyncStatus("error");
      }
    } catch (err) {
      setSyncStatus("error");
    } finally {
      setIsDeleting(false);
    }
  };

  const triggerPrintAction = () => {
    window.print();
  };

  const generateTimeline = (mode: "all" | "personal") => {
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
          const guides = [t.負責嚮導1, t.負責嚮導2, t.負責嚮導3].filter(Boolean).join("、");
          const tourLabel = guides ? `${t.團號} (D${d}) - 帶團: ${guides}` : `${t.團號} (D${d})`;
          
          if (mode === "personal") {
            if (guides.includes(currentUserName)) {
              timelineMap[loopKey].activeTours.push(tourLabel);
            }
          } else {
            timelineMap[loopKey].activeTours.push(tourLabel);
          }
        }
      }
    });

    logs.forEach((log) => {
      if (log.日期 && timelineMap[log.日期]) {
        if (mode === "personal") {
          if (!log.關聯人員 || !log.關聯人員.includes(currentUserName)) return;
        }
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

  const getPrintableEvents = () => {
    return logs.filter((log) => {
      if (printType === "tour") {
        return log.關聯團號 === printTourId;
      } else {
        return log.日期 >= printStartDate && log.日期 <= printEndDate;
      }
    }).sort((a, b) => a.日期.localeCompare(b.日期) || a.標籤分類.localeCompare(b.標籤分類));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-900 flex flex-col items-center justify-center">
        <p className="text-amber-400 text-3xl animate-bounce">🗓️</p>
        <p className="text-emerald-400 font-bold mt-4 animate-pulse">岳野雲端數據庫同步中...</p>
      </div>
    );
  }

  const generalTimeline = generateTimeline("all");
  const personalTimeline = generateTimeline("personal");
  const printableEvents = getPrintableEvents();
  const selectedTourObj = tours.find(t => t.團號 === printTourId);

  const gridCols = userRole === "admin" ? "grid-cols-5" : "grid-cols-2";

  return (
    <main className="min-h-screen bg-stone-100 flex flex-col items-center pb-12 relative">
      
      <style>{`
        @media print {
          body { background: white !important; color: black !important; padding: 0 !important; margin: 0 !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; width: 100% !important; max-width: 100% !important; position: absolute; top: 0; left: 0; z-index: 99999; background: white !important; }
          .print-card { border: 1px solid #000 !important; box-shadow: none !important; margin-bottom: 10px !important; page-break-inside: avoid; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #000 !important; padding: 8px !important; text-align: left !important; font-size: 12px !important; color: black !important; }
          th { background-color: #f2f2f2 !important; font-weight: bold !important; }
        }
        .print-only { display: none; }
      `}</style>

      {/* 頂部導覽列 */}
      <div className="w-full bg-stone-900 text-white py-4 px-6 sticky top-0 z-20 flex items-center justify-between shadow-lg border-b border-amber-500/40 no-print">
        <div>
          <span className="text-[10px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-stone-950 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
            TAKENO ERP DISPATCH CENTER
          </span>
          <h1 className="text-lg font-black text-stone-50 mt-1 tracking-wide">
            {subView === "my-schedule" && `📅 ${currentUserName} 嚮導專屬班表`}
            {subView === "review" && "🏢 營運與調度工作總表"}
            {subView === "settings" && "📝 工作安排與日誌設定"}
            {subView === "backoffice" && "⚙️ 獨立建團管理後台"}
            {subView === "print" && "🖨️ 智能出團報表列印中心"}
          </h1>
        </div>
        <Link href="/" className="text-stone-900 text-xs font-black bg-amber-400 hover:bg-amber-300 px-4 py-2 rounded-xl transition-all active:scale-95 shadow-md">
          ↩ 回首頁
        </Link>
      </div>

      {/* 智慧分頁頁籤 */}
      <div className={`w-full max-w-md px-4 mt-4 grid ${gridCols} gap-1.5 no-print`}>
        <button onClick={() => setSubView("my-schedule")} className={`py-3 text-[10px] font-black rounded-xl border transition-all text-center ${subView === "my-schedule" ? "bg-stone-900 text-amber-400 border-stone-950 shadow-sm" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"}`}>
          📅 我的班表
        </button>
        <button onClick={() => setSubView("review")} className={`py-3 text-[10px] font-black rounded-xl border transition-all text-center ${subView === "review" ? "bg-stone-900 text-amber-400 border-stone-950 shadow-sm" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"}`}>
          📋 總表
        </button>
        
        {userRole === "admin" && (
          <>
            <button onClick={() => setSubView("settings")} className={`py-3 text-[10px] font-black rounded-xl border transition-all text-center ${subView === "settings" ? "bg-stone-900 text-amber-400 border-stone-950 shadow-sm" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"}`}>
              📝 日誌設定
            </button>
            <button onClick={() => setSubView("print")} className={`py-3 text-[10px] font-black rounded-xl border transition-all text-center ${subView === "print" ? "bg-stone-900 text-amber-400 border-stone-950 shadow-sm" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"}`}>
              🖨️ 報表列印
            </button>
            <button onClick={() => setSubView("backoffice")} className={`py-3 text-[10px] font-black rounded-xl border transition-all text-center ${subView === "backoffice" ? "bg-stone-900 text-amber-400 border-stone-950 shadow-sm" : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"}`}>
              ⚙️ 建團
            </button>
          </>
        )}
      </div>

      <div className="w-full max-w-md px-4 mt-3 no-print">
        <div className="text-center py-1.5 rounded-xl text-[10px] font-bold border bg-stone-200 text-stone-500 shadow-inner">
          🌿 岳野營運總腦就緒 | 登入身分：<span className={`uppercase font-black ${userRole === "admin" ? "text-rose-700" : "text-emerald-700"}`}>{userRole === "admin" ? "👑 系統管理員 (Admin)" : "🧗 隨團嚮導 (Guide)"}</span>
        </div>
      </div>

      <div className="w-full max-w-md px-4 mt-4 no-print">
        
        {/* ================= 嚮導個人專屬班表視角 ================= */}
        {subView === "my-schedule" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 p-4 rounded-2xl shadow-sm text-white text-left border border-emerald-700">
              <h3 className="text-sm font-black text-amber-400">👤 {currentUserName} 嚮導，您好：</h3>
              <p className="text-xs font-bold text-emerald-100 mt-1.5 leading-relaxed">
                這是您專屬的智能班表。系統已自動為您抽取 7/8 - 11/2 中，所有指派給您的接機、帶團與排班任務。
              </p>
            </div>

            <div className="space-y-3.5 pb-10">
              {personalTimeline.map((day) => {
                if (day.events.length === 0 && day.activeTours.length === 0) return null; 
                return (
                  <div key={day.date} className="bg-white border border-emerald-200 rounded-2xl shadow-xs overflow-hidden">
                    <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2.5 flex flex-col gap-1.5">
                      <span className="text-sm font-black text-emerald-950">{day.date}</span>
                      {day.activeTours.length > 0 && (
                        <div className="flex flex-col gap-1">
                          {day.activeTours.map((t, idx) => (
                            <span key={idx} className="text-[10px] font-black bg-emerald-700 text-white px-2 py-1 rounded-md shadow-sm">
                              ⛺ {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="p-3 space-y-2">
                      {day.events.map((e, idx) => {
                        let displayTag = e.標籤分類;
                        let tagStyle = "bg-amber-400 text-stone-950 border-transparent";
                        if (displayTag === "航班狀況-IN") { displayTag = "🛬 航班接機 IN"; tagStyle = "bg-sky-500 text-white border-sky-600"; }
                        else if (displayTag === "航班狀況-OUT") { displayTag = "🛫 航班送機 OUT"; tagStyle = "bg-rose-500 text-white border-rose-600"; }
                        
                        return (
                          <div key={idx} className="bg-stone-50 border border-stone-200 p-3 rounded-xl space-y-1.5">
                            <div className="flex gap-1.5 items-center">
                              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border shadow-sm ${tagStyle}`}>{displayTag}</span>
                              {e.關聯團號 && <span className="text-[10px] font-black bg-stone-800 text-amber-400 px-1.5 py-0.5 rounded shadow-sm">{e.關聯團號}</span>}
                            </div>
                            <p className="text-xs font-bold text-stone-700 leading-relaxed whitespace-pre-wrap mt-1 pl-0.5">{e.詳細備註}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= 季度工作日誌一覽表 (Review 大全景) ================= */}
        {subView === "review" && (
          <div className="space-y-4">
            <div className="bg-white border border-stone-200 p-4 rounded-2xl shadow-sm space-y-3">
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Advanced Filter Panel</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black text-stone-500 block mb-1 pl-0.5">🗓️ 按月份篩選</label>
                  <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-full text-xs font-bold border-2 border-stone-200 rounded-xl px-2 py-2 bg-stone-50 text-stone-800 focus:outline-none focus:border-emerald-600">
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
                  <select value={filterTour} onChange={(e) => setFilterTour(e.target.value)} className="w-full text-xs font-bold border-2 border-stone-200 rounded-xl px-2 py-2 bg-stone-50 text-stone-800 focus:outline-none focus:border-emerald-600">
                    <option value="all">全公司所有梯次</option>
                    {tours.map((t) => <option key={t.團號} value={t.團號}>{t.團號} ({t.團名})</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-3.5 pb-10">
              {generalTimeline.map((day) => {
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
                        <div className="flex flex-col gap-1">
                          {day.activeTours.map((t, idx) => (
                            <span key={idx} className="text-[10px] font-black bg-emerald-700 text-white px-2 py-1 rounded-md border border-emerald-800 shadow-sm text-left">⛺ {t}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-3 space-y-2.5">
                      {day.events.length === 0 ? (
                        <p className="text-[11px] text-stone-400 italic pl-1 py-1">本日尚無新增事件日誌說明</p>
                      ) : (
                        day.events.map((e, idx) => {
                          let displayTag = e.標籤分類;
                          let tagStyle = "bg-amber-400 text-stone-950 border-transparent";
                          if (displayTag === "航班狀況-IN") { displayTag = "🛬 航班 IN (抵達)"; tagStyle = "bg-sky-500 text-white border-sky-600"; }
                          else if (displayTag === "航班狀況-OUT") { displayTag = "🛫 航班 OUT (離開)"; tagStyle = "bg-rose-500 text-white border-rose-600"; }

                          return (
                            <div key={idx} className="bg-stone-50/70 border border-stone-200 p-3 rounded-xl space-y-2 relative">
                              <div className="flex flex-wrap justify-between items-center gap-1">
                                <div className="flex items-center gap-1.5 pr-14">
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${tagStyle}`}>{displayTag}</span>
                                  {e.關聯團號 && <span className="text-[10px] font-black bg-stone-800 text-amber-400 px-1.5 py-0.5 rounded-md">{e.關聯團號}</span>}
                                </div>
                              </div>
                              <div>
                                {e.關聯人員 && <p className="text-[10px] font-black text-emerald-800 mb-1">👤 派員：{e.關聯人員}</p>}
                                <p className="text-xs font-bold text-stone-700 leading-relaxed whitespace-pre-wrap pl-0.5">{e.詳細備註}</p>
                              </div>
                              
                              {userRole === "admin" && (
                                <div className="border-t border-stone-200/60 pt-2 mt-1 flex justify-end gap-2">
                                  <button onClick={() => openEditModal(e)} disabled={isDeleting || syncStatus === "saving"} className="text-[10px] font-black text-stone-500 bg-white border border-stone-200 hover:border-emerald-400 hover:text-emerald-700 px-3 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-50">✏️ 編輯修改</button>
                                  <button onClick={() => handleDeleteLog(e)} disabled={isDeleting || syncStatus === "saving"} className="text-[10px] font-black text-stone-500 bg-white border border-stone-200 hover:border-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg transition-all active:scale-95 disabled:opacity-50">🗑️ 刪除紀錄</button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= 工作日誌設定 (每日安排新增) ================= */}
        {subView === "settings" && userRole === "admin" && (
          <form onSubmit={handleCreateLog} className="bg-white border border-stone-200 p-5 rounded-2xl shadow-sm space-y-4">
            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Log Event Factory</p>
            <div>
              <label className="text-xs font-black text-stone-700 block mb-1">📅 選擇調度日期</label>
              <input type="date" min="2026-07-08" max="2026-11-02" value={formLogDate} onChange={(e) => setFormLogDate(e.target.value)} className="w-full border-2 border-stone-200 rounded-xl px-3 py-2.5 font-bold text-stone-800 bg-stone-50 focus:outline-none focus:border-emerald-600"/>
            </div>
            <div>
              <label className="text-xs font-black text-stone-700 block mb-1.5">🏷️ 選擇工作分類標籤</label>
              <div className="grid grid-cols-2 gap-1.5">
                {["飯店預約", "活動/交通", "人力排班", "航班狀況", "休假住宿", "團務交接"].map((tag) => (
                  <button key={tag} type="button" onClick={() => setFormLogTag(tag)} className={`py-2 rounded-xl text-xs font-black border transition-all ${formLogTag === tag ? "bg-amber-500 text-stone-950 border-amber-600 shadow-sm" : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100"}`}>{tag}</button>
                ))}
              </div>
              {formLogTag === "航班狀況" && (
                <div className="mt-2 p-2 bg-stone-100 border border-stone-200 rounded-xl flex gap-2">
                  <button type="button" onClick={() => setFormLogFlightDir("IN")} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${formLogFlightDir === "IN" ? "bg-sky-500 text-white shadow-sm border border-sky-600" : "bg-white text-stone-400 border border-stone-200"}`}>🛬 IN (抵達日本)</button>
                  <button type="button" onClick={() => setFormLogFlightDir("OUT")} className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all ${formLogFlightDir === "OUT" ? "bg-rose-500 text-white shadow-sm border border-rose-600" : "bg-white text-stone-400 border border-stone-200"}`}>🛫 OUT (離開日本)</button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-black text-stone-700 block mb-1">🏔️ 關聯團號 (選填)</label>
                <select value={formLogTourId} onChange={(e) => setFormLogTourId(e.target.value)} className="w-full text-xs font-bold border-2 border-stone-200 rounded-xl px-2 py-2.5 bg-stone-50 text-stone-800 focus:outline-none focus:border-emerald-600">
                  <option value="">-- 無關聯團號 --</option>
                  {tours.map((t) => <option key={t.團號} value={t.團號}>{t.團號}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-black text-stone-700 block mb-1">👤 關聯人員排班 (選填)</label>
                <input type="text" placeholder="例如：小魚、老胡" value={formLogPerson} onChange={(e) => setFormLogPerson(e.target.value)} className="w-full text-xs font-bold border-2 border-stone-200 rounded-xl px-3 py-2 bg-stone-50 text-stone-800 focus:outline-none focus:border-emerald-600"/>
              </div>
            </div>
            <div>
              <label className="text-xs font-black text-stone-700 block mb-1">📝 詳細調度與交接備註</label>
              <textarea rows={5} placeholder="請輸入細節內容..." value={formLogNotes} onChange={(e) => setFormLogNotes(e.target.value)} className="w-full text-xs font-bold border-2 border-stone-200 rounded-xl px-3 py-2 bg-stone-50 text-stone-800 focus:outline-none focus:border-emerald-600 shadow-inner leading-relaxed"/>
            </div>
            <button type="submit" disabled={syncStatus === "saving"} className="w-full bg-stone-900 hover:bg-stone-800 text-amber-400 font-black py-4 rounded-xl shadow-md transition-all active:scale-95 text-center text-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {syncStatus === "saving" ? "⏳ 雲端同步中請稍候..." : "➕ 儲存本日事件回傳雲端 ➔"}
            </button>
          </form>
        )}

        {/* ================= 🖨️ 智能出團報表列印中心 ================= */}
        {subView === "print" && userRole === "admin" && (
          <div className="bg-white border border-stone-200 p-5 rounded-2xl shadow-sm space-y-4">
            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Report Print Center</p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs font-bold text-amber-900 leading-relaxed">
              🖨️ <b>紙張智慧防呆：</b>按下下方「產生並啟動 A4 紙張列印」後，系統會自動在背景啟動白底黑字的標準公文報表格式！
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-black text-stone-700 block mb-1">1. 選擇報表產出模式</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPrintType("tour")} className={`flex-1 py-2 text-xs font-black rounded-lg border transition-all ${printType === "tour" ? "bg-stone-900 text-amber-400 shadow-sm" : "bg-stone-50 text-stone-500 hover:bg-stone-100"}`}>🎯 指定產品團號</button>
                  <button type="button" onClick={() => setPrintType("date")} className={`flex-1 py-2 text-xs font-black rounded-lg border transition-all ${printType === "date" ? "bg-stone-900 text-amber-400 shadow-sm" : "bg-stone-50 text-stone-500 hover:bg-stone-100"}`}>📅 指定日期區間</button>
                </div>
              </div>

              {printType === "tour" ? (
                <div>
                  <label className="text-xs font-black text-stone-700 block mb-1">2. 選擇目標出團梯次</label>
                  <select value={printTourId} onChange={(e) => setPrintTourId(e.target.value)} className="w-full text-xs font-bold border-2 border-stone-200 rounded-xl px-2 py-2.5 bg-stone-50 text-stone-800 focus:outline-none focus:border-emerald-600">
                    {tours.map((t) => <option key={t.團號} value={t.團號}>{t.團號} — {t.團名}</option>)}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-black text-stone-700 block mb-1">開始日期</label>
                    <input type="date" value={printStartDate} onChange={(e) => setPrintStartDate(e.target.value)} className="w-full border-2 border-stone-200 rounded-xl p-2 text-xs font-bold text-stone-800 bg-stone-50 focus:outline-none focus:border-emerald-600" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-stone-700 block mb-1">結束日期</label>
                    <input type="date" value={printEndDate} onChange={(e) => setPrintEndDate(e.target.value)} className="w-full border-2 border-stone-200 rounded-xl p-2 text-xs font-bold text-stone-800 bg-stone-50 focus:outline-none focus:border-emerald-600" />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-stone-50 border border-stone-200 p-3 rounded-xl">
              <p className="text-[10px] text-stone-400 font-bold uppercase mb-1">Preview Overview</p>
              <p className="text-xs font-bold text-stone-700">預計產出：<span className="text-emerald-700 font-black">{printableEvents.length}</span> 筆調度安排明細</p>
            </div>

            <button type="button" onClick={triggerPrintAction} className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-black py-4 rounded-xl shadow-md transition-all active:scale-95 text-center text-sm">
              🖨️ 產生並啟動 A4 紙張列印 ➔
            </button>
          </div>
        )}

        {/* ================= 工作日誌後台 (前期獨立建團) ================= */}
        {subView === "backoffice" && userRole === "admin" && (
          <form onSubmit={handleCreateTour} className="bg-white border border-stone-200 p-5 rounded-2xl shadow-sm space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs font-bold text-amber-900 leading-relaxed">
              💡 💡 <b>ERP 前瞻思維防呆：</b><br />此處僅限 <b>管理員 (Admin)</b> 前期開團與鋪設行事曆！
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-black text-stone-700 block mb-1">🏔️ 創立團號</label>
                <input type="text" placeholder="如: S1" value={formTourId} onChange={(e) => setFormTourId(e.target.value)} className="w-full border-2 border-stone-200 rounded-xl px-3 py-2.5 font-bold text-stone-800 bg-stone-50 uppercase focus:outline-none focus:border-emerald-600"/>
              </div>
              <div>
                <label className="text-xs font-black text-stone-700 block mb-1">出團天數</label>
                <select value={formTourDays} onChange={(e) => setFormTourDays(e.target.value)} className="w-full border-2 border-stone-200 rounded-xl px-3 py-2.5 font-bold text-stone-800 bg-stone-50 focus:outline-none focus:border-emerald-600">
                  {[3,4,5,6,7,8,9,10].map(d => <option key={d} value={d}>{d} 天</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-black text-stone-700 block mb-1">🏷️ 產品系列團名</label>
              <select value={formTourName} onChange={(e) => setFormTourName(e.target.value)} className="w-full border-2 border-stone-200 rounded-xl px-3 py-2.5 font-bold text-stone-800 bg-stone-50 focus:outline-none focus:border-emerald-600">
                <option value="富士山三日團">🗻 富士山三日團</option>
                <option value="富士山五日團">🇯🇵 富士山五日團</option>
                <option value="日本登山系列團">🧗 日本登山系列團</option>
              </select>
            </div>
            {formTourName === "日本登山系列團" && (
              <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 mt-2 transition-all">
                <label className="text-xs font-black text-emerald-800 block mb-1">🎯 確切活動名稱 (必填)</label>
                <input type="text" placeholder="例如：槍岳表銀座、北阿爾卑斯健行..." value={formCustomActivityName} onChange={(e) => setFormCustomActivityName(e.target.value)} className="w-full border-2 border-emerald-200 rounded-xl p-2 font-bold text-stone-800 bg-white focus:outline-none focus:border-emerald-600"/>
              </div>
            )}

            <div>
              <label className="text-xs font-black text-stone-700 block mb-1">出發日期</label>
              <input type="date" min="2026-07-08" max="2026-11-02" value={formTourDate} onChange={(e) => setFormTourDate(e.target.value)} className="w-full border-2 border-stone-200 rounded-xl p-3 font-bold text-stone-800 bg-stone-50 text-xs focus:outline-none focus:border-emerald-600"/>
            </div>

            <div className="pt-2 border-t border-stone-200/60">
              <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">Assign Guides</label>
              <div className="space-y-2">
                <input type="text" placeholder="負責嚮導 1 (主力)" value={formTourGuide1} onChange={(e) => setFormTourGuide1(e.target.value)} className="w-full border-2 border-stone-200 rounded-lg p-2 font-bold text-stone-800 bg-stone-50 text-xs focus:outline-none focus:border-emerald-600"/>
                <input type="text" placeholder="負責嚮導 2" value={formTourGuide2} onChange={(e) => setFormTourGuide2(e.target.value)} className="w-full border-2 border-stone-200 rounded-lg p-2 font-bold text-stone-800 bg-stone-50 text-xs focus:outline-none focus:border-emerald-600"/>
                <input type="text" placeholder="負責嚮導 3" value={formTourGuide3} onChange={(e) => setFormTourGuide3(e.target.value)} className="w-full border-2 border-stone-200 rounded-lg p-2 font-bold text-stone-800 bg-stone-50 text-xs focus:outline-none focus:border-emerald-600"/>
              </div>
            </div>

            <button type="submit" disabled={syncStatus === "saving"} className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-black py-4 rounded-xl text-sm disabled:opacity-50 shadow-md transition-all active:scale-95">🚀 成立產品梯次與排班 ➔</button>
          </form>
        )}
      </div>

      {/* ================= 🌟 智慧列印純淨區 ================= */}
      <div className="print-only w-full p-8 text-black bg-white">
        <div className="text-center border-b-4 border-black pb-4 mb-6">
          <h1 className="text-2xl font-black tracking-widest text-black">TAKENO 營運調度資源總報表</h1>
          <p className="text-sm font-bold text-black mt-1">
            {printType === "tour" 
              ? `出團梯次調度報告：【${printTourId}】 ${selectedTourObj ? selectedTourObj.團名 : ""} (出發日期: ${selectedTourObj ? selectedTourObj.出發日期 : "未定"})` 
              : `營運日期區間調度報告：【${printStartDate}】 至 【${printEndDate}】`}
          </p>
          <p className="text-[10px] text-right mt-2 font-medium text-black">製表列印日期：2026-06-26 | 操作員：{currentUserName}</p>
        </div>

        {printableEvents.length === 0 ? (
          <p className="text-sm italic text-center text-black py-10">該篩選維度下目前無任何已登錄的調度資源紀錄。</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: "15%" }}>📅 預定日期</th>
                <th style={{ width: "18%" }}>🏷️ 標籤分類</th>
                <th style={{ width: "12%" }}>🏔️ 關聯團號</th>
                <th style={{ width: "15%" }}>👤 派派人員</th>
                <th style={{ width: "40%" }}>📝 詳細營運安排與資源備註說明</th>
              </tr>
            </thead>
            <tbody>
              {printableEvents.map((e, idx) => {
                let cleanTag = e.標籤分類;
                if (cleanTag === "航班狀況-IN") cleanTag = "航班接機(IN)";
                if (cleanTag === "航班狀況-OUT") cleanTag = "航班送機(OUT)";
                return (
                  <tr key={idx}>
                    <td>{e.日期}</td>
                    <td><b>{cleanTag}</b></td>
                    <td>{e.關聯團號 || "—"}</td>
                    <td>{e.關聯人員 || "—"}</td>
                    <td style={{ whiteSpace: "pre-wrap" }}>{e.詳細備註}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="mt-10 border-t border-black pt-4 text-center text-[10px] text-black">
          © TAKENO 精準營運管理調度系統 (Takeno Expedition) — 內部機密公文檔案，請妥善保管。
        </div>
      </div>

      {/* ================= 浮動編輯視窗 Modal ================= */}
      {editingLog && userRole === "admin" && (
        <div className="fixed inset-0 bg-stone-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-stone-900 text-amber-400 p-4 flex justify-between items-center border-b-2 border-amber-500">
              <span className="font-black text-sm">✏️ 編輯調度日誌</span>
              <button onClick={closeEditModal} disabled={syncStatus === "saving"} className="text-stone-400 hover:text-white font-black disabled:opacity-50">✖</button>
            </div>
            <div className="p-5 overflow-y-auto bg-stone-100">
              <form onSubmit={handleUpdateLog} className="space-y-4">
                <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm space-y-3">
                  <div>
                    <label className="text-xs font-black text-stone-700 block mb-1">📅 調度日期</label>
                    <input type="date" min="2026-07-08" max="2026-11-02" value={editFormDate} onChange={(e) => setEditFormDate(e.target.value)} className="w-full border-2 border-stone-200 rounded-lg p-2 font-bold text-stone-900 bg-stone-50 focus:outline-none focus:border-amber-500"/>
                  </div>
                  <div>
                    <label className="text-xs font-black text-stone-700 block mb-1">🏷️ 標籤分類</label>
                    <select value={editFormTag} onChange={(e) => setEditFormTag(e.target.value)} className="w-full border-2 border-stone-200 rounded-lg p-2 font-bold text-stone-900 bg-stone-50 focus:outline-none focus:border-amber-500">
                      <option value="飯店預約">飯店預約</option>
                      <option value="活動/交通">活動/交通</option>
                      <option value="人力排班">人力排班</option>
                      <option value="航班狀況">航班狀況</option>
                      <option value="休假住宿">休假住宿</option>
                      <option value="團務交接">團務交接</option>
                    </select>
                    {editFormTag === "航班狀況" && (
                      <div className="mt-2 p-2 bg-stone-100 border border-stone-200 rounded-lg flex gap-2">
                        <button type="button" onClick={() => setEditFormFlightDir("IN")} className={`flex-1 py-1.5 rounded-md text-[10px] font-black ${editFormFlightDir === "IN" ? "bg-sky-500 text-white shadow-sm border border-sky-600" : "bg-white text-stone-400 border border-stone-200"}`}>🛬 IN (抵達)</button>
                        <button type="button" onClick={() => setEditFormFlightDir("OUT")} className={`flex-1 py-1.5 rounded-md text-[10px] font-black ${editFormFlightDir === "OUT" ? "bg-rose-500 text-white shadow-sm border border-rose-600" : "bg-white text-stone-400 border border-stone-200"}`}>🛫 OUT (離開)</button>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-black text-stone-700 block mb-1">🏔️ 關聯團號</label>
                      <select value={editFormTourId} onChange={(e) => setEditFormTourId(e.target.value)} className="w-full text-xs font-bold border-2 border-stone-200 rounded-lg p-2 bg-stone-50 text-stone-900 focus:outline-none focus:border-amber-500">
                        <option value="">-- 無 --</option>
                        {tours.map((t) => <option key={t.團號} value={t.團號}>{t.團號}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-black text-stone-700 block mb-1">👤 關聯人員</label>
                      <input type="text" value={editFormPerson} onChange={(e) => setEditFormPerson(e.target.value)} className="w-full text-xs font-bold border-2 border-stone-200 rounded-lg p-2 bg-stone-50 text-stone-900 focus:outline-none focus:border-amber-500"/>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-black text-stone-700 block mb-1">📝 詳細備註</label>
                    <textarea rows={5} value={editFormNotes} onChange={(e) => setEditFormNotes(e.target.value)} className="w-full text-xs font-bold border-2 border-stone-200 rounded-lg p-2 bg-stone-50 text-stone-900 shadow-inner focus:outline-none focus:border-amber-500"/>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={closeEditModal} disabled={syncStatus === "saving"} className="w-1/3 bg-stone-300 hover:bg-stone-400 text-stone-700 font-black py-3.5 rounded-xl shadow-sm transition-all disabled:opacity-50">取消</button>
                  <button type="submit" disabled={syncStatus === "saving"} className="w-2/3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black py-3.5 rounded-xl shadow-md transition-all active:scale-95 border border-amber-600/50 disabled:opacity-50 disabled:cursor-not-allowed">
                    {syncStatus === "saving" ? "⏳ 儲存中..." : "💾 儲存修改"}
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
