"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type ViewState = "menu" | "checkin" | "customerInfo" | "equipment" | "meals" | "rooms" | "roomSummary" | "bikes" | "groupDetail";

interface OfflineQueueItem {
  name: string;
  field: string;
  value: string;
  originalIdx: number;
}

export default function FiveDaysDashboardPage() {
  const params = useParams();
  const tourId = params.tourId as string;

  const [view, setView] = useState<ViewState>("menu");
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "success" | "error" | "offline-pending">("idle");
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  
  const [memberData, setMemberData] = useState<any[]>([]);
  const [roomData, setRoomData] = useState<any[]>([]);
  const [tourGroups, setTourGroups] = useState<string[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueueItem[]>([]);

  const [selectedTransferFilter, setSelectedTransferFilter] = useState<string | null>(null);
  const [transferStats, setTransferStats] = useState<{ [key: string]: number }>({});
  
  const [mealStats, setMealStats] = useState<{ [key: string]: number }>({});
  const [bikeStats, setBikeStats] = useState<{ [key: string]: number }>({});
  const [selectedMealFilter, setSelectedMealFilter] = useState<string | null>(null);
  const [selectedBikeFilter, setSelectedBikeFilter] = useState<string | null>(null);

  const [selectedHotelStage, setSelectedHotelStage] = useState<string>("東京首日");

  const SHEETDB_URL = "https://sheetdb.io/api/v1/ng85gs3977snc";

  const getBikePrice = (typeString: string) => {
    if (!typeString) return 0;
    if (typeString.includes("電動")) return 4000;
    if (typeString.includes("越野")) return 3000;
    if (typeString.includes("一般")) return 2000;
    return 0; 
  };

  const calculateStats = (members: any[], rooms: any[]) => {
    const mealsMap: { [key: string]: number } = {};
    const transferMap: { [key: string]: number } = {};
    const bikesMap: { [key: string]: number } = {};
    const groupsSet = new Set<string>();

    members.forEach((m: any) => {
      const meal = m.五合目餐點 ? String(m.五合目餐點).trim() : "常規餐點";
      mealsMap[meal] = (mealsMap[meal] || 0) + 1;

      const trans = m.接送模式 ? String(m.接送模式).trim() : "未定";
      transferMap[trans] = (transferMap[trans] || 0) + 1;

      const bike = m.單車需求 ? String(m.單車需求).trim() : "未填寫";
      bikesMap[bike] = (bikesMap[bike] || 0) + 1;

      const gName = m.分組 ? String(m.分組).trim() : "";
      if (gName && gName !== "無" && gName !== "undefined" && gName !== "null") {
        groupsSet.add(gName);
      }
    });

    setMealStats(mealsMap);
    setTransferStats(transferMap);
    setBikeStats(bikesMap);
    setTourGroups(Array.from(groupsSet).sort());
  };

  async function fetchData() {
    try {
      const cachedMembers = localStorage.getItem(`takeno_members_5d_${tourId}`);
      const cachedRooms = localStorage.getItem(`takeno_rooms_5d_${tourId}`);
      
      if (cachedMembers && cachedRooms) {
        const parsedM = JSON.parse(cachedMembers);
        const parsedR = JSON.parse(cachedRooms);
        setMemberData(parsedM);
        setRoomData(parsedR);
        calculateStats(parsedM, parsedR);
        setLoading(false);
      }

      // 強制不使用快取，向伺服器要最新資料 (解決換表頭或新增欄位抓不到的問題)
      const resMembers = await fetch(`${SHEETDB_URL}?sheet=5日出團總表`, { cache: "no-store" });
      const allMembers = await resMembers.json();
      const filteredMembers = Array.isArray(allMembers) ? allMembers.filter((m: any) => m.團號 === tourId) : [];

      const resRooms = await fetch(`${SHEETDB_URL}?sheet=5日排房表`, { cache: "no-store" });
      const allRooms = await resRooms.json();
      const filteredRooms = Array.isArray(allRooms) ? allRooms.filter((r: any) => r.團號 === tourId) : [];

      setMemberData(filteredMembers);
      setRoomData(filteredRooms);
      calculateStats(filteredMembers, filteredRooms);

      localStorage.setItem(`takeno_members_5d_${tourId}`, JSON.stringify(filteredMembers));
      localStorage.setItem(`takeno_rooms_5d_${tourId}`, JSON.stringify(filteredRooms));
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
      const savedQueue = localStorage.getItem(`takeno_queue_5d_${tourId}`);
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
    localStorage.setItem(`takeno_members_5d_${tourId}`, JSON.stringify(updatedMembers));

    const memberName = updatedMembers[index].姓名;
    setSyncStatus("saving");

    try {
      const response = await fetch(`${SHEETDB_URL}/姓名/${encodeURIComponent(memberName)}?sheet=5日出團總表`, {
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
      localStorage.setItem(`takeno_queue_5d_${tourId}`, JSON.stringify(updatedQueue));
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
        const response = await fetch(`${SHEETDB_URL}/姓名/${encodeURIComponent(item.name)}?sheet=5日出團總表`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: { [item.field]: item.value } })
        });
        if (response.ok) successCount++;
      }

      if (successCount === currentQueue.length) {
        setOfflineQueue([]);
        localStorage.removeItem(`takeno_queue_5d_${tourId}`);
        setSyncStatus("success");
        fetchData();
      } else {
        const remained = currentQueue.slice(successCount);
        setOfflineQueue(remained);
        localStorage.setItem(`takeno_queue_5d_${tourId}`, JSON.stringify(remained));
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

  // 🌟 動態抓取主房客的 Key 與 Value (解決雲端 API 找不到表頭的問題)
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
    if (!primaryInfo) return; // 這間房沒有人
    
    try {
      setSavingIdx(index);
      setSyncStatus("saving");
      // 🌟 精準使用表頭名稱做 API 更新
      const response = await fetch(`${SHEETDB_URL}/${encodeURIComponent(primaryInfo.key)}/${encodeURIComponent(primaryInfo.value)}?sheet=5日排房表`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { 實際房號: room.實際房號 || "" } })
      });
      if (response.ok) {
        setSyncStatus("success");
        localStorage.setItem(`takeno_rooms_5d_${tourId}`, JSON.stringify(roomData));
      } else setSyncStatus("error");
    } catch (error) { 
      setSyncStatus("error"); 
    } finally { 
      setSavingIdx(null); 
    }
  };

  // 🌟 終極房客過濾器：支援無限房客 (只要表頭有"房客"兩個字通通抓出來)
  const getGuestsList = (room: any) => {
    const guests: string[] = [];
    const guestKeys = Object.keys(room).filter(k => k.includes("房客"));
    guestKeys.sort(); // 確保照 1, 2, 3, 4, 5 排列
    
    guestKeys.forEach(key => {
      const val = String(room[key]).trim();
      if (val && val !== "" && val !== "undefined" && val !== "null") {
        guests.push(val);
      }
    });
    return Array.from(new Set(guests)); // 剔除重複
  };

  const getRoomDietaryRestrictions = (guests: string[]) => {
    const restrictions: string[] = [];
    guests.forEach(gName => {
      const member = memberData.find(m => m.姓名 === gName);
      if (member && member.禁忌食材 && member.禁忌食材.trim() !== "") {
        restrictions.push(`${gName}: ${member.禁忌食材}`);
      }
    });
    return restrictions;
  };

  if (loading && memberData.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-sky-400 font-bold animate-pulse text-lg">🌈 TAKENO 彩虹大腦載入中...</p>
      </div>
    );
  }

  // === 各模組運算 ===
  const displayedCheckins = selectedTransferFilter ? memberData.filter(m => (m.接送模式 ? String(m.接送模式).trim() : "未定") === selectedTransferFilter) : [...memberData];
  displayedCheckins.sort((a, b) => (a.報到狀態 === "TRUE" ? 1 : -1));
  const checkinTotal = displayedCheckins.length;
  const checkinDone = displayedCheckins.filter(m => m.報到狀態 === "TRUE").length;

  const equipmentMembers = memberData.filter((m) => m.裝備明細 && m.裝備明細.trim() !== "" && m.裝備明細 !== "無");
  const equipTotal = equipmentMembers.length;
  const equipGiven = equipmentMembers.filter(m => m.裝備借出 === "TRUE").length;
  const equipRemain = equipTotal - equipGiven;
  const equipPercent = equipTotal === 0 ? 0 : Math.round((equipGiven / equipTotal) * 100);

  const displayedMeals = selectedMealFilter ? memberData.filter(m => (m.五合目餐點 ? String(m.五合目餐點).trim() : "常規餐點") === selectedMealFilter) : [...memberData];
  displayedMeals.sort((a, b) => {
    const aClaimed = a.餐點領取 === "TRUE";
    const bClaimed = b.餐點領取 === "TRUE";
    if (aClaimed === bClaimed) return 0;
    return aClaimed ? 1 : -1;
  });
  const mealTotal = displayedMeals.length;
  const mealGiven = displayedMeals.filter(m => m.餐點領取 === "TRUE").length;
  const mealRemain = mealTotal - mealGiven;
  const mealPercent = mealTotal === 0 ? 0 : Math.round((mealGiven / mealTotal) * 100);

  const displayedBikes = selectedBikeFilter ? memberData.filter(m => (m.單車需求 ? String(m.單車需求).trim() : "未填寫") === selectedBikeFilter) : [...memberData];
  displayedBikes.sort((a, b) => {
    const aClaimed = a.單車點收 === "TRUE";
    const bClaimed = b.單車點收 === "TRUE";
    if (aClaimed === bClaimed) return 0;
    return aClaimed ? 1 : -1;
  });

  let totalBikeExpectedRevenue = 0;
  let totalBikeCollectedRevenue = 0;
  memberData.forEach(m => {
    const typeStr = m.單車需求 ? String(m.單車需求).trim() : "";
    const price = getBikePrice(typeStr);
    totalBikeExpectedRevenue += price;
    if (m.單車點收 === "TRUE") {
      totalBikeCollectedRevenue += price;
    }
  });

  const currentStageRooms = roomData.filter((r) => r.住宿階段 === selectedHotelStage);

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center pb-12">
      <div className="w-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-600 text-white py-4 px-6 sticky top-0 z-20 flex items-center justify-between shadow-lg">
        <div>
          <span className="text-[10px] font-black bg-white/20 backdrop-blur-md text-white px-2 py-0.5 rounded-full uppercase tracking-wider border border-white/30">
            TAKENO {tourId} (5日)
          </span>
          <h1 className="text-lg font-black text-white mt-1 tracking-wide drop-shadow-md">
            {view === "menu" && "五日團嚮導工作台"}
            {view === "groupDetail" && "🥾 團隊分組總覽"}
            {view === "checkin" && "✈️ 機場接送與航班確認"}
            {view === "customerInfo" && "👤 隊員聯絡與緊急資料"}
            {view === "equipment" && "🎒 裝備借出與回報"}
            {view === "meals" && "🍱 五合目餐點發放"}
            {view === "rooms" && "🏨 三階段飯店排房"}
            {view === "roomSummary" && "🗝️ 總房表快速對照"}
            {view === "bikes" && "🚴 單車派發與對帳"}
          </h1>
        </div>
        {view === "menu" ? (
          <Link href="/five-days" className="text-white text-xs font-black bg-black/20 hover:bg-black/30 border border-white/20 px-4 py-2 rounded-xl active:scale-95 transition-all backdrop-blur-sm">
            返回總表
          </Link>
        ) : (
          <button onClick={() => { setView("menu"); setSelectedTransferFilter(null); setSelectedMealFilter(null); setSelectedBikeFilter(null); }} className="text-slate-900 text-xs font-black bg-white/90 hover:bg-white px-4 py-2 rounded-xl active:scale-95 transition-all shadow-md backdrop-blur-sm">
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
              syncStatus === "success" ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
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
        
        {view === "menu" && (
          <div className="grid grid-cols-2 gap-3">
            {offlineQueue.length > 0 && (
              <button onClick={handleRetrySyncAll} className="col-span-2 bg-red-500 text-white p-3 rounded-2xl text-xs font-black text-center shadow-md animate-bounce border-2 border-red-400">
                🚨 注意：您有 {offlineQueue.length} 筆離線資料，點此一鍵同步！
              </button>
            )}

            <button onClick={() => setView("groupDetail")} className="col-span-2 flex items-center justify-between bg-gradient-to-r from-rose-500 to-red-500 p-5 rounded-2xl shadow-md shadow-red-200 text-white active:scale-[0.98] transition-all">
              <div className="text-left">
                <h2 className="text-lg font-black text-white">🥾 登山分組與名單</h2>
                <p className="text-xs text-white/80 mt-1">查看各組成員狀態與備註</p>
              </div>
              <span className="text-xl font-bold">➔</span>
            </button>

            <button onClick={() => setView("checkin")} className="col-span-2 flex items-center justify-between bg-gradient-to-r from-orange-400 to-orange-500 p-5 rounded-2xl shadow-md shadow-orange-200 text-white active:scale-[0.98] transition-all">
              <div className="text-left">
                <h2 className="text-lg font-black text-white">✈️ 機場接送與航班確認</h2>
                <p className="text-xs text-white/80 mt-1">接送模式過濾、航班備註與報到</p>
              </div>
              <span className="text-xl font-bold">➔</span>
            </button>

            <button onClick={() => setView("customerInfo")} className="col-span-2 flex items-center justify-between bg-gradient-to-r from-amber-300 to-yellow-400 p-5 rounded-2xl shadow-md shadow-yellow-200 text-stone-900 active:scale-[0.98] transition-all">
              <div className="text-left">
                <h2 className="text-lg font-black text-stone-900">👤 隊員聯絡與緊急資料</h2>
                <p className="text-xs text-stone-700 mt-1">一鍵直接撥號與家屬聯絡</p>
              </div>
              <span className="text-xl font-bold">➔</span>
            </button>

            <button onClick={() => setView("equipment")} className="flex flex-col items-start bg-gradient-to-br from-lime-400 to-green-500 p-4 rounded-2xl shadow-md shadow-green-200 text-stone-900 active:scale-[0.98] transition-all">
              <h2 className="text-base font-black text-stone-900 mb-1">🎒 裝備</h2>
              <p className="text-[10px] text-stone-700 font-bold">借出與損壞回報</p>
            </button>

            <button onClick={() => setView("meals")} className="flex flex-col items-start bg-gradient-to-br from-emerald-400 to-teal-500 p-4 rounded-2xl shadow-md shadow-teal-200 text-white active:scale-[0.98] transition-all">
              <h2 className="text-base font-black text-white mb-1">🍱 五合目餐點</h2>
              <p className="text-[10px] text-white/80 font-bold">分類發放點收</p>
            </button>

            <button onClick={() => setView("bikes")} className="flex flex-col items-start bg-gradient-to-br from-cyan-400 to-blue-500 p-4 rounded-2xl shadow-md shadow-blue-200 text-white active:scale-[0.98] transition-all relative overflow-hidden">
              <div className="absolute -right-2 -bottom-2 text-4xl opacity-20">🚴</div>
              <h2 className="text-base font-black text-white mb-1">🚴 單車租借</h2>
              <p className="text-[10px] text-white/80 font-bold">自動計算金額對帳</p>
            </button>

            <button onClick={() => setView("rooms")} className="flex flex-col items-start bg-gradient-to-br from-blue-500 to-indigo-500 p-4 rounded-2xl shadow-md shadow-indigo-200 text-white active:scale-[0.98] transition-all">
              <h2 className="text-base font-black text-white mb-1">🏨 飯店排房</h2>
              <p className="text-[10px] text-white/80 font-bold">三階段房號登記</p>
            </button>

            <button onClick={() => setView("roomSummary")} className="col-span-2 flex items-center justify-between bg-gradient-to-r from-violet-500 to-fuchsia-500 p-5 rounded-2xl shadow-md shadow-fuchsia-200 text-white active:scale-[0.98] transition-all">
              <div className="text-left">
                <h2 className="text-lg font-black text-white">🗝️ 飯店總房表快速對照</h2>
              </div>
              <span className="text-xl font-bold">➔</span>
            </button>
          </div>
        )}

        {/* ================= 🟠 機場接駁與報到 ================= */}
        {view === "checkin" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-2xl shadow-md shadow-orange-200">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <p className="text-[9px] text-orange-200 font-black tracking-widest uppercase">Airport Transfer Filter</p>
                  <h3 className="text-sm font-black text-white mt-0.5">✈️ 點擊過濾機場接送模式</h3>
                </div>
                {selectedTransferFilter && (
                  <button onClick={() => setSelectedTransferFilter(null)} className="text-[10px] bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded-md transition-all active:scale-95">✖ 取消</button>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-4">
                {Object.entries(transferStats).map(([mode, count]) => {
                  const isSelected = selectedTransferFilter === mode;
                  return (
                    <button key={mode} onClick={() => setSelectedTransferFilter(isSelected ? null : mode)} className={`p-2.5 rounded-xl flex justify-between items-center transition-all ${isSelected ? "bg-white text-orange-600 shadow-md scale-[1.02]" : "bg-orange-700/40 border border-orange-400/50 hover:bg-orange-700/60"}`}>
                      <span className={`text-xs font-bold truncate mr-1 ${isSelected ? "text-orange-700" : "text-orange-100"}`}>{mode}</span>
                      <span className={`text-base font-black ${isSelected ? "text-orange-600" : "text-white"}`}>{count} <span className="text-[9px]">人</span></span>
                    </button>
                  );
                })}
              </div>
            </div>

            {displayedCheckins.map((member, _idx) => {
              const originalIdx = memberData.findIndex(m => m.姓名 === member.姓名);
              const isCheckedIn = member.報到狀態 === "TRUE";

              return (
                <div key={originalIdx} className={`bg-white border-2 p-4 rounded-2xl shadow-sm space-y-3 transition-colors ${isCheckedIn ? "border-slate-200 opacity-80" : "border-orange-400 shadow-orange-100 shadow-md"}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-slate-800">{member.姓名}</h3>
                        {!isCheckedIn && <span className="text-[10px] bg-red-100 text-red-700 font-black px-1.5 py-0.5 rounded-md animate-pulse">待報到</span>}
                      </div>
                      <span className="inline-block mt-1 bg-orange-50 text-orange-700 text-[10px] px-2 py-0.5 rounded-md font-bold border border-orange-100">{member.接送模式 || "接送未定"}</span>
                    </div>
                    <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-lg font-black border border-slate-200">{member.分組 || "未編組"}</span>
                  </div>

                  {member.航班資訊 && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-2.5 rounded-xl font-bold flex gap-2">
                      <span>✈️</span> <span>航班：{member.航班資訊}</span>
                    </div>
                  )}

                  <div className="pt-1">
                    <label className="text-[10px] font-black text-slate-400 block mb-1 pl-1">📝 現場備註 (自動儲存)</label>
                    <input type="text" placeholder="追加註記..." value={member.備註 || ""} onChange={(e) => handleLocalTextChange(originalIdx, "備註", e.target.value)} onBlur={(e) => handleMemberFieldUpdate(originalIdx, "備註", e.target.value)} className="w-full text-xs font-bold border-2 border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:border-orange-500 focus:outline-none"/>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center mt-1">
                    <div>
                      <p className="text-[10px] text-slate-500 font-black mb-0.5">📱 手機</p>
                      <p className="text-sm font-black text-slate-700">{member.手機 || "無"}</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-sm active:scale-95">
                      <input type="checkbox" className="w-5 h-5 rounded text-orange-600" checked={isCheckedIn} onChange={(e) => handleMemberFieldUpdate(originalIdx, "報到狀態", e.target.checked ? "TRUE" : "FALSE")}/>
                      <span className={`font-black text-sm ${isCheckedIn ? "text-orange-600" : "text-slate-400"}`}>{isCheckedIn ? "已完成報到" : "確認報到"}</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================= 🟣 三階段飯店排房 ================= */}
        {view === "rooms" && (
          <div className="space-y-4">
            <div className="bg-indigo-600 p-2 rounded-2xl flex gap-1 shadow-md shadow-indigo-200 sticky top-[72px] z-10">
              {["東京首日", "溫泉旅館", "東京尾日"].map(stage => (
                <button 
                  key={stage} 
                  onClick={() => setSelectedHotelStage(stage)}
                  className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all ${selectedHotelStage === stage ? "bg-white text-indigo-700 shadow-sm" : "bg-transparent text-indigo-200 hover:bg-indigo-500"}`}
                >
                  {stage}
                </button>
              ))}
            </div>

            {currentStageRooms.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
                <p className="text-slate-400 text-sm font-bold">目前【{selectedHotelStage}】無排房資料</p>
              </div>
            ) : (
              currentStageRooms.map((room) => {
                const originalIdx = roomData.findIndex(r => r === room);
                const guests = getGuestsList(room);
                const dietWarnings = selectedHotelStage === "溫泉旅館" ? getRoomDietaryRestrictions(guests) : [];

                return (
                  <div key={originalIdx} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
                      <div>
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-1 rounded-md border border-slate-200">入住：{room.入住日期 ? room.入住日期.substring(5) : "當日"}</span>
                        <h3 className="text-base font-black text-slate-800 mt-2">{room.飯店名稱}</h3>
                      </div>
                      <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg">{room.房型}</span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-2">
                      <p className="text-[10px] text-slate-400 font-bold mb-1">入住成員名單</p>
                      <p className="text-sm font-black text-slate-700 tracking-wide">{guests.length > 0 ? guests.join(" 、 ") : <span className="text-slate-400 font-normal text-xs">未排房客</span>}</p>
                    </div>

                    {dietWarnings.length > 0 && (
                      <div className="mb-3 bg-red-50 border border-red-200 p-2.5 rounded-xl">
                        <p className="text-[10px] font-black text-red-800 mb-1">⚠️ 慶功宴禁忌食材警告：</p>
                        <ul className="text-xs font-bold text-red-700 space-y-0.5">
                          {dietWarnings.map((w, i) => <li key={i}>• {w}</li>)}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-700 whitespace-nowrap">分配房號：</span>
                      <input type="text" placeholder="填寫實際房號" value={room.實際房號 || ""} onChange={(e) => handleRoomNumberChange(originalIdx, e.target.value)} className="flex-1 min-w-0 border-2 border-slate-300 rounded-xl px-3 py-2 font-black text-slate-800 focus:outline-none focus:border-indigo-500 bg-slate-50 text-sm"/>
                      <button onClick={() => saveSingleRoomNumber(originalIdx)} disabled={savingIdx !== null} className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs px-3 py-2.5 rounded-xl active:scale-95 disabled:bg-slate-300 transition-all">{savingIdx === originalIdx ? "⏳" : "💾 儲存"}</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ================= 🌸 飯店總房表快速對照 ================= */}
        {view === "roomSummary" && (
          <div className="space-y-4">
            <div className="bg-fuchsia-600 p-2 rounded-2xl flex gap-1 shadow-md shadow-fuchsia-200 sticky top-[72px] z-10">
              {["東京首日", "溫泉旅館", "東京尾日"].map(stage => (
                <button 
                  key={stage} 
                  onClick={() => setSelectedHotelStage(stage)}
                  className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all ${selectedHotelStage === stage ? "bg-white text-fuchsia-700 shadow-sm" : "bg-transparent text-fuchsia-200 hover:bg-fuchsia-500"}`}
                >
                  {stage}
                </button>
              ))}
            </div>

            <div className="bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white p-4 rounded-2xl shadow-md shadow-fuchsia-200 mb-2">
              <p className="text-[9px] text-fuchsia-200 font-black tracking-widest uppercase">Room-type Automation Stats</p>
              <h3 className="text-sm font-black text-white mt-0.5 mb-3">🏨 【{selectedHotelStage}】房型總量清點</h3>
              <div className="grid grid-cols-2 gap-2">
                {(() => {
                  const currentStats: { [key: string]: number } = {};
                  currentStageRooms.forEach(r => {
                    const rType = r.房型 ? String(r.房型).trim() : "未定房型";
                    currentStats[rType] = (currentStats[rType] || 0) + 1;
                  });
                  return Object.entries(currentStats).map(([rType, count]) => (
                    <div key={rType} className="bg-black/10 border border-white/20 p-2.5 rounded-xl flex justify-between items-center">
                      <span className="text-[11px] font-bold text-fuchsia-100 truncate mr-1">{rType}</span>
                      <span className="text-base font-black text-white whitespace-nowrap">{count} <span className="text-[10px] text-fuchsia-200 font-bold">間</span></span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {currentStageRooms.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
                <p className="text-slate-400 text-sm font-bold">目前【{selectedHotelStage}】無排房資料</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentStageRooms.map((room, idx) => {
                  const guests = getGuestsList(room);
                  return (
                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-fuchsia-300 transition-colors">
                      <div className="flex-1 pr-2">
                        <div className="text-[9px] text-fuchsia-600 font-bold mb-0.5">{room.入住日期 ? room.入住日期.substring(5) : "當日"} | {room.飯店名稱}</div>
                        <div className="text-xs font-black text-slate-800 leading-relaxed">{guests.length > 0 ? guests.join(" 、 ") : <span className="text-slate-400 font-normal">未排房客</span>}</div>
                      </div>
                      <div className="ml-2 pl-3 border-l border-slate-200 flex flex-col items-center justify-center min-w-[55px]">
                        <span className="text-[9px] text-slate-400 font-bold mb-0.5">房號</span>
                        <span className={`text-base font-black ${room.實際房號 ? "text-fuchsia-600" : "text-slate-300"}`}>{room.實際房號 || "—"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= 🔵 單車租借與對帳 ================= */}
        {view === "bikes" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white p-4 rounded-2xl shadow-md shadow-blue-200">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <p className="text-[9px] text-cyan-200 font-black tracking-widest uppercase">Bike Filter & Financial</p>
                  <h3 className="text-sm font-black text-white mt-0.5">🚴 點擊過濾單車類型</h3>
                </div>
                {selectedBikeFilter && (
                  <button onClick={() => setSelectedBikeFilter(null)} className="text-[10px] bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded-md transition-all active:scale-95">
                    ✖ 取消
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {Object.entries(bikeStats).map(([type, count]) => {
                  const isSelected = selectedBikeFilter === type;
                  return (
                    <button 
                      key={type} 
                      onClick={() => setSelectedBikeFilter(isSelected ? null : type)}
                      className={`p-2.5 rounded-xl flex justify-between items-center transition-all active:scale-95 text-left
                        ${isSelected ? "bg-white text-blue-600 shadow-md scale-[1.02]" : "bg-black/10 border border-white/20 hover:bg-black/20"}`}
                    >
                      <span className={`text-[10px] font-bold truncate mr-1 ${isSelected ? "text-blue-700" : "text-blue-100"}`}>{type}</span>
                      <span className={`text-base font-black whitespace-nowrap ${isSelected ? "text-blue-600" : "text-white"}`}>
                        {count} <span className="text-[10px] font-normal opacity-70">台</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="bg-black/20 p-3 rounded-xl border border-white/10 flex justify-between items-center backdrop-blur-sm">
                <span className="text-xs text-blue-100 font-bold">💰 單車租借對帳 (已收/預計)</span>
                <div className="text-right leading-none">
                  <span className="text-lg font-black text-yellow-300">¥{totalBikeCollectedRevenue.toLocaleString()}</span>
                  <span className="text-[10px] text-white/50 font-bold mx-1">/</span>
                  <span className="text-xs font-bold text-white">¥{totalBikeExpectedRevenue.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {displayedBikes.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
                <p className="text-slate-400 text-sm font-bold">查無符合條件的單車名單</p>
              </div>
            ) : (
              displayedBikes.map((member, _idx) => {
                const originalIdx = memberData.findIndex(m => m.姓名 === member.姓名);
                const isBikeGiven = member.單車點收 === "TRUE";
                const typeStr = member.單車需求 ? String(member.單車需求).trim() : "";
                const price = getBikePrice(typeStr);

                return (
                  <div key={originalIdx} className={`bg-white border-2 p-4 rounded-2xl shadow-sm flex justify-between items-center transition-colors ${isBikeGiven ? "border-slate-200 opacity-80" : "border-blue-400 shadow-md shadow-blue-100"}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-slate-800">{member.姓名}</h3>
                        {price > 0 && !isBikeGiven && (
                          <span className="text-[10px] bg-red-100 text-red-700 font-black px-1.5 py-0.5 rounded-md animate-pulse">待收 ¥{price.toLocaleString()}</span>
                        )}
                        {price > 0 && isBikeGiven && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 font-black px-1.5 py-0.5 rounded-md">✅ 已收 ¥{price.toLocaleString()}</span>
                        )}
                      </div>
                      <span className="inline-block mt-1 bg-blue-50 text-blue-700 text-[10px] px-2 py-0.5 rounded-md font-bold border border-blue-100">{typeStr}</span>
                    </div>
                    
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 shadow-sm active:scale-95 transition-all">
                      <input type="checkbox" className="w-5 h-5 rounded text-blue-600" checked={isBikeGiven} onChange={(e) => handleMemberFieldUpdate(originalIdx, "單車點收", e.target.checked ? "TRUE" : "FALSE")}/>
                      <span className={`font-black text-xs ${isBikeGiven ? "text-blue-700" : "text-slate-500"}`}>{isBikeGiven ? "✅ 已點收" : "確認點收"}</span>
                    </label>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ================= 🔴 登山分組 ================= */}
        {view === "groupDetail" && (
          <div className="space-y-6">
            {tourGroups.map((groupName) => {
              const groupMembers = memberData.filter((m) => m.分組 && String(m.分組).trim() === groupName);
              return (
                <div key={groupName} className="bg-white border-2 border-red-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-rose-500 to-red-500 text-white px-4 py-3 flex justify-between items-center">
                    <span className="text-sm font-black">⛰️ {groupName}</span>
                    <span className="text-xs bg-white/20 font-bold px-2 py-0.5 rounded-full border border-white/30">{groupMembers.length} 人</span>
                  </div>
                  <div className="p-1 divide-y divide-slate-100">
                    {groupMembers.map((member, idx) => (
                      <div key={idx} className="p-3 bg-white space-y-1 hover:bg-red-50/30 transition-colors">
                        <div className="flex justify-between items-center">
                          <span className="font-black text-slate-800 text-sm">{member.姓名}</span>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${member.報到狀態 === "TRUE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-200"}`}>{member.報到狀態 === "TRUE" ? "✅ 已報到" : "⏳ 未報到"}</span>
                        </div>
                        {member.備註 && <div className="text-[10px] text-slate-500 font-bold">📝 {member.備註}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================= 🟡 緊急資料 ================= */}
        {view === "customerInfo" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-amber-400 to-yellow-500 text-stone-900 p-4 rounded-2xl shadow-md shadow-yellow-200">
              <h3 className="text-sm font-black text-stone-900">🚨 高山緊急聯絡總部</h3>
              <p className="text-xs text-stone-800 font-bold mt-1 leading-relaxed">
                此區支援戰術離線快取。點擊下方號碼即可直接一鍵撥號！
              </p>
            </div>

            {memberData.map((member, idx) => (
              <div key={idx} className="bg-white border-2 border-amber-100 rounded-2xl shadow-sm p-4 space-y-3 hover:border-amber-300 transition-colors">
                <h3 className="text-base font-black text-stone-800 border-b border-slate-100 pb-2 flex justify-between items-center">
                  {member.姓名}
                  <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">{member.分組 || "未編組"}</span>
                </h3>
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-slate-400 font-black">📱 本人電話</p>
                    <p className="text-sm font-black text-slate-700">{member.手機 || "未登記"}</p>
                  </div>
                  {member.手機 && <a href={`tel:${member.手機.replace(/[^0-9+]/g, "")}`} className="bg-stone-800 text-white text-[10px] font-black px-3 py-1.5 rounded-lg active:scale-95 shadow-sm">📞 撥打</a>}
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

        {/* ================= 🟢 裝備確認 ================= */}
        {view === "equipment" && (
          <div className="space-y-4">
            <div className="bg-white border-2 border-green-200 p-4 rounded-2xl shadow-sm mb-4">
              <div className="flex justify-between items-end mb-2">
                <div>
                  <p className="text-[10px] text-green-600 font-black tracking-widest uppercase">Equipment Progress</p>
                  <h3 className="text-sm font-black text-stone-800 mt-0.5">🎒 本團裝備發放進度</h3>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-green-600">{equipGiven}</span>
                  <span className="text-xs text-slate-400 font-bold mx-1">/</span>
                  <span className="text-sm font-bold text-slate-500">{equipTotal} <span className="text-[10px]">人</span></span>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 border border-slate-200 overflow-hidden mb-1.5">
                <div className="bg-green-500 h-2.5 transition-all duration-500 ease-out" style={{ width: `${equipPercent}%` }}></div>
              </div>
              <p className="text-[10px] text-stone-400 font-bold text-right">尚有 <span className="text-orange-500">{equipRemain}</span> 人未領取</p>
            </div>

             {equipmentMembers.map((member, idx) => {
                const originalIdx = memberData.findIndex(m => m.姓名 === member.姓名);
                return (
                  <div key={idx} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-3 hover:border-green-300 transition-colors">
                    <h3 className="text-base font-black text-slate-800 flex justify-between items-center">
                      {member.姓名}
                      <span className="text-[10px] text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-md">{member.分組 || "未編組"}</span>
                    </h3>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                      <p className="text-sm font-black text-slate-700">{member.裝備明細}</p>
                      
                      <input 
                        type="text" 
                        placeholder="請填寫損壞或遺失狀況..." 
                        value={member.問題回報 || ""} 
                        onChange={(e) => handleLocalTextChange(originalIdx, "問題回報", e.target.value)} 
                        onBlur={(e) => handleMemberFieldUpdate(originalIdx, "問題回報", e.target.value)} 
                        className="w-full text-xs font-bold border border-red-200 rounded-lg px-3 py-2 bg-red-50 text-slate-800 placeholder-red-400/60 focus:outline-none focus:border-red-400"
                      />
                      
                      <div className="flex gap-2 pt-1">
                        <label className="flex-1 flex justify-center items-center gap-2 bg-white px-2 py-2.5 rounded-lg border border-slate-200 shadow-sm active:scale-95 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 text-green-600 rounded" checked={member.裝備借出 === "TRUE"} onChange={(e) => handleMemberFieldUpdate(originalIdx, "裝備借出", e.target.checked ? "TRUE" : "FALSE")}/>
                          <span className="text-xs font-black text-slate-700">已借出</span>
                        </label>
                        <label className="flex-1 flex justify-center items-center gap-2 bg-white px-2 py-2.5 rounded-lg border border-slate-200 shadow-sm active:scale-95 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 text-green-600 rounded" checked={member.裝備歸還 === "TRUE"} onChange={(e) => handleMemberFieldUpdate(originalIdx, "裝備歸還", e.target.checked ? "TRUE" : "FALSE")}/>
                          <span className="text-xs font-black text-slate-700">已歸還</span>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* ================= 🟢 餐點發放 ================= */}
        {view === "meals" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-4 rounded-2xl shadow-md shadow-teal-200">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <p className="text-[9px] text-teal-100 font-black tracking-widest uppercase">Catering Filter</p>
                  <h3 className="text-sm font-black text-white mt-0.5">🍱 點擊過濾餐點分類</h3>
                </div>
                {selectedMealFilter && (
                  <button onClick={() => setSelectedMealFilter(null)} className="text-[10px] bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded-md transition-all active:scale-95">✖ 取消</button>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-4">
                {Object.entries(mealStats).map(([meal, count]) => {
                  const isSelected = selectedMealFilter === meal;
                  return (
                    <button key={meal} onClick={() => setSelectedMealFilter(isSelected ? null : meal)} className={`p-2.5 rounded-xl flex justify-between items-center transition-all active:scale-95 text-left ${isSelected ? "bg-white text-teal-700 shadow-md scale-[1.02]" : "bg-black/10 border border-white/20 hover:bg-black/20"}`}>
                      <span className={`text-xs font-bold truncate mr-1 ${isSelected ? "text-teal-700" : "text-white"}`}>{meal}</span>
                      <span className={`text-base font-black whitespace-nowrap ${isSelected ? "text-teal-600" : "text-white"}`}>{count} <span className="text-[10px] font-normal opacity-70">份</span></span>
                    </button>
                  );
                })}
              </div>

              <div className="bg-black/20 p-3 rounded-xl border border-white/10 flex justify-between items-end mb-1.5 backdrop-blur-sm">
                <span className="text-xs text-white font-bold">{selectedMealFilter ? `「${selectedMealFilter}」發放進度` : "全團總發放進度"}</span>
                <div className="text-right leading-none">
                  <span className="text-lg font-black text-yellow-300">{mealGiven}</span>
                  <span className="text-[10px] text-white/50 font-bold mx-1">/</span>
                  <span className="text-xs font-bold text-white">{mealTotal}</span>
                </div>
              </div>
            </div>

            {displayedMeals.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-400 text-sm font-bold">查無符合條件的餐點名單</p>
              </div>
            ) : (
              displayedMeals.map((member, _idx) => {
                const originalIdx = memberData.findIndex(m => m.姓名 === member.姓名);
                const isVegetarian = String(member.病史 || "").includes("素") || String(member.禁忌食材 || "").includes("素") || String(member.五合目餐點 || "").includes("素");
                const isClaimed = member.餐點領取 === "TRUE";

                return (
                  <div key={originalIdx} className={`bg-white border-2 p-4 rounded-2xl shadow-sm space-y-3 transition-colors ${isClaimed ? "border-slate-200 opacity-80" : "border-teal-400 shadow-md shadow-teal-100"}`}>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-slate-800">{member.姓名}</h3>
                        {!isClaimed && <span className="text-[10px] bg-red-100 text-red-700 font-black px-1.5 py-0.5 rounded-md animate-pulse">待領取</span>}
                        {isVegetarian && <span className="text-[10px] bg-green-100 text-green-700 font-black px-1.5 py-0.5 rounded-md border border-green-200">🥬 素食</span>}
                      </div>
                      <span className="text-xs font-bold text-slate-500">{member.分組 || "未編組"}</span>
                    </div>
                    <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-3 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-teal-800 font-black mb-0.5">🍱 五合目餐食</p>
                        <p className="text-sm font-black text-slate-800">{member.五合目餐點 || "常規餐點"}</p>
                      </div>
                      <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-teal-200 shadow-sm active:scale-95 transition-all cursor-pointer">
                        <input type="checkbox" className="w-5 h-5 rounded text-teal-600" checked={isClaimed} onChange={(e) => handleMemberFieldUpdate(originalIdx, "餐點領取", e.target.checked ? "TRUE" : "FALSE")}/>
                        <span className={`font-black text-xs ${isClaimed ? "text-teal-700" : "text-slate-500"}`}>{isClaimed ? "✅ 已點收" : "確認領取"}</span>
                      </label>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>
    </main>
  );
}
