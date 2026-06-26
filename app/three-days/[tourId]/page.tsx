"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type ViewState = "menu" | "checkin" | "customerInfo" | "equipment" | "meals" | "rooms" | "roomSummary" | "groupDetail";

interface OfflineQueueItem {
  name: string;
  field: string;
  value: string;
  originalIdx: number;
}

export default function TourDashboardPage() {
  const params = useParams();
  const tourId = params.tourId as string;

  const [view, setView] = useState<ViewState>("menu");
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "success" | "error" | "offline-pending">("idle");
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  
  const [memberData, setMemberData] = useState<any[]>([]);
  const [roomData, setRoomData] = useState<any[]>([]);
  const [tourGroups, setTourGroups] = useState<string[]>([]);

  const [mealStats, setMealStats] = useState<{ [key: string]: number }>({});
  const [dropoffStats, setDropoffStats] = useState<{ [key: string]: number }>({});
  const [roomTypeStats, setRoomTypeStats] = useState<{ [key: string]: number }>({});

  const [selectedMealFilter, setSelectedMealFilter] = useState<string | null>(null);
  const [selectedDropoffFilter, setSelectedDropoffFilter] = useState<string | null>(null);
  const [selectedRoomTypeFilter, setSelectedRoomTypeFilter] = useState<string | null>(null);

  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);

  const SHEETDB_URL = "https://sheetdb.io/api/v1/ng85gs3977snc";

  const calculateStats = (members: any[], rooms: any[]) => {
    const mealsMap: { [key: string]: number } = {};
    const dropoffMap: { [key: string]: number } = {};
    const groupsSet = new Set<string>();

    members.forEach((m: any) => {
      const meal = m.五合目餐點 ? String(m.五合目餐點).trim() : "常規餐點";
      mealsMap[meal] = (mealsMap[meal] || 0) + 1;

      const loc = m.下車地點 ? String(m.下車地點).trim() : "未填寫";
      dropoffMap[loc] = (dropoffMap[loc] || 0) + 1;

      const gName = m.分組 ? String(m.分組).trim() : "";
      if (gName && gName !== "無" && gName !== "undefined" && gName !== "null") {
        groupsSet.add(gName);
      }
    });
    setMealStats(mealsMap);
    setDropoffStats(dropoffMap);
    setTourGroups(Array.from(groupsSet).sort());

    const roomsMap: { [key: string]: number } = {};
    rooms.forEach((r: any) => {
      const rType = r.房型 ? String(r.房型).trim() : "未定房型";
      roomsMap[rType] = (roomsMap[rType] || 0) + 1;
    });
    setRoomTypeStats(roomsMap);
  };

  async function fetchData() {
    try {
      const cachedMembers = localStorage.getItem(`takeno_members_${tourId}`);
      const cachedRooms = localStorage.getItem(`takeno_rooms_${tourId}`);
      
      if (cachedMembers && cachedRooms) {
        const parsedM = JSON.parse(cachedMembers);
        const parsedR = JSON.parse(cachedRooms);
        setMemberData(parsedM);
        setRoomData(parsedR);
        calculateStats(parsedM, parsedR);
        setLoading(false);
      }

      const resMembers = await fetch(`${SHEETDB_URL}?sheet=3日出團總表`, { cache: "no-store" });
      const allMembers = await resMembers.json();
      const filteredMembers = Array.isArray(allMembers) ? allMembers.filter((m: any) => m.團號 === tourId) : [];

      const resRooms = await fetch(`${SHEETDB_URL}?sheet=3日排房表`, { cache: "no-store" });
      const allRooms = await resRooms.json();
      const filteredRooms = Array.isArray(allRooms) ? allRooms.filter((r: any) => r.團號 === tourId) : [];

      setMemberData(filteredMembers);
      setRoomData(filteredRooms);
      calculateStats(filteredMembers, filteredRooms);

      localStorage.setItem(`takeno_members_${tourId}`, JSON.stringify(filteredMembers));
      localStorage.setItem(`takeno_rooms_${tourId}`, JSON.stringify(filteredRooms));
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
      const savedQueue = localStorage.getItem(`takeno_queue_${tourId}`);
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
    calculateStats(updatedMembers, roomData);
    localStorage.setItem(`takeno_members_${tourId}`, JSON.stringify(updatedMembers));

    const memberName = updatedMembers[index].姓名;
    setSyncStatus("saving");

    try {
      const response = await fetch(`${SHEETDB_URL}/姓名/${encodeURIComponent(memberName)}?sheet=3日出團總表`, {
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
      localStorage.setItem(`takeno_queue_${tourId}`, JSON.stringify(updatedQueue));
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
        const response = await fetch(`${SHEETDB_URL}/姓名/${encodeURIComponent(item.name)}?sheet=3日出團總表`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: { [item.field]: item.value } })
        });
        if (response.ok) successCount++;
      }

      if (successCount === currentQueue.length) {
        setOfflineQueue([]);
        localStorage.removeItem(`takeno_queue_${tourId}`);
        setSyncStatus("success");
        fetchData();
      } else {
        const remained = currentQueue.slice(successCount);
        setOfflineQueue(remained);
        localStorage.setItem(`takeno_queue_${tourId}`, JSON.stringify(remained));
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
      const response = await fetch(`${SHEETDB_URL}/${encodeURIComponent(primaryInfo.key)}/${encodeURIComponent(primaryInfo.value)}?sheet=3日排房表`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { 實際房號: room.實際房號 || "" } })
      });
      if (response.ok) {
        setSyncStatus("success");
        localStorage.setItem(`takeno_rooms_${tourId}`, JSON.stringify(roomData));
      } else setSyncStatus("error");
    } catch (error) { 
      setSyncStatus("error"); 
    } finally { 
      setSavingIdx(null); 
    }
  };

  const handleSaveAllAndSummary = async () => {
    setLoading(true);
    setSyncStatus("saving");
    try {
      const promises = roomData.map(room => {
        const primaryInfo = getPrimaryGuestInfo(room);
        if (!primaryInfo) return Promise.resolve();
        return fetch(`${SHEETDB_URL}/${encodeURIComponent(primaryInfo.key)}/${encodeURIComponent(primaryInfo.value)}?sheet=3日排房表`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: { 實際房號: room.實際房號 || "" } })
        });
      });
      
      await Promise.all(promises);
      setSyncStatus("success");
      localStorage.setItem(`takeno_rooms_${tourId}`, JSON.stringify(roomData));
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

  const handlePrintAction = () => {
    window.print();
  };

  if (loading && memberData.length === 0) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center">
        <p className="text-emerald-400 font-bold animate-pulse">🌲 TAKENO 戰術快取啟動中...</p>
      </div>
    );
  }

  // === 名單過濾 ===
  const displayedCheckins = selectedDropoffFilter
    ? memberData.filter(m => (m.下車地點 ? String(m.下車地點).trim() : "未填寫") === selectedDropoffFilter)
    : [...memberData];

  displayedCheckins.sort((a, b) => (a.報到狀態 === "TRUE" ? 1 : -1));

  const checkinTotal = displayedCheckins.length;
  const checkinDone = displayedCheckins.filter(m => m.報到狀態 === "TRUE").length;
  const checkinRemain = checkinTotal - checkinDone;
  const checkinPercent = checkinTotal === 0 ? 0 : Math.round((checkinDone / checkinTotal) * 100);

  // === 裝備過濾 ===
  const equipmentMembers = memberData.filter((m) => m.裝備明細 && m.裝備明細.trim() !== "" && m.裝備明細 !== "無");
  const equipTotal = equipmentMembers.length;
  const equipGiven = equipmentMembers.filter(m => m.裝備借出 === "TRUE").length;
  const equipRemain = equipTotal - equipGiven;
  const equipPercent = equipTotal === 0 ? 0 : Math.round((equipGiven / equipTotal) * 100);

  // === 餐點過濾 ===
  const displayedMeals = selectedMealFilter
    ? memberData.filter(m => (m.五合目餐點 ? String(m.五合目餐點).trim() : "常規餐點") === selectedMealFilter)
    : [...memberData];
  displayedMeals.sort((a, b) => (a.餐點領取 === "TRUE" ? 1 : -1));

  const mealTotal = displayedMeals.length;
  const mealGiven = displayedMeals.filter(m => m.餐點領取 === "TRUE").length;
  const mealRemain = mealTotal - mealGiven;
  const mealPercent = mealTotal === 0 ? 0 : Math.round((mealGiven / mealTotal) * 100);

  // 🌟 房型過濾計算
  let displayedRooms = [...roomData];
  if (selectedRoomTypeFilter) {
    displayedRooms = displayedRooms.filter(r => (r.房型 ? String(r.房型).trim() : "未定房型") === selectedRoomTypeFilter);
  }

  return (
    <>
      {/* 🖨️ 列印樣式引擎 */}
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

      {/* 🚫 手機介面 */}
      <div className="no-print">
        <main className="min-h-screen bg-stone-100 flex flex-col items-center pb-12">
          
          {/* 🌲 頂部動態導覽列 (新增「換團」捷徑) */}
          <div className="w-full bg-emerald-950 text-white py-3 px-4 sticky top-0 z-20 flex flex-col gap-2 shadow-md border-b border-emerald-900">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[9px] font-black bg-amber-500 text-emerald-950 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  TAKENO 森林航線 - {tourId}
                </span>
                <h1 className="text-base font-black text-emerald-50 mt-0.5 tracking-wide">
                  {view === "menu" && "三日團嚮導選單"}
                  {view === "groupDetail" && "🥾 團隊分組總覽"}
                  {view === "checkin" && "📋 報到點名與接駁"}
                  {view === "customerInfo" && "👤 隊員與緊急聯絡"}
                  {view === "equipment" && "🎒 裝備確認與回報"}
                  {view === "meals" && "🍱 餐點發放點收"}
                  {view === "rooms" && "🏨 飯店分房登記"}
                  {view === "roomSummary" && "🗝️ 總房表快速對照"}
                </h1>
              </div>
              
              <div className="flex items-center gap-1.5">
                {view !== "menu" && (
                  <button onClick={() => { setView("menu"); setSelectedMealFilter(null); setSelectedDropoffFilter(null); setSelectedRoomTypeFilter(null); }} className="text-emerald-950 text-xs font-black bg-amber-400 px-3 py-1.5 rounded-xl shadow-sm active:scale-95 transition-all whitespace-nowrap">
                    ↩ 回選單
                  </button>
                )}
                {/* 🌟 換團與首頁捷徑 */}
                <Link href="/three-days" className="text-emerald-50 text-xs font-bold bg-emerald-700 border border-emerald-500 px-3 py-1.5 rounded-xl shadow-sm active:scale-95 whitespace-nowrap">
                  🔙 換團
                </Link>
                <Link href="/" className="text-emerald-50 text-xs font-bold bg-emerald-900 border border-emerald-700 px-3 py-1.5 rounded-xl shadow-sm active:scale-95 whitespace-nowrap">
                  🏠 首頁
                </Link>
              </div>
            </div>

            {/* ⚡ 跨線秒切捷徑按鈕列 */}
            <div className="flex items-center gap-2 border-t border-emerald-800/50 pt-1.5 text-xs">
              <span className="text-[10px] font-black text-emerald-400/80 whitespace-nowrap">🧭 快速傳送:</span>
              <Link href={`/five-days/${tourId}`} className="bg-sky-700 text-white font-black px-2.5 py-1 rounded-lg border border-sky-600 shadow-sm active:scale-95">
                🌊 切换五日團
              </Link>
              <Link href={`/japan-series/${tourId}`} className="bg-indigo-600 text-white font-black px-2.5 py-1 rounded-lg border border-indigo-500 shadow-sm active:scale-95">
                🧗 切换日本線
              </Link>
            </div>
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
                  syncStatus === "success" ? "bg-emerald-800 text-emerald-50 border-emerald-700" :
                  syncStatus === "error" ? "bg-red-100 text-red-800 border-red-200" : "bg-stone-200/80 text-stone-600 border-stone-300"
                }`}>
                  {syncStatus === "saving" && "⏳ 正在傳送至雲端表單中..."}
                  {syncStatus === "success" && "🌲 雲端實時同步完畢"}
                  {syncStatus === "error" && "❌ 高山連線失敗，已安全寫入手機本地暫存"}
                  {syncStatus === "idle" && "🌿 高山戰術離線大腦連線就緒"}
                </div>
              )}
            </div>
          )}

          <div className="w-full max-w-md px-4 mt-4">
            
            {view === "menu" && (
              <div className="grid grid-cols-1 gap-4">
                {offlineQueue.length > 0 && (
                  <button onClick={handleRetrySyncAll} className="bg-red-500 text-white p-3 rounded-2xl text-xs font-black text-center shadow-md animate-bounce border-2 border-red-400">
                    🚨 注意：您有 {offlineQueue.length} 筆離線變更，點此同步！
                  </button>
                )}

                <button onClick={handlePrintAction} className="bg-emerald-900 text-white p-4 rounded-2xl text-sm font-black text-center shadow-md active:scale-95 transition-all border border-emerald-800 flex justify-center items-center gap-2">
                  🖨️ 列印【全團綜合大表】(建議橫向)
                </button>

                <button onClick={() => setView("groupDetail")} className="flex items-center justify-between bg-gradient-to-r from-emerald-800 to-emerald-900 p-5 rounded-2xl shadow-md border border-emerald-700 text-white active:scale-[0.98] transition-all">
                  <div className="text-left">
                    <h2 className="text-lg font-black text-amber-400">🥾 登山分組看名單</h2>
                    <p className="text-xs text-emerald-200 mt-1">切換查看各組成員、報到狀態與備註</p>
                  </div>
                  <span className="text-xl text-amber-400 font-bold">➔</span>
                </button>
                <button onClick={() => setView("checkin")} className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-stone-200 active:scale-[0.98] transition-all hover:border-emerald-300">
                  <div className="text-left">
                    <h2 className="text-lg font-black text-stone-800">📋 報到點名與接駁確認</h2>
                    <p className="text-xs text-stone-500 mt-1">未到人員置頂、地點過濾與現場備註</p>
                  </div>
                  <span className="text-xl text-emerald-700 font-bold">➔</span>
                </button>
                <button onClick={() => setView("customerInfo")} className="flex items-center justify-between bg-gradient-to-r from-stone-800 to-stone-900 text-white p-5 rounded-2xl shadow-md border border-stone-700 active:scale-[0.98] transition-all">
                  <div className="text-left">
                    <h2 className="text-lg font-black text-amber-400">👤 隊員聯絡與緊急資料專區</h2>
                    <p className="text-xs text-stone-300 mt-1">高山緊急撤退調度、一鍵直接撥號</p>
                  </div>
                  <span className="text-xl text-amber-400 font-bold">➔</span>
                </button>
                <button onClick={() => setView("equipment")} className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-stone-200 active:scale-[0.98] transition-all hover:border-emerald-300">
                  <div className="text-left">
                    <h2 className="text-lg font-black text-stone-800">🎒 裝備確認與問題回報</h2>
                    <p className="text-xs text-stone-500 mt-1">租借明細確認、新增問題回報</p>
                  </div>
                  <span className="text-xl text-emerald-700 font-bold">➔</span>
                </button>
                <button onClick={() => setView("meals")} className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-stone-200 active:scale-[0.98] transition-all hover:border-emerald-300">
                  <div className="text-left">
                    <h2 className="text-lg font-black text-stone-800">🍱 登山口餐點發放</h2>
                    <p className="text-xs text-stone-500 mt-1">餐點分類篩選、自動進度條與發放點收</p>
                  </div>
                  <span className="text-xl text-emerald-700 font-bold">➔</span>
                </button>
                <button onClick={() => setView("rooms")} className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-stone-200 active:scale-[0.98] transition-all hover:border-emerald-300">
                  <div className="text-left">
                    <h2 className="text-lg font-black text-stone-800">🏨 飯店分房登記</h2>
                    <p className="text-xs text-stone-500 mt-1">填寫實際分配房號、<span className="text-emerald-700 font-bold">支援房型過濾</span></p>
                  </div>
                  <span className="text-xl text-emerald-700 font-bold">➔</span>
                </button>
                <button onClick={() => setView("roomSummary")} className="flex items-center justify-between bg-emerald-50 p-5 rounded-2xl shadow-sm border-2 border-emerald-600/40 active:scale-[0.98] transition-all">
                  <div className="text-left">
                    <h2 className="text-lg font-black text-emerald-900">🗝️ 飯店總房表快速對照</h2>
                    <p className="text-xs text-emerald-700 mt-1">櫃檯領鑰匙專用、<span className="font-bold text-emerald-950">篩選列印紙本房表</span></p>
                  </div>
                  <span className="text-xl text-emerald-600 font-bold">➔</span>
                </button>
              </div>
            )}

            {/* ================= 📋 報到點名與接駁確認 ================= */}
            {view === "checkin" && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white p-4 rounded-2xl shadow-md border border-emerald-800">
                  <div className="flex justify-between items-end mb-3">
                    <div>
                      <p className="text-[9px] text-emerald-400 font-black tracking-widest uppercase">Drop-off Filter & Stats</p>
                      <h3 className="text-sm font-black text-emerald-100 mt-0.5">📍 點擊下方地點可快速篩選名單</h3>
                    </div>
                    {selectedDropoffFilter && (
                      <button onClick={() => setSelectedDropoffFilter(null)} className="text-[10px] bg-stone-700/80 hover:bg-stone-600 text-stone-200 px-2 py-1 rounded-md border border-stone-500 transition-all active:scale-95">✖ 取消篩選</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {Object.entries(dropoffStats).map(([loc, count]) => {
                      const isSelected = selectedDropoffFilter === loc;
                      return (
                        <button key={loc} onClick={() => setSelectedDropoffFilter(isSelected ? null : loc)} className={`p-2.5 rounded-xl flex justify-between items-center transition-all active:scale-95 text-left ${isSelected ? "bg-emerald-700 border-2 border-amber-400 ring-2 ring-amber-400/30 shadow-lg" : "bg-stone-950/40 border border-emerald-800/40 opacity-80 hover:opacity-100"}`}>
                          <span className={`text-xs font-bold truncate mr-1 ${isSelected ? "text-white" : "text-stone-300"}`}>{loc}</span>
                          <span className={`text-base font-black whitespace-nowrap ${isSelected ? "text-amber-300" : "text-amber-500"}`}>{count} <span className="text-[10px] font-bold opacity-70">人</span></span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="bg-stone-950/40 p-3 rounded-xl border border-emerald-800/40">
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="text-xs text-stone-300 font-bold">{selectedDropoffFilter ? `「${selectedDropoffFilter}」報到進度` : "全團總報到進度"}</span>
                      <div className="text-right leading-none">
                        <span className="text-lg font-black text-emerald-400">{checkinDone}</span>
                        <span className="text-[10px] text-stone-500 font-bold mx-1">/</span>
                        <span className="text-xs font-bold text-stone-400">{checkinTotal}</span>
                      </div>
                    </div>
                    <div className="w-full bg-stone-800 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all duration-500 ease-out ${checkinRemain === 0 && checkinTotal > 0 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${checkinPercent}%` }}></div>
                    </div>
                  </div>
                </div>

                {displayedCheckins.map((member, _idx) => {
                  const originalIdx = memberData.findIndex(m => m.姓名 === member.姓名);
                  const isVegetarian = String(member.病史 || "").includes("素") || String(member.五合目餐點 || "").includes("素");
                  const isCheckedIn = member.報到狀態 === "TRUE";

                  return (
                    <div key={originalIdx} className={`bg-white border-2 p-4 rounded-2xl shadow-sm space-y-3 transition-colors ${isCheckedIn ? "border-stone-200/50 opacity-80" : "border-emerald-500/50 shadow-md"}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-black text-stone-800">{member.姓名}</h3>
                            {!isCheckedIn && <span className="text-[10px] bg-red-100 text-red-700 font-black px-1.5 py-0.5 rounded-md animate-pulse">待報到</span>}
                            {isVegetarian && <span className="text-[10px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded-md">🥬 素食</span>}
                          </div>
                        </div>
                        <span className="bg-stone-100 text-stone-600 text-xs px-2.5 py-1 rounded-lg font-bold border border-stone-200">{member.分組 || "未編組"}</span>
                      </div>
                      {member.病史 && <div className="bg-orange-50 border border-orange-200 text-orange-800 text-xs p-2.5 rounded-xl font-bold">⚠️ 後台備註/病史：{member.病史}</div>}
                      <div className="pt-1">
                        <label className="text-[10px] font-black text-stone-400 block mb-1 pl-1">📝 現場工作人員備註 (自動儲存)</label>
                        <input type="text" placeholder="現場追加註記..." value={member.備註 || ""} onChange={(e) => handleLocalTextChange(originalIdx, "備註", e.target.value)} onBlur={(e) => handleMemberFieldUpdate(originalIdx, "備註", e.target.value)} className="w-full text-xs font-bold border-2 border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-600 bg-stone-50 text-stone-800 shadow-inner"/>
                      </div>
                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex justify-between items-center mt-1">
                        <div>
                          <p className="text-[10px] text-emerald-700 font-black mb-0.5">📍 下車地點</p>
                          <p className="text-sm font-black text-stone-700">{member.下車地點 || "未填寫"}</p>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-emerald-200 shadow-sm active:scale-95 transition-all">
                          <input type="checkbox" className="w-5 h-5 rounded text-emerald-700" checked={isCheckedIn} onChange={(e) => handleMemberFieldUpdate(originalIdx, "報到狀態", e.target.checked ? "TRUE" : "FALSE")}/>
                          <span className={`font-black text-sm ${isCheckedIn ? "text-emerald-900" : "text-stone-400"}`}>{isCheckedIn ? "已報到" : "確認報到"}</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ================= 🏨 飯店分房登記 (加入房型過濾面版) ================= */}
            {view === "rooms" && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-white p-4 rounded-2xl shadow-md border border-emerald-700">
                  <div className="flex justify-between items-end mb-3">
                    <div>
                      <p className="text-[9px] text-emerald-400 font-black tracking-widest uppercase">Room Type Filter</p>
                      <h3 className="text-sm font-black text-white mt-0.5">🏨 點擊過濾房型</h3>
                    </div>
                    {selectedRoomTypeFilter && (
                      <button onClick={() => setSelectedRoomTypeFilter(null)} className="text-[10px] bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded-md transition-all active:scale-95">✖ 取消</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(roomTypeStats).map(([rType, count]) => {
                      const isSelected = selectedRoomTypeFilter === rType;
                      return (
                        <button key={rType} onClick={() => setSelectedRoomTypeFilter(isSelected ? null : rType)} className={`p-2.5 rounded-xl flex justify-between items-center transition-all ${isSelected ? "bg-white text-emerald-950 shadow-md scale-[1.02]" : "bg-black/10 border border-white/20 hover:bg-black/20"}`}>
                          <span className={`text-[10px] font-bold truncate mr-1 ${isSelected ? "text-emerald-900" : "text-emerald-100"}`}>{rType}</span>
                          <span className={`text-base font-black whitespace-nowrap ${isSelected ? "text-emerald-800" : "text-white"}`}>{count} <span className="text-[10px] font-normal">間</span></span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {displayedRooms.length === 0 ? (
                  <div className="text-center py-10 bg-white rounded-2xl border border-stone-200">
                    <p className="text-stone-400 text-sm font-bold">目前無符合條件的房型資料</p>
                  </div>
                ) : (
                  displayedRooms.map((room) => {
                    const originalIdx = roomData.findIndex(r => r === room);
                    const guests = getGuestsList(room);
                    return (
                      <div key={originalIdx} className="bg-white border border-stone-200 p-4 rounded-2xl shadow-sm">
                        <div className="flex justify-between items-center border-b border-stone-100 pb-3 mb-3">
                          <div>
                            <span className="text-[10px] bg-stone-100 text-stone-600 font-bold px-2 py-1 rounded-md border border-stone-200">入住：{room.入住日期 ? room.入住日期.substring(5) : "當日"}</span>
                            <h3 className="text-base font-black text-stone-800 mt-2">{room.飯店名稱}</h3>
                          </div>
                          <span className="text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">{room.房型}</span>
                        </div>
                        <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 mb-3">
                          <p className="text-[10px] text-stone-400 font-bold mb-1">入住成員名單</p>
                          <p className="text-sm font-black text-stone-700 tracking-wide">{guests.length > 0 ? guests.join(" 、 ") : <span className="text-stone-400 font-normal text-xs">未排定房客</span>}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-stone-700 whitespace-nowrap">分配房號：</span>
                          <input type="text" placeholder="填寫實際房號" value={room.實際房號 || ""} onChange={(e) => handleRoomNumberChange(originalIdx, e.target.value)} className="flex-1 min-w-0 border-2 border-stone-300 rounded-xl px-3 py-2 font-black text-stone-800 focus:outline-none focus:border-emerald-600 bg-stone-50 text-sm"/>
                          <button onClick={() => saveSingleRoomNumber(originalIdx)} disabled={savingIdx !== null} className="bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs px-3 py-2.5 rounded-xl active:scale-95 disabled:bg-stone-300 transition-all">{savingIdx === originalIdx ? "⏳" : "💾 儲存"}</button>
                        </div>
                      </div>
                    );
                  })
                )}
                <button onClick={handleSaveAllAndSummary} className="w-full mt-6 bg-emerald-700 text-white font-black py-4 rounded-2xl shadow-md active:scale-95 transition-all text-center text-sm tracking-wide">🌲 智慧併發一鍵儲存並看總表 ➔</button>
              </div>
            )}

            {/* ================= 🗝️ 總房表快速對照 & 列印 ================= */}
            {view === "roomSummary" && (
              <div className="space-y-3">
                <div className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white p-4 rounded-2xl shadow-md border border-emerald-800 mb-2">
                  <div className="flex justify-between items-end mb-3">
                    <div>
                      <p className="text-[9px] text-emerald-400 font-black tracking-widest uppercase">Room-type Automation Stats</p>
                      <h3 className="text-sm font-black text-white mt-0.5">🏨 點擊過濾房型 (向櫃檯拿鑰匙專用)</h3>
                    </div>
                    {selectedRoomTypeFilter && (
                      <button onClick={() => setSelectedRoomTypeFilter(null)} className="text-[10px] bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded-md transition-all active:scale-95">✖ 取消</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(roomTypeStats).map(([rType, count]) => {
                      const isSelected = selectedRoomTypeFilter === rType;
                      return (
                        <button key={rType} onClick={() => setSelectedRoomTypeFilter(isSelected ? null : rType)} className={`p-2.5 rounded-xl flex justify-between items-center transition-all ${isSelected ? "bg-white text-emerald-950 shadow-md scale-[1.02]" : "bg-stone-950/40 border border-emerald-800/40"}`}>
                          <span className={`text-xs font-bold truncate mr-1 ${isSelected ? "text-emerald-900" : "text-stone-300"}`}>{rType}</span>
                          <span className={`text-base font-black ${isSelected ? "text-emerald-800" : "text-amber-400"}`}>{count} <span className="text-[10px] font-bold">間</span></span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button onClick={handlePrintAction} className="w-full bg-slate-800 text-white font-black py-4 rounded-2xl shadow-md active:scale-95 transition-all text-sm tracking-widest flex items-center justify-center gap-2 hover:bg-slate-900">
                  🖨️ 列印 {selectedRoomTypeFilter ? `【${selectedRoomTypeFilter}】` : ""} 紙本房表 (供手寫用)
                </button>

                {displayedRooms.length === 0 ? (
                  <div className="text-center py-10 bg-white rounded-2xl border border-stone-200">
                    <p className="text-stone-400 text-sm font-bold">目前無符合條件的房型資料</p>
                  </div>
                ) : (
                  displayedRooms.map((room, idx) => {
                    const guests = getGuestsList(room);
                    return (
                      <div key={idx} className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-stone-200">
                        <div className="flex-1">
                          <div className="text-[10px] text-stone-400 font-bold mb-1">{room.入住日期 ? room.入住日期.substring(5) : ""} | {room.飯店名稱}</div>
                          <div className="text-sm font-black text-stone-800">{guests.length > 0 ? guests.join(" 、 ") : <span className="text-stone-400 font-normal text-xs">未排定房客</span>}</div>
                        </div>
                        <div className="ml-4 pl-4 border-l border-stone-200 flex flex-col items-center justify-center min-w-[70px]">
                          <span className="text-[10px] text-stone-400 font-bold mb-0.5">房號</span>
                          <span className={`text-xl font-black ${room.實際房號 ? "text-emerald-700" : "text-stone-300"}`}>{room.實際房號 || "未填"}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ================= 🍱 🌟 完整回歸：登山口餐點發放統計與置頂名單 ================= */}
            {view === "meals" && (
              <div className="space-y-4">
                {/* 智慧分類統計過濾面版 */}
                <div className="bg-gradient-to-br from-emerald-900 to-stone-900 text-white p-4 rounded-2xl shadow-md border border-emerald-800">
                  <div className="flex justify-between items-end mb-3">
                    <div>
                      <p className="text-[9px] text-emerald-400 font-black tracking-widest uppercase">Catering Filter & Stats</p>
                      <h3 className="text-sm font-black text-emerald-100 mt-0.5">🍱 點擊下方餐點分類可快速篩選名單</h3>
                    </div>
                    {selectedMealFilter && (
                      <button onClick={() => setSelectedMealFilter(null)} className="text-[10px] bg-stone-700/80 hover:bg-stone-600 text-stone-200 px-2 py-1 rounded-md border border-stone-500 transition-all active:scale-95">
                        ✖ 取消篩選
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {Object.entries(mealStats).map(([meal, count]) => {
                      const isSelected = selectedMealFilter === meal;
                      return (
                        <button 
                          key={meal} 
                          onClick={() => setSelectedMealFilter(isSelected ? null : meal)}
                          className={`p-2.5 rounded-xl flex justify-between items-center transition-all active:scale-95 text-left
                            ${isSelected 
                              ? "bg-emerald-700 border-2 border-amber-400 ring-2 ring-amber-400/30 shadow-lg" 
                              : "bg-stone-950/40 border border-emerald-800/40 opacity-80 hover:opacity-100"}`}
                        >
                          <span className={`text-xs font-bold truncate mr-1 ${isSelected ? "text-white" : "text-stone-300"}`}>{meal}</span>
                          <span className={`text-base font-black whitespace-nowrap ${isSelected ? "text-amber-300" : "text-amber-500"}`}>
                            {count} <span className="text-[10px] font-bold opacity-70">份</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* 即時配餐進度條 */}
                  <div className="bg-stone-950/40 p-3 rounded-xl border border-emerald-800/40">
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="text-xs text-stone-300 font-bold">
                        {selectedMealFilter ? `「${selectedMealFilter}」發放進度` : "全團總發放進度"}
                      </span>
                      <div className="text-right leading-none">
                        <span className="text-lg font-black text-emerald-400">{mealGiven}</span>
                        <span className="text-[10px] text-stone-500 font-bold mx-1">/</span>
                        <span className="text-xs font-bold text-stone-400">{mealTotal}</span>
                      </div>
                    </div>
                    <div className="w-full bg-stone-800 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all duration-500 ease-out ${mealRemain === 0 && mealTotal > 0 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${mealPercent}%` }}></div>
                    </div>
                  </div>
                  <p className="text-[10px] text-stone-400 font-bold text-right mt-2">尚有 <span className="text-amber-400 font-black">{mealRemain}</span> 份餐點待點收</p>
                </div>

                {/* 隊員配餐名單卡片 (未領取者自動霸道置頂) */}
                {displayedMeals.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-stone-400 text-sm font-bold">查無符合條件的餐點名單</p>
                  </div>
                ) : (
                  displayedMeals.map((member, _idx) => {
                    const originalIdx = memberData.findIndex(m => m.姓名 === member.姓名);
                    const isVegetarian = String(member.病史 || "").includes("素") || String(member.五合目餐點 || "").includes("素");
                    const isClaimed = member.餐點領取 === "TRUE";

                    return (
                      <div key={originalIdx} className={`bg-white border-2 p-4 rounded-2xl shadow-sm space-y-3 transition-colors ${isClaimed ? "border-stone-200/50 opacity-80" : "border-emerald-500/50 shadow-md shadow-emerald-50"}`}>
                        <div className="flex justify-between items-center border-b border-stone-100 pb-2 mb-3">
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-stone-800">{member.姓名}</h3>
                            {!isClaimed && <span className="text-[10px] bg-red-100 text-red-700 font-black px-1.5 py-0.5 rounded-md animate-pulse">待領取</span>}
                            {isVegetarian && <span className="text-[10px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded-md">🥬 素食</span>}
                          </div>
                          <span className="text-xs font-bold text-stone-500">{member.分組 || "未編組"}</span>
                        </div>
                        <div className="bg-orange-50/60 border border-orange-100 rounded-xl p-3 flex justify-between items-center">
                          <div>
                            <p className="text-[10px] text-orange-800 font-black mb-0.5">🍱 五合目餐食</p>
                            <p className="text-sm font-black text-stone-800">{member.五合目餐點 || "常規餐點"}</p>
                          </div>
                          <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-orange-200 shadow-sm active:scale-95 transition-all cursor-pointer">
                            <input type="checkbox" className="w-5 h-5 rounded text-orange-600" checked={isClaimed} onChange={(e) => handleMemberFieldUpdate(originalIdx, "餐點領取", e.target.checked ? "TRUE" : "FALSE")}/>
                            <span className={`font-black text-xs ${isClaimed ? "text-orange-950" : "text-stone-400"}`}>{isClaimed ? "已點收" : "確認領取"}</span>
                          </label>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* 客戶聯絡、分組名單、裝備視圖保持原樣 */}
            {view === "customerInfo" && (
              <div className="space-y-4">
                {memberData.map((member, idx) => (
                  <div key={idx} className="bg-white border-2 border-stone-200 rounded-2xl shadow-sm p-4 space-y-3.5">
                    <div className="flex justify-between items-center border-b border-stone-100 pb-2.5">
                      <div>
                        <h3 className="text-lg font-black text-stone-800">{member.姓名}</h3>
                        <p className="text-[10px] text-stone-400 font-bold mt-0.5 uppercase tracking-wider">TAKENO Member Card</p>
                      </div>
                      <span className="bg-stone-900 text-amber-400 text-xs px-2.5 py-1 rounded-xl font-black border border-stone-950">{member.分組 && member.分組 !== "無" ? member.分組 : "未編組"}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5">
                      <div className="bg-stone-50 border border-stone-200 p-3 rounded-xl flex justify-between items-center shadow-xs">
                        <div>
                          <p className="text-[10px] text-stone-400 font-black mb-0.5">📱 隊員本人電話</p>
                          <p className="text-sm font-black text-stone-700">{member.手機 || "未登記"}</p>
                        </div>
                        {member.手機 && <a href={`tel:${member.手機.replace(/[^0-9+]/g, "")}`} className="bg-emerald-700 text-white text-xs font-black px-3 py-2 rounded-xl border border-emerald-800 shadow-sm active:scale-95 transition-all text-center">📞 撥打</a>}
                      </div>
                      <div className="bg-orange-50/60 border border-orange-100 p-3 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="text-[10px] text-orange-800 font-black">🚨 緊急聯絡家屬</p>
                          <span className="text-xs font-black text-stone-800 bg-white px-2 py-0.5 rounded-md border border-orange-200">{member.緊急聯絡人 || "未填寫"}</span>
                        </div>
                        <div className="bg-white border border-orange-100 p-2.5 rounded-lg flex justify-between items-center mt-1">
                          <div>
                            <p className="text-[9px] text-stone-400 font-bold">🏠 家屬聯絡電話</p>
                            <p className="text-sm font-black text-stone-800">{member.緊急聯絡人電話 || "未登記"}</p>
                          </div>
                          {member.緊急聯絡人電話 && <a href={`tel:${member.緊急聯絡人電話.replace(/[^0-9+]/g, "")}`} className="bg-orange-600 text-white text-xs font-black px-3 py-2 rounded-xl border border-orange-700 shadow-sm active:scale-95 transition-all text-center">☎️ 呼叫家屬</a>}
                        </div>
                      </div>
                    </div>
                    {member.病史 && <div className="text-[11px] bg-red-50 border border-red-100 text-red-700 p-2 rounded-xl font-bold">⚠️ 醫療病史備忘：{member.病史}</div>}
                  </div>
                ))}
              </div>
            )}
            {view === "equipment" && (
              <div className="space-y-4">
                {equipmentMembers.map((member, idx) => {
                  const originalIdx = memberData.findIndex(m => m.姓名 === member.姓名);
                  return (
                    <div key={idx} className="bg-white border border-stone-200 p-4 rounded-2xl shadow-sm space-y-3">
                      <div className="flex justify-between items-center border-b border-stone-100 pb-2">
                        <h3 className="text-base font-black text-stone-800">{member.姓名}</h3>
                        <span className="text-xs font-bold text-stone-500">{member.分組 || "未編組"}</span>
                      </div>
                      <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-3">
                        <div>
                          <p className="text-[10px] text-emerald-800 font-black mb-1">🎒 租借明細</p>
                          <p className="text-sm font-black text-stone-700">{member.裝備明細}</p>
                        </div>
                        <div className="border-t border-stone-200/60 pt-2">
                          <label className="text-[10px] font-black text-red-700 block mb-1 pl-0.5">🚨 裝備損壞/尺寸不合問題回報 (離開點選自動儲存)</label>
                          <input type="text" placeholder="例如：登山杖第三節損壞..." value={member.問題回報 || ""} onChange={(e) => handleLocalTextChange(originalIdx, "問題回報", e.target.value)} onBlur={(e) => handleMemberFieldUpdate(originalIdx, "問題回報", e.target.value)} className="w-full text-xs font-bold border border-red-200 rounded-lg px-3 py-2 bg-red-50 text-slate-800 placeholder-red-700/40"/>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <label className="flex-1 flex justify-center items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-stone-200 active:scale-95 transition-all cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 text-emerald-700 rounded" checked={member.裝備借出 === "TRUE"} onChange={(e) => handleMemberFieldUpdate(originalIdx, "裝備借出", e.target.checked ? "TRUE" : "FALSE")}/>
                            <span className="font-black text-stone-700 text-xs">已借出</span>
                          </label>
                          <label className="flex-1 flex justify-center items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-stone-200 active:scale-95 transition-all cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 text-emerald-700 rounded" checked={member.裝備歸還 === "TRUE"} onChange={(e) => handleMemberFieldUpdate(originalIdx, "裝備歸還", e.target.checked ? "TRUE" : "FALSE")}/>
                            <span className="font-black text-stone-700 text-xs">已歸還</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {view === "groupDetail" && (
              <div className="space-y-6">
                {tourGroups.map((groupName) => {
                  const groupMembers = memberData.filter((m) => m.分組 && String(m.分組).trim() === groupName);
                  return (
                    <div key={groupName} className="bg-white border-2 border-emerald-800/20 rounded-2xl shadow-sm overflow-hidden">
                      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white px-4 py-3 flex justify-between items-center">
                        <span className="text-base font-black tracking-wide">⛰️ {groupName} 名單</span>
                        <span className="text-xs bg-amber-500 text-stone-950 font-bold px-2 py-0.5 rounded-full">共 {groupMembers.length} 人</span>
                      </div>
                      <div className="p-1 divide-y divide-stone-100">
                        {groupMembers.map((member, idx) => {
                          const isVegetarian = String(member.病史 || "").includes("素") || String(member.五合目餐點 || "").includes("素");
                          return (
                            <div key={idx} className="p-3 bg-white hover:bg-stone-50/50 space-y-2">
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-stone-800 text-base">{member.姓名}</span>
                                    {isVegetarian && <span className="text-[10px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded-md">🥬 素食</span>}
                                  </div>
                                  <span className="text-xs text-stone-400 font-medium block mt-0.5">📱 {member.手機 || "無"}</span>
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded-md border ${member.報到狀態 === "TRUE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-stone-50 text-stone-400 border-slate-200"}`}>{member.報到狀態 === "TRUE" ? "✅ 已報到" : "⏳ 未報到"}</span>
                              </div>
                              {member.備註 && (
                                <div className="text-xs bg-stone-50 border border-stone-200 text-stone-600 p-2 rounded-xl font-medium">
                                  📝 現場註記：{member.備註}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </main>
      </div>

      {/* ================= 🖨️ 列印專屬版面一：房間排列表 (吃過濾結果) ================= */}
      {view === "roomSummary" && (
        <div className="print-only w-full p-8 bg-white text-black min-h-screen">
          <div className="text-center border-b-2 border-black pb-4 mb-6">
            <h1 className="text-3xl font-black mb-2">TAKENO 富士山三日團 - 住宿排房表</h1>
            <h2 className="text-xl font-bold">
              團號：{tourId}
              {selectedRoomTypeFilter && <span className="ml-2">｜ <span className="bg-black text-white px-2 py-0.5 rounded">過濾房型：{selectedRoomTypeFilter}</span></span>}
            </h2>
          </div>
          
          <table className="w-full">
            <thead>
              <tr>
                <th style={{ width: "20%" }}>入住日期 / 飯店</th>
                <th style={{ width: "15%" }}>房型</th>
                <th style={{ width: "45%" }}>旅客姓名 (同房名單)</th>
                <th style={{ width: "20%" }}>實際房號 (手寫區)</th>
              </tr>
            </thead>
            <tbody>
              {displayedRooms.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-6">此篩選條件下無排房資料</td></tr>
              ) : (
                displayedRooms.map((room, idx) => {
                  const guests = getGuestsList(room);
                  return (
                    <tr key={idx}>
                      <td className="font-bold text-xs">{room.入住日期 ? room.入住日期.substring(5) : ""} <br/> {room.飯店名稱}</td>
                      <td className="font-bold text-sm">{room.房型 || "未定"}</td>
                      <td className="font-bold text-base tracking-widest">{guests.join(" 、 ")}</td>
                      <td></td> 
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          <div className="mt-8 text-right text-xs font-bold">TAKENO EXPEDITION / 列印日期：{new Date().toLocaleDateString()}</div>
        </div>
      )}

      {/* ================= 🖨️ 列印專屬版面二：全團綜合大表 ================= */}
      {view === "menu" && (
        <div className="print-only w-full p-8 bg-white text-black min-h-screen">
          <div className="text-center border-b-2 border-black pb-4 mb-6">
            <h1 className="text-3xl font-black mb-2">TAKENO 富士山三日團 - 全團綜合總表</h1>
            <h2 className="text-xl font-bold">團號：{tourId}</h2>
            <p className="text-sm font-medium mt-2">提示：建議使用「橫向 (Landscape)」方向進行列印以獲得最佳版面。</p>
          </div>
          
          <table className="w-full text-[10pt]">
            <thead>
              <tr>
                <th style={{ width: "12%" }}>姓名 / 分組</th>
                <th style={{ width: "16%" }}>電話 / 緊急聯絡</th>
                <th style={{ width: "15%" }}>下車地點</th>
                <th style={{ width: "18%" }}>餐點 / 病史</th>
                <th style={{ width: "20%" }}>裝備明細</th>
                <th style={{ width: "19%" }}>現場備註</th>
              </tr>
            </thead>
            <tbody>
              {memberData.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-6">尚無客戶資料</td></tr>
              ) : (
                memberData.map((m, idx) => (
                  <tr key={idx}>
                    <td>
                      <div className="font-black text-sm">{m.姓名}</div>
                      <div className="text-xs text-gray-600 mt-1">{m.分組 || "未編組"}</div>
                    </td>
                    <td>
                      <div>📱 {m.手機 || "無"}</div>
                      <div className="mt-1 font-bold">🚨 {m.緊急聯絡人 || "無"}</div>
                      <div>({m.緊急聯絡人電話 || "無"})</div>
                    </td>
                    <td><div className="font-bold">{m.下車地點 || "未填寫"}</div></td>
                    <td>
                      <div className="font-bold">{m.五合目餐點 || "常規"}</div>
                      {m.病史 && <div className="text-red-600 font-bold mt-1">病史: {m.病史}</div>}
                    </td>
                    <td><div className="text-xs">{m.裝備明細 || "無"}</div></td>
                    <td className="text-xs">{m.備註 || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <div className="mt-8 text-right text-xs font-bold">TAKENO EXPEDITION / 列印日期：{new Date().toLocaleDateString()}</div>
        </div>
      )}
    </>
  );
}
