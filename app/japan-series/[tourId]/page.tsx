"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// 🌟 拔除裝備、餐點、單車、分組，留下最精簡強悍的日本線核心
type ViewState = "menu" | "checkin" | "customerInfo" | "rooms" | "roomSummary";

interface OfflineQueueItem {
  name: string;
  field: string;
  value: string;
  originalIdx: number;
}

export default function JapanSeriesDashboardPage() {
  const params = useParams();
  const tourId = params.tourId as string;

  const [view, setView] = useState<ViewState>("menu");
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "success" | "error" | "offline-pending">("idle");
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  
  const [memberData, setMemberData] = useState<any[]>([]);
  const [roomData, setRoomData] = useState<any[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);

  // ✈️ 接機模式過濾
  const [selectedPickupFilter, setSelectedPickupFilter] = useState<string | null>(null);
  const [pickupStats, setPickupStats] = useState<{ [key: string]: number }>({});

  const [selectedHotelStage, setSelectedHotelStage] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const SHEETDB_URL = "https://sheetdb.io/api/v1/ng85gs3977snc";

  const calculateStats = (members: any[]) => {
    const pickupMap: { [key: string]: number } = {};

    members.forEach((m: any) => {
      const mode = m.接機模式 ? String(m.接機模式).trim() : "未定";
      pickupMap[mode] = (pickupMap[mode] || 0) + 1;
    });

    setPickupStats(pickupMap);
  };

  async function fetchData() {
    try {
      const cachedMembers = localStorage.getItem(`takeno_members_jp_${tourId}`);
      const cachedRooms = localStorage.getItem(`takeno_rooms_jp_${tourId}`);
      
      if (cachedMembers && cachedRooms) {
        const parsedM = JSON.parse(cachedMembers);
        const parsedR = JSON.parse(cachedRooms);
        setMemberData(parsedM);
        setRoomData(parsedR);
        calculateStats(parsedM);
        setLoading(false);
      }

      const resMembers = await fetch(`${SHEETDB_URL}?sheet=日本系列出團總表`, { cache: "no-store" });
      const allMembers = await resMembers.json();
      const filteredMembers = Array.isArray(allMembers) ? allMembers.filter((m: any) => m.團號 === tourId) : [];

      const resRooms = await fetch(`${SHEETDB_URL}?sheet=日本系列排房表`, { cache: "no-store" });
      const allRooms = await resRooms.json();
      const filteredRooms = Array.isArray(allRooms) ? allRooms.filter((r: any) => r.團號 === tourId) : [];

      setMemberData(filteredMembers);
      setRoomData(filteredRooms);
      calculateStats(filteredMembers);

      localStorage.setItem(`takeno_members_jp_${tourId}`, JSON.stringify(filteredMembers));
      localStorage.setItem(`takeno_rooms_jp_${tourId}`, JSON.stringify(filteredRooms));
      setSyncStatus("idle");

    } catch (error) {
      if (memberData.length === 0) setSyncStatus("error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tourId) {
      fetchData();
      const savedQueue = localStorage.getItem(`takeno_queue_jp_${tourId}`);
      if (savedQueue) {
        const parsed = JSON.parse(savedQueue);
        setOfflineQueue(parsed);
        if (parsed.length > 0) setSyncStatus("offline-pending");
      }
    }
  }, [tourId]);

  const handleMemberFieldUpdate = async (index: number, field: string, value: string) => {
    const updatedMembers = [...memberData];
    updatedMembers[index] = { ...updatedMembers[index], [field]: value };
    setMemberData(updatedMembers);
    calculateStats(updatedMembers);
    localStorage.setItem(`takeno_members_jp_${tourId}`, JSON.stringify(updatedMembers));

    const memberName = updatedMembers[index].姓名;
    setSyncStatus("saving");

    try {
      const response = await fetch(`${SHEETDB_URL}/姓名/${encodeURIComponent(memberName)}?sheet=日本系列出團總表`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { [field]: value } })
      });
      if (response.ok) setSyncStatus("success");
      else throw new Error("斷網");
    } catch (error) {
      const newQueueItem: OfflineQueueItem = { name: memberName, field, value, originalIdx: index };
      const updatedQueue = [...offlineQueue, newQueueItem];
      setOfflineQueue(updatedQueue);
      localStorage.setItem(`takeno_queue_jp_${tourId}`, JSON.stringify(updatedQueue));
      setSyncStatus("offline-pending");
    }
  };

  const handleRetrySyncAll = async () => {
    if (offlineQueue.length === 0) return;
    setSyncStatus("saving");
    const currentQueue = [...offlineQueue];
    let successCount = 0;

    try {
      for (let i = 0; i < currentQueue.length; i++) {
        const item = currentQueue[i];
        const response = await fetch(`${SHEETDB_URL}/姓名/${encodeURIComponent(item.name)}?sheet=日本系列出團總表`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: { [item.field]: item.value } })
        });
        if (response.ok) successCount++;
      }

      if (successCount === currentQueue.length) {
        setOfflineQueue([]);
        localStorage.removeItem(`takeno_queue_jp_${tourId}`);
        setSyncStatus("success");
        fetchData();
      } else {
        const remained = currentQueue.slice(successCount);
        setOfflineQueue(remained);
        localStorage.setItem(`takeno_queue_jp_${tourId}`, JSON.stringify(remained));
        setSyncStatus("offline-pending");
      }
    } catch (err) {
      setSyncStatus("error");
    }
  };

  const handleLocalTextChange = (index: number, field: string, value: string) => {
    const updatedMembers = [...memberData];
    updatedMembers[index] = { ...updatedMembers[index], [field]: value };
    setMemberData(updatedMembers);
  };

  const handleRoomNumberChange = (index: number, newValue: string) => {
    const newData = [...roomData];
    newData[index] = { ...newData[index], 實際房號: newValue };
    setRoomData(newData);
  };

  const getPrimaryGuestInfo = (room: any) => {
    const guestKeys = Object.keys(room).filter(k => k.includes("房客"));
    guestKeys.sort();
    for (let key of guestKeys) {
      const val = String(room[key]).trim();
      if (val && val !== "undefined" && val !== "null" && val !== "") {
        return { key, value: val };
      }
    }
    return null;
  };

  const saveSingleRoomNumber = async (index: number) => {
    const room = roomData[index];
    const primaryInfo = getPrimaryGuestInfo(room);
    if (!primaryInfo) return;
    
    try {
      setSavingIdx(index);
      setSyncStatus("saving");
      const response = await fetch(`${SHEETDB_URL}/${encodeURIComponent(primaryInfo.key)}/${encodeURIComponent(primaryInfo.value)}?sheet=日本系列排房表`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { 實際房號: room.實際房號 || "" } })
      });
      if (response.ok) {
        setSyncStatus("success");
        localStorage.setItem(`takeno_rooms_jp_${tourId}`, JSON.stringify(roomData));
      } else setSyncStatus("error");
    } catch (error) { 
      setSyncStatus("error"); 
    } finally { 
      setSavingIdx(null); 
    }
  };

  // ⚡ 批次上傳引擎 (Promise.all 加速)
  const handleSaveAllAndSummary = async () => {
    setLoading(true);
    setSyncStatus("saving");
    try {
      const promises = roomData.map(room => {
        const primaryInfo = getPrimaryGuestInfo(room);
        if (!primaryInfo) return Promise.resolve();
        return fetch(`${SHEETDB_URL}/${encodeURIComponent(primaryInfo.key)}/${encodeURIComponent(primaryInfo.value)}?sheet=日本系列排房表`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: { 實際房號: room.實際房號 || "" } })
        });
      });
      
      await Promise.all(promises);
      setSyncStatus("success");
      localStorage.setItem(`takeno_rooms_jp_${tourId}`, JSON.stringify(roomData));
      await fetchData();
      setView("roomSummary");
    } catch (error) { 
      setSyncStatus("error"); 
      setView("roomSummary"); 
    } finally { 
      setLoading(false); 
    }
  };

  const getGuestsList = (room: any) => {
    const guests: string[] = [];
    const guestKeys = Object.keys(room).filter(k => k.includes("房客"));
    guestKeys.sort();
    guestKeys.forEach(key => {
      const val = String(room[key]).trim();
      if (val && val !== "" && val !== "undefined" && val !== "null") {
        guests.push(val);
      }
    });
    return Array.from(new Set(guests));
  };

  // 🌟 自動抓取客人飲食禁忌與病史
  const getRoomDietaryRestrictions = (guests: string[]) => {
    const restrictions: string[] = [];
    guests.forEach(gName => {
      const member = memberData.find(m => m.姓名 === gName);
      if (member && (member.飲食禁忌 || member.病史)) {
        let msg = `${gName}:`;
        if (member.飲食禁忌) msg += ` [禁忌] ${member.飲食禁忌}`;
        if (member.病史) msg += ` [病史] ${member.病史}`;
        restrictions.push(msg);
      }
    });
    return restrictions;
  };

  const handlePrintAction = () => {
    window.print();
  };

  if (loading && memberData.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-violet-400 font-bold animate-pulse text-lg tracking-widest">🌸 TAKENO 櫻花大腦載入中...</p>
      </div>
    );
  }

  // 🌟 動態生成飯店階段 (自動掃描雲端表單)
  const availableStages = Array.from(new Set(roomData.map(r => r.住宿階段 ? String(r.住宿階段).trim() : "").filter(Boolean)));
  if (availableStages.length === 0) availableStages.push("首日住宿");
  const currentStage = availableStages.includes(selectedHotelStage) ? selectedHotelStage : availableStages[0];

  // 🔍 全域智慧搜尋與報到過濾
  let displayedCheckins = selectedPickupFilter ? memberData.filter(m => (m.接機模式 ? String(m.接機模式).trim() : "未定") === selectedPickupFilter) : [...memberData];
  if (searchQuery.trim() !== "") {
    displayedCheckins = displayedCheckins.filter(m => m.姓名?.includes(searchQuery) || m.手機?.includes(searchQuery));
  }
  displayedCheckins.sort((a, b) => (a.報到狀態 === "TRUE" ? 1 : -1));
  
  const checkinTotal = displayedCheckins.length;
  const checkinDone = displayedCheckins.filter(m => m.報到狀態 === "TRUE").length;

  const currentStageRooms = roomData.filter((r) => r.住宿階段 === currentStage);
  const currentStageHotelName = currentStageRooms.length > 0 && currentStageRooms[0].飯店名稱 ? currentStageRooms[0].飯店名稱 : "未定飯店";
  const currentStageCheckInDate = currentStageRooms.length > 0 && currentStageRooms[0].入住日期 ? currentStageRooms[0].入住日期 : "未定日期";

  return (
    <>
      <style>{`
        @media print {
          body { background: white !important; color: black !important; padding: 0 !important; margin: 0 !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; width: 100% !important; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th, td { border: 1px solid #333; padding: 8px 10px; text-align: left; font-size: 11pt; color: black; vertical-align: top; }
          th { background-color: #f3f4f6 !important; font-weight: bold; }
          h1, h2, h3, p { color: black !important; margin: 0; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="no-print">
        <main className="min-h-screen bg-slate-50 flex flex-col items-center pb-12">
          {/* 🌸 櫻花紫漸層頂部導覽列 */}
          <div className="w-full bg-gradient-to-r from-violet-900 to-indigo-950 text-white py-4 px-6 sticky top-0 z-20 flex items-center justify-between shadow-lg border-b border-violet-800/50">
            <div>
              <span className="text-[10px] font-black bg-white/20 backdrop-blur-md text-violet-100 px-2 py-0.5 rounded-full uppercase tracking-wider border border-white/20">
                TAKENO JP - {tourId}
              </span>
              <h1 className="text-lg font-black text-white mt-1 tracking-wide drop-shadow-md">
                {view === "menu" && "日本系列嚮導工作台"}
                {view === "checkin" && "✈️ 機場接送與報到"}
                {view === "customerInfo" && "👤 隊員聯絡與緊急資料"}
                {view === "rooms" && "🏨 多階段飯店排房"}
                {view === "roomSummary" && "🗝️ 總房表快速對照"}
              </h1>
            </div>
            {view === "menu" ? (
              <Link href="/japan-series" className="text-violet-100 text-xs font-black bg-black/20 hover:bg-black/30 border border-white/20 px-4 py-2 rounded-xl active:scale-95 transition-all backdrop-blur-sm">
                返回總表
              </Link>
            ) : (
              <button onClick={() => { setView("menu"); setSelectedPickupFilter(null); setSearchQuery(""); }} className="text-slate-900 text-xs font-black bg-white/90 hover:bg-white px-4 py-2 rounded-xl active:scale-95 transition-all shadow-md backdrop-blur-sm">
                ↩ 回選單
              </button>
            )}
          </div>

          {view !== "menu" && (
            <div className="w-full max-w-md px-4 mt-3">
              {syncStatus === "offline-pending" ? (
                <button onClick={handleRetrySyncAll} className="w-full text-center py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-orange-500 to-amber-500 text-stone-950 shadow-md border-2 border-orange-400 animate-pulse flex items-center justify-center gap-1.5 active:scale-95 transition-all">
                  ⚠️ 本地尚有 {offlineQueue.length} 筆離線變更，點此同步 🔄
                </button>
              ) : (
                <div className={`text-center py-1.5 rounded-xl text-xs font-bold shadow-sm border transition-all ${
                  syncStatus === "saving" ? "bg-amber-50 text-amber-800 border-amber-200 animate-pulse" :
                  syncStatus === "success" ? "bg-violet-50 text-violet-700 border-violet-200" :
                  syncStatus === "error" ? "bg-red-50 text-red-700 border-red-200" : "bg-white text-slate-500 border-slate-200"
                }`}>
                  {syncStatus === "saving" && "⏳ 傳送至雲端表單中..."}
                  {syncStatus === "success" && "✨ 雲端實時同步完畢"}
                  {syncStatus === "error" && "❌ 連線失敗，已寫入手機暫存"}
                  {syncStatus === "idle" && "🌿 戰術離線大腦連線就緒"}
                </div>
              )}
            </div>
          )}

          <div className="w-full max-w-md px-4 mt-4">
            
            {/* ================= 🌸 主選單畫面 ================= */}
            {view === "menu" && (
              <div className="grid grid-cols-1 gap-4">
                {offlineQueue.length > 0 && (
                  <button onClick={handleRetrySyncAll} className="bg-red-500 text-white p-3 rounded-2xl text-xs font-black text-center shadow-md animate-bounce border-2 border-red-400">
                    🚨 注意：您有 {offlineQueue.length} 筆離線資料，點此一鍵同步！
                  </button>
                )}

                <button onClick={handlePrintAction} className="bg-slate-800 text-white p-4 rounded-2xl text-sm font-black text-center shadow-md active:scale-95 transition-all border border-slate-700 flex justify-center items-center gap-2">
                  🖨️ 列印【全團綜合大表】(建議橫向)
                </button>

                <button onClick={() => setView("checkin")} className="flex items-center justify-between bg-gradient-to-r from-violet-600 to-indigo-600 p-5 rounded-2xl shadow-md shadow-violet-200 text-white active:scale-[0.98] transition-all">
                  <div className="text-left">
                    <h2 className="text-lg font-black text-white">✈️ 機場接送與點名報到</h2>
                    <p className="text-xs text-white/80 mt-1">智慧搜尋、航班與接送模式確認</p>
                  </div>
                  <span className="text-xl font-bold">➔</span>
                </button>

                <button onClick={() => setView("customerInfo")} className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-slate-200 active:scale-[0.98] transition-all hover:border-violet-300">
                  <div className="text-left">
                    <h2 className="text-lg font-black text-slate-800">👤 隊員聯絡與飲食禁忌</h2>
                    <p className="text-xs text-slate-500 mt-1">電話撥打、病史與飲食禁忌總覽</p>
                  </div>
                  <span className="text-xl text-violet-600 font-bold">➔</span>
                </button>

                <button onClick={() => setView("rooms")} className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-slate-200 active:scale-[0.98] transition-all hover:border-violet-300">
                  <div className="text-left">
                    <h2 className="text-lg font-black text-slate-800">🏨 飯店分房登記</h2>
                    <p className="text-xs text-slate-500 mt-1">動態住宿階段切換、填寫實際房號</p>
                  </div>
                  <span className="text-xl text-violet-600 font-bold">➔</span>
                </button>

                <button onClick={() => setView("roomSummary")} className="flex items-center justify-between bg-violet-50 p-5 rounded-2xl shadow-sm border border-violet-200 active:scale-[0.98] transition-all">
                  <div className="text-left">
                    <h2 className="text-lg font-black text-violet-900">🗝️ 飯店總房表快速對照</h2>
                    <p className="text-xs text-violet-700 mt-1">櫃檯領鑰匙專用、列印紙本房表</p>
                  </div>
                  <span className="text-xl text-violet-600 font-bold">➔</span>
                </button>
              </div>
            )}

            {/* ================= ✈️ 機場接送與報到 ================= */}
            {view === "checkin" && (
              <div className="space-y-4">
                {/* 🔍 智慧搜尋列 */}
                <div className="bg-white border border-slate-200 p-2 rounded-2xl shadow-sm flex items-center gap-2">
                  <span className="pl-3 text-lg">🔍</span>
                  <input 
                    type="text" 
                    placeholder="輸入姓名或手機快速找人..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none focus:outline-none text-sm font-black text-slate-800 placeholder-slate-400 py-2"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="pr-3 text-slate-400 hover:text-slate-600 font-bold text-xs">清除</button>
                  )}
                </div>

                <div className="bg-gradient-to-br from-violet-600 to-indigo-700 text-white p-4 rounded-2xl shadow-md shadow-violet-200">
                  <div className="flex justify-between items-end mb-3">
                    <div>
                      <p className="text-[9px] text-violet-200 font-black tracking-widest uppercase">Pick-up Filter</p>
                      <h3 className="text-sm font-black text-white mt-0.5">✈️ 點擊過濾接機模式</h3>
                    </div>
                    {selectedPickupFilter && (
                      <button onClick={() => setSelectedPickupFilter(null)} className="text-[10px] bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded-md transition-all active:scale-95">✖ 取消</button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(pickupStats).map(([mode, count]) => {
                      const isSelected = selectedPickupFilter === mode;
                      return (
                        <button key={mode} onClick={() => setSelectedPickupFilter(isSelected ? null : mode)} className={`p-2.5 rounded-xl flex justify-between items-center transition-all ${isSelected ? "bg-white text-violet-700 shadow-md scale-[1.02]" : "bg-black/20 border border-white/10 hover:bg-black/30"}`}>
                          <span className={`text-[10px] font-bold truncate mr-1 ${isSelected ? "text-violet-700" : "text-violet-100"}`}>{mode}</span>
                          <span className={`text-base font-black ${isSelected ? "text-violet-600" : "text-white"}`}>{count} <span className="text-[9px]">人</span></span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {displayedCheckins.length === 0 ? (
                  <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
                    <p className="text-slate-400 text-sm font-bold">查無符合條件的名單</p>
                  </div>
                ) : (
                  displayedCheckins.map((member, _idx) => {
                    const originalIdx = memberData.findIndex(m => m.姓名 === member.姓名);
                    const isCheckedIn = member.報到狀態 === "TRUE";

                    return (
                      <div key={originalIdx} className={`bg-white border-2 p-4 rounded-2xl shadow-sm space-y-3 transition-colors ${isCheckedIn ? "border-slate-200 opacity-80" : "border-violet-400 shadow-violet-100 shadow-md"}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-lg font-black text-slate-800">{member.姓名}</h3>
                              {!isCheckedIn && <span className="text-[10px] bg-red-100 text-red-700 font-black px-1.5 py-0.5 rounded-md animate-pulse">待報到</span>}
                            </div>
                            <div className="flex gap-2">
                              <span className="inline-block bg-violet-50 text-violet-700 text-[10px] px-2 py-0.5 rounded-md font-bold border border-violet-100">接：{member.接機模式 || "未定"}</span>
                              <span className="inline-block bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-md font-bold border border-slate-200">送：{member.送機模式 || "未定"}</span>
                            </div>
                          </div>
                        </div>

                        {member.航班資訊 && (
                          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-2.5 rounded-xl font-bold flex gap-2">
                            <span>✈️</span> <span>航班：{member.航班資訊}</span>
                          </div>
                        )}

                        <div className="pt-1">
                          <label className="text-[10px] font-black text-slate-400 block mb-1 pl-1">📝 現場備註 (自動儲存)</label>
                          <input type="text" placeholder="追加註記..." value={member.備註 || ""} onChange={(e) => handleLocalTextChange(originalIdx, "備註", e.target.value)} onBlur={(e) => handleMemberFieldUpdate(originalIdx, "備註", e.target.value)} className="w-full text-xs font-bold border-2 border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:border-violet-500 focus:outline-none"/>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center mt-1">
                          <div>
                            <p className="text-[10px] text-slate-500 font-black mb-0.5">📱 手機</p>
                            <p className="text-sm font-black text-slate-700">{member.手機 || "無"}</p>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm active:scale-95">
                            <input type="checkbox" className="w-5 h-5 rounded text-violet-600" checked={isCheckedIn} onChange={(e) => handleMemberFieldUpdate(originalIdx, "報到狀態", e.target.checked ? "TRUE" : "FALSE")}/>
                            <span className={`font-black text-sm ${isCheckedIn ? "text-violet-600" : "text-slate-400"}`}>{isCheckedIn ? "已完成報到" : "確認報到"}</span>
                          </label>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ================= 👤 隊員聯絡與飲食禁忌 ================= */}
            {view === "customerInfo" && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white p-4 rounded-2xl shadow-md shadow-indigo-200">
                  <h3 className="text-sm font-black text-white">🚨 隊員聯絡與醫療備忘</h3>
                  <p className="text-xs text-indigo-100 font-bold mt-1 leading-relaxed">
                    請特別留意客人的飲食禁忌與病史，點擊號碼即可一鍵撥打。
                  </p>
                </div>

                {memberData.map((member, idx) => (
                  <div key={idx} className="bg-white border-2 border-slate-200 rounded-2xl shadow-sm p-4 space-y-3 hover:border-violet-300 transition-colors">
                    <h3 className="text-base font-black text-slate-800 border-b border-slate-100 pb-2">
                      {member.姓名}
                    </h3>
                    
                    {(member.飲食禁忌 || member.病史) && (
                      <div className="bg-red-50 border border-red-100 p-2.5 rounded-xl space-y-1.5">
                        {member.飲食禁忌 && <p className="text-xs font-bold text-red-700">🚫 禁忌：{member.飲食禁忌}</p>}
                        {member.病史 && <p className="text-xs font-bold text-red-700">⚠️ 病史：{member.病史}</p>}
                      </div>
                    )}

                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-slate-400 font-black">📱 本人電話</p>
                        <p className="text-sm font-black text-slate-700">{member.手機 || "未登記"}</p>
                      </div>
                      {member.手機 && <a href={`tel:${member.手機.replace(/[^0-9+]/g, "")}`} className="bg-slate-800 text-white text-[10px] font-black px-3 py-1.5 rounded-lg active:scale-95 shadow-sm">📞 撥打</a>}
                    </div>

                    <div className="bg-orange-50 border border-orange-200 p-2.5 rounded-xl flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-orange-800 font-black">🚨 {member.緊急聯絡人 || "緊急聯絡人"}</p>
                        <p className="text-sm font-black text-slate-800">{member.緊急聯絡人電話 || "未登記"}</p>
                      </div>
                      {member.緊急聯絡人電話 && <a href={`tel:${member.緊急聯絡人電話.replace(/[^0-9+]/g, "")}`} className="bg-orange-600 text-white text-[10px] font-black px-3 py-1.5 rounded-lg active:scale-95 shadow-sm">☎️ 呼叫</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ================= 🏨 多階段飯店排房 ================= */}
            {view === "rooms" && (
              <div className="space-y-4">
                {/* 🌟 自動生成飯店階段切換器 */}
                <div className="bg-slate-900 p-2 rounded-2xl flex gap-1 shadow-md sticky top-[72px] z-10 overflow-x-auto whitespace-nowrap hide-scrollbar">
                  {availableStages.map(stage => (
                    <button 
                      key={stage} 
                      onClick={() => setSelectedHotelStage(stage)}
                      className={`flex-1 min-w-[80px] px-2 py-2 text-[11px] font-black rounded-xl transition-all ${currentStage === stage ? "bg-violet-500 text-white shadow-sm" : "bg-transparent text-slate-400 hover:bg-slate-800"}`}
                    >
                      {stage}
                    </button>
                  ))}
                </div>

                {currentStageRooms.length === 0 ? (
                  <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
                    <p className="text-slate-400 text-sm font-bold">目前【{currentStage}】無排房資料</p>
                  </div>
                ) : (
                  currentStageRooms.map((room) => {
                    const originalIdx = roomData.findIndex(r => r === room);
                    const guests = getGuestsList(room);
                    const dietWarnings = getRoomDietaryRestrictions(guests);

                    return (
                      <div key={originalIdx} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
                          <div>
                            <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-1 rounded-md border border-slate-200">入住：{room.入住日期 ? room.入住日期.substring(5) : "當日"}</span>
                            <h3 className="text-base font-black text-slate-800 mt-2">{room.飯店名稱}</h3>
                          </div>
                          <span className="text-xs font-black text-violet-700 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-lg">{room.房型}</span>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-2">
                          <p className="text-[10px] text-slate-400 font-bold mb-1">入住成員名單</p>
                          <p className="text-sm font-black text-slate-700 tracking-wide">{guests.length > 0 ? guests.join(" 、 ") : <span className="text-slate-400 font-normal text-xs">未排房客</span>}</p>
                        </div>

                        {dietWarnings.length > 0 && (
                          <div className="mb-3 bg-red-50 border border-red-200 p-2.5 rounded-xl">
                            <p className="text-[10px] font-black text-red-800 mb-1">⚠️ 房間成員醫療與禁忌：</p>
                            <ul className="text-xs font-bold text-red-700 space-y-0.5">
                              {dietWarnings.map((w, i) => <li key={i}>• {w}</li>)}
                            </ul>
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-700 whitespace-nowrap">分配房號：</span>
                          <input type="text" placeholder="填寫實際房號" value={room.實際房號 || ""} onChange={(e) => handleRoomNumberChange(originalIdx, e.target.value)} className="flex-1 min-w-0 border-2 border-slate-300 rounded-xl px-3 py-2 font-black text-slate-800 focus:outline-none focus:border-violet-500 bg-slate-50 text-sm"/>
                          <button onClick={() => saveSingleRoomNumber(originalIdx)} disabled={savingIdx !== null} className="bg-violet-600 hover:bg-violet-500 text-white font-black text-xs px-3 py-2.5 rounded-xl active:scale-95 disabled:bg-slate-300 transition-all">{savingIdx === originalIdx ? "⏳" : "💾 儲存"}</button>
                        </div>
                      </div>
                    );
                  })
                )}
                
                <button onClick={handleSaveAllAndSummary} className="w-full mt-6 bg-violet-700 hover:bg-violet-600 text-white font-black py-4 rounded-2xl shadow-md active:scale-95 transition-all text-center text-sm tracking-wide">⚡ 一鍵批次同步雲端並看總表 ➔</button>
              </div>
            )}

            {/* ================= 🗝️ 總房表快速對照 & 列印 ================= */}
            {view === "roomSummary" && (
              <div className="space-y-4">
                <div className="bg-slate-900 p-2 rounded-2xl flex gap-1 shadow-md sticky top-[72px] z-10 overflow-x-auto whitespace-nowrap hide-scrollbar">
                  {availableStages.map(stage => (
                    <button 
                      key={stage} 
                      onClick={() => setSelectedHotelStage(stage)}
                      className={`flex-1 min-w-[80px] px-2 py-2 text-[11px] font-black rounded-xl transition-all ${currentStage === stage ? "bg-violet-500 text-white shadow-sm" : "bg-transparent text-slate-400 hover:bg-slate-800"}`}
                    >
                      {stage}
                    </button>
                  ))}
                </div>

                <div className="bg-gradient-to-br from-violet-500 to-indigo-600 text-white p-4 rounded-2xl shadow-md shadow-violet-200 mb-2">
                  <p className="text-[9px] text-violet-200 font-black tracking-widest uppercase">Room-type Automation Stats</p>
                  <h3 className="text-sm font-black text-white mt-0.5 mb-3">🏨 【{currentStage}】房型總量清點</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {(() => {
                      const currentStats: { [key: string]: number } = {};
                      currentStageRooms.forEach(r => {
                        const rType = r.房型 ? String(r.房型).trim() : "未定房型";
                        currentStats[rType] = (currentStats[rType] || 0) + 1;
                      });
                      return Object.entries(currentStats).map(([rType, count]) => (
                        <div key={rType} className="bg-black/10 border border-white/20 p-2.5 rounded-xl flex justify-between items-center">
                          <span className="text-[11px] font-bold text-violet-100 truncate mr-1">{rType}</span>
                          <span className="text-base font-black text-white whitespace-nowrap">{count} <span className="text-[10px] text-violet-200 font-bold">間</span></span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                <button 
                  onClick={handlePrintAction} 
                  className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl shadow-md active:scale-95 transition-all text-sm tracking-widest flex items-center justify-center gap-2 hover:bg-slate-900"
                >
                  🖨️ 列印【{currentStage}】紙本房表 (供手寫)
                </button>

                {currentStageRooms.length === 0 ? (
                  <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
                    <p className="text-slate-400 text-sm font-bold">目前【{currentStage}】無排房資料</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentStageRooms.map((room, idx) => {
                      const guests = getGuestsList(room);
                      return (
                        <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-violet-300 transition-colors">
                          <div className="flex-1 pr-2">
                            <div className="text-[9px] text-violet-600 font-bold mb-0.5">{room.入住日期 ? room.入住日期.substring(5) : "當日"} | {room.飯店名稱}</div>
                            <div className="text-xs font-black text-slate-800 leading-relaxed">{guests.length > 0 ? guests.join(" 、 ") : <span className="text-slate-400 font-normal">未排房客</span>}</div>
                          </div>
                          <div className="ml-2 pl-3 border-l border-slate-200 flex flex-col items-center justify-center min-w-[55px]">
                            <span className="text-[9px] text-slate-400 font-bold mb-0.5">房號</span>
                            <span className={`text-base font-black ${room.實際房號 ? "text-violet-600" : "text-slate-300"}`}>{room.實際房號 || "—"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ================= 🖨️ 列印專屬版面一：房間排列表 ================= */}
      {view === "roomSummary" && (
        <div className="print-only w-full p-8 bg-white text-black min-h-screen">
          <div className="text-center border-b-2 border-black pb-4 mb-6">
            <h1 className="text-3xl font-black mb-2">TAKENO 日本系列團 - 住宿排房表</h1>
            <h2 className="text-xl font-bold">團號：{tourId} ｜ 住宿階段：【{currentStage}】</h2>
            <h3 className="text-lg font-bold mt-1">入住日期：{currentStageCheckInDate} ｜ 飯店名稱：{currentStageHotelName}</h3>
          </div>
          
          <table className="w-full">
            <thead>
              <tr>
                <th style={{ width: "15%" }}>入住房型</th>
                <th style={{ width: "60%" }}>旅客姓名 (同房名單)</th>
                <th style={{ width: "25%" }}>實際房號 (手寫區)</th>
              </tr>
            </thead>
            <tbody>
              {currentStageRooms.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-6">此階段尚無排房資料</td>
                </tr>
              ) : (
                currentStageRooms.map((room, idx) => {
                  const guests = getGuestsList(room);
                  return (
                    <tr key={idx}>
                      <td className="font-bold text-sm">{room.房型 || "未定"}</td>
                      <td className="font-bold text-base tracking-widest">{guests.join(" 、 ")}</td>
                      <td></td> 
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          <div className="mt-8 text-right text-xs font-bold">
            TAKENO EXPEDITION / 列印日期：{new Date().toLocaleDateString()}
          </div>
        </div>
      )}

      {/* ================= 🖨️ 列印專屬版面二：全團綜合大表 ================= */}
      {view === "menu" && (
        <div className="print-only w-full p-8 bg-white text-black min-h-screen">
          <div className="text-center border-b-2 border-black pb-4 mb-6">
            <h1 className="text-3xl font-black mb-2">TAKENO 日本系列團 - 全團綜合總表</h1>
            <h2 className="text-xl font-bold">團號：{tourId}</h2>
            <p className="text-sm font-medium mt-2">提示：建議使用「橫向 (Landscape)」方向進行列印以獲得最佳版面。</p>
          </div>
          
          <table className="w-full text-[10pt]">
            <thead>
              <tr>
                <th style={{ width: "15%" }}>姓名</th>
                <th style={{ width: "20%" }}>電話 / 緊急聯絡</th>
                <th style={{ width: "20%" }}>接送機模式 / 航班</th>
                <th style={{ width: "25%" }}>飲食禁忌 / 醫療病史</th>
                <th style={{ width: "20%" }}>現場備註</th>
              </tr>
            </thead>
            <tbody>
              {memberData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-6">尚無客戶資料</td>
                </tr>
              ) : (
                memberData.map((m, idx) => (
                  <tr key={idx}>
                    <td>
                      <div className="font-black text-base">{m.姓名}</div>
                    </td>
                    <td>
                      <div>📱 {m.手機 || "無"}</div>
                      <div className="mt-1 font-bold">🚨 {m.緊急聯絡人 || "無"}</div>
                      <div className="text-xs">({m.緊急聯絡人電話 || "無"})</div>
                    </td>
                    <td>
                      <div className="font-bold text-blue-700">接：{m.接機模式 || "未填寫"}</div>
                      <div className="font-bold text-green-700 mt-1">送：{m.送機模式 || "未填寫"}</div>
                      <div className="mt-1 text-xs">✈️ {m.航班資訊 || "—"}</div>
                    </td>
                    <td>
                      {m.飲食禁忌 ? <div className="text-red-600 font-bold">🚫 禁忌: {m.飲食禁忌}</div> : <div className="text-gray-400">無禁忌</div>}
                      {m.病史 && <div className="text-red-600 font-bold mt-1">⚠️ 病史: {m.病史}</div>}
                    </td>
                    <td className="text-xs">{m.備註 || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="mt-8 text-right text-xs font-bold">
            TAKENO EXPEDITION / 列印日期：{new Date().toLocaleDateString()}
          </div>
        </div>
      )}

    </>
  );
}
