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

  // ✈️ 報到與接送過濾
  const [selectedTransferFilter, setSelectedTransferFilter] = useState<string | null>(null);
  const [transferStats, setTransferStats] = useState<{ [key: string]: number }>({});
  
  // 🍱 餐點與單車
  const [mealStats, setMealStats] = useState<{ [key: string]: number }>({});
  const [bikeStats, setBikeStats] = useState<{ [key: string]: number }>({});
  const [selectedMealFilter, setSelectedMealFilter] = useState<string | null>(null);
  const [selectedBikeFilter, setSelectedBikeFilter] = useState<string | null>(null);

  // 🏨 三階段飯店切換狀態 (預設看東京首日)
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

  const saveSingleRoomNumber = async (index: number) => {
    const room = roomData[index];
    const primaryGuest = room["房客 1"] || room.房客1;
    if (!primaryGuest) return;
    try {
      setSavingIdx(index);
      setSyncStatus("saving");
      const response = await fetch(`${SHEETDB_URL}/房客 1/${encodeURIComponent(primaryGuest)}?sheet=5日排房表`, {
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

  const getGuestsList = (room: any) => {
    const guests = [
      room.房客1 || room["房客 1"] || room["房客  1"],
      room.房客2 || room["房客 2"] || room["房客  2"],
      room.房客3 || room["房客 3"] || room["房客  3"],
      room.房客4 || room["房客 4"] || room["房客  4"]
    ];
    return guests.map(g => (g ? String(g).trim() : "")).filter(g => g !== "" && g !== "undefined" && g !== "null");
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
        <p className="text-sky-400 font-bold animate-pulse">🌊 TAKENO 五日戰術快取啟動中...</p>
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
      <div className="w-full bg-slate-900 text-white py-4 px-6 sticky top-0 z-20 flex items-center justify-between shadow-lg border-b border-sky-900">
        <div>
          <span className="text-[10px] font-black bg-sky-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">TAKENO {tourId} (5日)</span>
          <h1 className="text-lg font-black text-slate-50 mt-1 tracking-wide">
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
          <Link href="/five-days" className="text-sky-100 text-xs font-bold bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl active:scale-95 transition-all">返回總表</Link>
        ) : (
          <button onClick={() => { setView("menu"); setSelectedTransferFilter(null); setSelectedMealFilter(null); setSelectedBikeFilter(null); }} className="text-sky-950 text-xs font-black bg-sky-400 hover:bg-sky-300 px-4 py-2 rounded-xl active:scale-95 transition-all shadow-sm">↩ 回選單</button>
        )}
      </div>

      {view !== "menu" && (
        <div className="w-full max-w-md px-4 mt-3">
          {syncStatus === "offline-pending" ? (
            <button onClick={handleRetrySyncAll} className="w-full text-center py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-orange-500 to-amber-500 text-stone-950 shadow-md border-2 border-orange-400 animate-pulse flex items-center justify-center gap-1.5 active:scale-95 transition-all">
              ⚠️ 本地尚有 {offlineQueue.length} 筆離線變更，點此一鍵同步 🔄
            </button>
          ) : (
            <div className={`text-center py-1.5 rounded-xl text-xs font-bold shadow-sm border transition-all ${
              syncStatus === "saving" ? "bg-amber-50 text-amber-800 border-amber-200 animate-pulse" :
              syncStatus === "success" ? "bg-sky-800 text-sky-50 border-sky-700" :
              syncStatus === "error" ? "bg-red-100 text-red-800 border-red-200" : "bg-slate-200 text-slate-500 border-slate-300"
            }`}>
              {syncStatus === "saving" && "⏳ 傳送至雲端表單中..."}
              {syncStatus === "success" && "🌊 雲端實時同步完畢"}
              {syncStatus === "error" && "❌ 連線失敗，已寫入手機暫存"}
              {syncStatus === "idle" && "🌿 高山戰術離線大腦連線就緒"}
            </div>
          )}
        </div>
      )}

      <div className="w-full max-w-md px-4 mt-4">
        
        {/* ================= 主選單畫面 ================= */}
        {view === "menu" && (
          <div className="grid grid-cols-2 gap-3">
            {offlineQueue.length > 0 && (
              <button onClick={handleRetrySyncAll} className="col-span-2 bg-red-500 text-white p-3 rounded-2xl text-xs font-black text-center shadow-md animate-bounce border-2 border-red-400">
                🚨 注意：您有 {offlineQueue.length} 筆離線資料，點此一鍵同步！
              </button>
            )}

            <button onClick={() => setView("groupDetail")} className="col-span-2 flex items-center justify-between bg-gradient-to-r from-sky-800 to-slate-900 p-5 rounded-2xl shadow-md border border-sky-700 text-white active:scale-[0.98]">
              <div className="text-left">
                <h2 className="text-lg font-black text-sky-300">🥾 登山分組與名單</h2>
                <p className="text-xs text-sky-100/70 mt-1">查看各組成員狀態與備註</p>
              </div>
              <span className="text-xl text-sky-400 font-bold">➔</span>
            </button>

            <button onClick={() => setView("checkin")} className="col-span-2 flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-slate-200 active:scale-[0.98]">
              <div className="text-left">
                <h2 className="text-lg font-black text-slate-800">✈️ 機場接送與航班確認</h2>
                <p className="text-xs text-slate-500 mt-1">接送模式過濾、航班備註與報到</p>
              </div>
              <span className="text-xl text-sky-600 font-bold">➔</span>
            </button>

            <button onClick={() => setView("customerInfo")} className="col-span-2 flex items-center justify-between bg-slate-800 text-white p-5 rounded-2xl shadow-md active:scale-[0.98]">
              <div className="text-left">
                <h2 className="text-lg font-black text-amber-400">👤 隊員聯絡與緊急資料</h2>
                <p className="text-xs text-slate-300 mt-1">一鍵直接撥號與家屬聯絡</p>
              </div>
              <span className="text-xl text-amber-400 font-bold">➔</span>
            </button>

            <button onClick={() => setView("equipment")} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 active:scale-[0.98]">
              <h2 className="text-base font-black text-slate-800 mb-1">🎒 裝備</h2>
              <p className="text-[10px] text-slate-500">借出與損壞回報</p>
            </button>
            <button onClick={() => setView("meals")} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 active:scale-[0.98]">
              <h2 className="text-base font-black text-slate-800 mb-1">🍱 五合目餐點</h2>
              <p className="text-[10px] text-slate-500">分類發放點收</p>
            </button>
            <button onClick={() => setView("bikes")} className="bg-white p-4 rounded-2xl shadow-sm border border-sky-200 active:scale-[0.98] relative overflow-hidden">
              <div className="absolute -right-2 -bottom-2 text-4xl opacity-10">🚴</div>
              <h2 className="text-base font-black text-sky-900 mb-1">🚴 單車租借</h2>
              <p className="text-[10px] text-sky-700 font-bold">自動計算金額對帳</p>
            </button>
            <button onClick={() => setView("rooms")} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 active:scale-[0.98]">
              <h2 className="text-base font-black text-slate-800 mb-1">🏨 飯店排房</h2>
              <p className="text-[10px] text-slate-500">三階段房號登記</p>
            </button>

            <button onClick={() => setView("roomSummary")} className="col-span-2 flex items-center justify-between bg-sky-50 p-4 rounded-2xl shadow-sm border border-sky-200 active:scale-[0.98]">
              <div className="text-left">
                <h2 className="text-sm font-black text-sky-900">🗝️ 飯店總房表快速對照</h2>
              </div>
              <span className="text-sky-600 font-bold">➔</span>
            </button>
          </div>
        )}

        {/* ================= ✈️ 機場接駁與報到 ================= */}
        {view === "checkin" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-4 rounded-2xl shadow-md border border-slate-700">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <p className="text-[9px] text-sky-400 font-black tracking-widest uppercase">Airport Transfer Filter</p>
                  <h3 className="text-sm font-black text-slate-100 mt-0.5">✈️ 點擊過濾機場接送模式</h3>
                </div>
                {selectedTransferFilter && (
                  <button onClick={() => setSelectedTransferFilter(null)} className="text-[10px] bg-slate-700 text-slate-200 px-2 py-1 rounded-md border border-slate-600">✖ 取消</button>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-4">
                {Object.entries(transferStats).map(([mode, count]) => {
                  const isSelected = selectedTransferFilter === mode;
                  return (
                    <button key={mode} onClick={() => setSelectedTransferFilter(isSelected ? null : mode)} className={`p-2 rounded-xl flex justify-between items-center transition-all ${isSelected ? "bg-sky-600 border-2 border-amber-400" : "bg-slate-950/40 border border-slate-700"}`}>
                      <span className={`text-xs font-bold truncate mr-1 ${isSelected ? "text-white" : "text-slate-300"}`}>{mode}</span>
                      <span className={`text-base font-black ${isSelected ? "text-amber-300" : "text-sky-400"}`}>{count} <span className="text-[9px]">人</span></span>
                    </button>
                  );
                })}
              </div>
            </div>

            {displayedCheckins.map((member, _idx) => {
              const originalIdx = memberData.findIndex(m => m.姓名 === member.姓名);
              const isCheckedIn = member.報到狀態 === "TRUE";

              return (
                <div key={originalIdx} className={`bg-white border-2 p-4 rounded-2xl shadow-sm space-y-3 transition-colors ${isCheckedIn ? "border-slate-200/50 opacity-80" : "border-sky-400 shadow-md"}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-slate-800">{member.姓名}</h3>
                        {!isCheckedIn && <span className="text-[10px] bg-red-100 text-red-700 font-black px-1.5 py-0.5 rounded-md animate-pulse">待報到</span>}
                      </div>
                      <span className="inline-block mt-1 bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-md font-bold border border-slate-200">{member.接送模式 || "接送未定"}</span>
                    </div>
                    <span className="bg-sky-50 text-sky-800 text-xs px-2.5 py-1 rounded-lg font-black border border-sky-200">{member.分組 || "未編組"}</span>
                  </div>

                  {member.航班資訊 && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs p-2.5 rounded-xl font-bold flex gap-2">
                      <span>✈️</span> <span>航班：{member.航班資訊}</span>
                    </div>
                  )}

                  <div className="pt-1">
                    <label className="text-[10px] font-black text-slate-400 block mb-1 pl-1">📝 現場備註 (自動儲存)</label>
                    <input type="text" placeholder="追加註記..." value={member.備註 || ""} onChange={(e) => handleLocalTextChange(originalIdx, "備註", e.target.value)} onBlur={(e) => handleMemberFieldUpdate(originalIdx, "備註", e.target.value)} className="w-full text-xs font-bold border-2 border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 focus:border-sky-500 focus:outline-none"/>
                  </div>

                  <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-3 flex justify-between items-center mt-1">
                    <div>
                      <p className="text-[10px] text-sky-800 font-black mb-0.5">📱 手機</p>
                      <p className="text-sm font-black text-slate-700">{member.手機 || "無"}</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-sky-200 shadow-sm active:scale-95">
                      <input type="checkbox" className="w-5 h-5 rounded text-sky-600" checked={isCheckedIn} onChange={(e) => handleMemberFieldUpdate(originalIdx, "報到狀態", e.target.checked ? "TRUE" : "FALSE")}/>
                      <span className={`font-black text-sm ${isCheckedIn ? "text-sky-900" : "text-slate-400"}`}>{isCheckedIn ? "已完成報到" : "確認報到"}</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================= 🏨 三階段飯店排房 ================= */}
        {view === "rooms" && (
          <div className="space-y-4">
            <div className="bg-slate-900 p-2 rounded-2xl flex gap-1 shadow-md sticky top-[72px] z-10">
              {["東京首日", "溫泉旅館", "東京尾日"].map(stage => (
                <button 
                  key={stage} 
                  onClick={() => setSelectedHotelStage(stage)}
                  className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all ${selectedHotelStage === stage ? "bg-sky-500 text-white shadow-sm" : "bg-transparent text-slate-400 hover:bg-slate-800"}`}
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
                      <span className="text-xs font-black text-sky-800 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-lg">{room.房型}</span>
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
                      <input type="text" placeholder="填寫實際房號" value={room.實際房號 || ""} onChange={(e) => handleRoomNumberChange(originalIdx, e.target.value)} className="flex-1 min-w-0 border-2 border-slate-300 rounded-xl px-3 py-2 font-black text-slate-800 focus:outline-none focus:border-sky-500 bg-slate-50 text-sm"/>
                      <button onClick={() => saveSingleRoomNumber(originalIdx)} disabled={savingIdx !== null} className="bg-sky-600 hover:bg-sky-500 text-white font-black text-xs px-3 py-2.5 rounded-xl active:scale-95 disabled:bg-slate-300 transition-all">{savingIdx === originalIdx ? "⏳" : "💾 儲存"}</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ================= 🌟 🗝️ 飯店總房表快速對照 (加入分類統計) ================= */}
        {view === "roomSummary" && (
          <div className="space-y-4">
            
            {/* 🌟 保持一貫的飯店階段切換器 */}
            <div className="bg-slate-900 p-2 rounded-2xl flex gap-1 shadow-md sticky top-[72px] z-10">
              {["東京首日", "溫泉旅館", "東京尾日"].map(stage => (
                <button 
                  key={stage} 
                  onClick={() => setSelectedHotelStage(stage)}
                  className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all ${selectedHotelStage === stage ? "bg-sky-500 text-white shadow-sm" : "bg-transparent text-slate-400 hover:bg-slate-800"}`}
                >
                  {stage}
                </button>
              ))}
            </div>

            {/* 🌟 房型數量動態統計面板 */}
            <div className="bg-gradient-to-br from-sky-800 to-slate-900 text-white p-4 rounded-2xl shadow-md border border-sky-700 mb-2">
              <p className="text-[9px] text-sky-400 font-black tracking-widest uppercase">Room-type Automation Stats</p>
              <h3 className="text-sm font-black text-slate-100 mt-0.5 mb-3">🏨 【{selectedHotelStage}】房型總量清點</h3>
              <div className="grid grid-cols-2 gap-2">
                {(() => {
                  const currentStats: { [key: string]: number } = {};
                  currentStageRooms.forEach(r => {
                    const rType = r.房型 ? String(r.房型).trim() : "未定房型";
                    currentStats[rType] = (currentStats[rType] || 0) + 1;
                  });
                  return Object.entries(currentStats).map(([rType, count]) => (
                    <div key={rType} className="bg-slate-950/40 border border-sky-800/40 p-2.5 rounded-xl flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-300 truncate mr-1">{rType}</span>
                      <span className="text-base font-black text-amber-400 whitespace-nowrap">{count} <span className="text-[10px] text-slate-400 font-bold">間</span></span>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* 🌟 過濾後的總房表明細 */}
            {currentStageRooms.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
                <p className="text-slate-400 text-sm font-bold">目前【{selectedHotelStage}】無排房資料</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentStageRooms.map((room, idx) => {
                  const guests = getGuestsList(room);
                  return (
                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex-1 pr-2">
                        <div className="text-[9px] text-sky-600 font-bold mb-0.5">{room.入住日期 ? room.入住日期.substring(5) : "當日"} | {room.飯店名稱}</div>
                        <div className="text-xs font-black text-slate-800 leading-relaxed">{guests.length > 0 ? guests.join(" 、 ") : <span className="text-slate-400 font-normal">未排房客</span>}</div>
                      </div>
                      <div className="ml-2 pl-3 border-l border-slate-200 flex flex-col items-center justify-center min-w-[55px]">
                        <span className="text-[9px] text-slate-400 font-bold mb-0.5">房號</span>
                        <span className={`text-base font-black ${room.實際房號 ? "text-sky-700" : "text-slate-300"}`}>{room.實際房號 || "—"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= 🚴 單車租借與對帳 ================= */}
        {view === "bikes" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-sky-800 to-sky-950 text-white p-4 rounded-2xl shadow-md border border-sky-700">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <p className="text-[9px] text-sky-400 font-black tracking-widest uppercase">Bike Filter & Financial</p>
                  <h3 className="text-sm font-black text-sky-100 mt-0.5">🚴 點擊下方單車類型過濾名單</h3>
                </div>
                {selectedBikeFilter && (
                  <button onClick={() => setSelectedBikeFilter(null)} className="text-[10px] bg-slate-700/80 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded-md border border-slate-500 transition-all active:scale-95">
                    ✖ 取消過濾
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
                        ${isSelected ? "bg-sky-600 border-2 border-amber-400 ring-2 ring-amber-400/30 shadow-lg" : "bg-slate-900/50 border border-sky-500/50 hover:bg-slate-800/80"}`}
                    >
                      <span className={`text-[10px] font-bold truncate mr-1 ${isSelected ? "text-white" : "text-sky-200"}`}>{type}</span>
                      <span className={`text-base font-black whitespace-nowrap ${isSelected ? "text-amber-300" : "text-white"}`}>
                        {count} <span className="text-[10px] font-normal opacity-70">台</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="bg-slate-950/40 p-3 rounded-xl border border-sky-800/40 flex justify-between items-center">
                <span className="text-xs text-sky-300 font-bold">💰 單車租借對帳 (預計/已收)</span>
                <div className="text-right leading-none">
                  <span className="text-lg font-black text-amber-400">¥{totalBikeCollectedRevenue.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-500 font-bold mx-1">/</span>
                  <span className="text-xs font-bold text-slate-400">¥{totalBikeExpectedRevenue.toLocaleString()}</span>
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
                  <div key={originalIdx} className={`bg-white border-2 p-4 rounded-2xl shadow-sm flex justify-between items-center transition-colors ${isBikeGiven ? "border-slate-200/50 opacity-80" : "border-sky-400 shadow-md"}`}>
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
                      <span className="inline-block mt-1 bg-sky-100 text-sky-800 text-[10px] px-2 py-0.5 rounded-md font-bold">{typeStr}</span>
                    </div>
                    
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 shadow-sm active:scale-95 transition-all">
                      <input type="checkbox" className="w-5 h-5 rounded text-sky-600" checked={isBikeGiven} onChange={(e) => handleMemberFieldUpdate(originalIdx, "單車點收", e.target.checked ? "TRUE" : "FALSE")}/>
                      <span className={`font-black text-xs ${isBikeGiven ? "text-sky-800" : "text-slate-500"}`}>{isBikeGiven ? "✅ 收款點收" : "確認點收"}</span>
                    </label>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ================= 其他共用區塊 (分組, 客戶, 裝備, 餐點) ================= */}
        {view === "groupDetail" && (
          <div className="space-y-6">
            {tourGroups.map((groupName) => {
              const groupMembers = memberData.filter((m) => m.分組 && String(m.分組).trim() === groupName);
              return (
                <div key={groupName} className="bg-white border border-sky-800/20 rounded-2xl shadow-sm overflow-hidden">
                  <div className="bg-sky-900 text-white px-4 py-3 flex justify-between items-center">
                    <span className="text-sm font-black">⛰️ {groupName}</span>
                    <span className="text-xs bg-sky-500 font-bold px-2 py-0.5 rounded-full">{groupMembers.length} 人</span>
                  </div>
                  <div className="p-1 divide-y divide-slate-100">
                    {groupMembers.map((member, idx) => (
                      <div key={idx} className="p-3 bg-white space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-black text-slate-800 text-sm">{member.姓名}</span>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${member.報到狀態 === "TRUE" ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-slate-50 text-slate-400 border-slate-200"}`}>{member.報到狀態 === "TRUE" ? "✅ 已報到" : "⏳ 未報到"}</span>
                        </div>
                        {member.備註 && <div className="text-[10px] text-slate-500">📝 {member.備註}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === "customerInfo" && (
          <div className="space-y-4">
            {memberData.map((member, idx) => (
              <div key={idx} className="bg-white border-2 border-slate-200 rounded-2xl shadow-sm p-4 space-y-3">
                <h3 className="text-base font-black text-slate-800 border-b border-slate-100 pb-2">{member.姓名}</h3>
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-slate-400 font-black">📱 本人電話</p>
                    <p className="text-sm font-black text-slate-700">{member.手機 || "未登記"}</p>
                  </div>
                  {member.手機 && <a href={`tel:${member.手機.replace(/[^0-9+]/g, "")}`} className="bg-sky-700 text-white text-[10px] font-black px-3 py-1.5 rounded-lg">📞 撥打</a>}
                </div>
                <div className="bg-orange-50 border border-orange-100 p-2.5 rounded-xl flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-orange-800 font-black">🚨 {member.緊急聯絡人 || "緊急聯絡人"}</p>
                    <p className="text-sm font-black text-slate-800">{member.緊急聯絡人電話 || "未登記"}</p>
                  </div>
                  {member.緊急聯絡人電話 && <a href={`tel:${member.緊急聯絡人電話.replace(/[^0-9+]/g, "")}`} className="bg-orange-600 text-white text-[10px] font-black px-3 py-1.5 rounded-lg">☎️ 呼叫</a>}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "equipment" && (
          <div className="space-y-4">
             {equipmentMembers.map((member, idx) => {
                const originalIdx = memberData.findIndex(m => m.姓名 === member.姓名);
                return (
                  <div key={idx} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-3">
                    <h3 className="text-base font-black text-slate-800">{member.姓名}</h3>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                      <p className="text-sm font-black text-slate-700">{member.裝備明細}</p>
                      <input 
                        type="text" 
                        placeholder="請填寫損壞或遺失狀況..." 
                        value={member.問題回報 || ""} 
                        onChange={(e) => handleLocalTextChange(originalIdx, "問題回報", e.target.value)} 
                        onBlur={(e) => handleMemberFieldUpdate(originalIdx, "問題回報", e.target.value)} 
                        className="w-full text-xs font-bold border border-red-200 rounded-lg px-3 py-2 bg-red-50 text-slate-800 placeholder-red-300 focus:outline-none focus:border-red-400"
                      />
                      <div className="flex gap-2 pt-1">
                        <label className="flex-1 flex justify-center items-center gap-2 bg-white px-2 py-2.5 rounded-lg border border-slate-200 shadow-sm active:scale-95 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 text-sky-600 rounded" checked={member.裝備借出 === "TRUE"} onChange={(e) => handleMemberFieldUpdate(originalIdx, "裝備借出", e.target.checked ? "TRUE" : "FALSE")}/>
                          <span className="text-xs font-black text-slate-700">已借出</span>
                        </label>
                        <label className="flex-1 flex justify-center items-center gap-2 bg-white px-2 py-2.5 rounded-lg border border-slate-200 shadow-sm active:scale-95 cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 text-sky-600 rounded" checked={member.裝備歸還 === "TRUE"} onChange={(e) => handleMemberFieldUpdate(originalIdx, "裝備歸還", e.target.checked ? "TRUE" : "FALSE")}/>
                          <span className="text-xs font-black text-slate-700">已歸還</span>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {view === "meals" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-sky-800 to-slate-900 text-white p-4 rounded-2xl shadow-md border border-sky-700">
              <div className="flex justify-between items-end mb-3">
                <div>
                  <p className="text-[9px] text-sky-400 font-black tracking-widest uppercase">Catering Filter & Stats</p>
                  <h3 className="text-sm font-black text-slate-100 mt-0.5">🍱 點擊下方餐點分類可快速篩選</h3>
                </div>
                {selectedMealFilter && (
                  <button onClick={() => setSelectedMealFilter(null)} className="text-[10px] bg-slate-700 text-slate-200 px-2 py-1 rounded-md border border-slate-500 transition-all active:scale-95">✖ 取消篩選</button>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 mb-4">
                {Object.entries(mealStats).map(([meal, count]) => {
                  const isSelected = selectedMealFilter === meal;
                  return (
                    <button key={meal} onClick={() => setSelectedMealFilter(isSelected ? null : meal)} className={`p-2.5 rounded-xl flex justify-between items-center transition-all active:scale-95 text-left ${isSelected ? "bg-sky-600 border-2 border-amber-400 ring-2 ring-amber-400/30 shadow-lg" : "bg-slate-950/40 border border-sky-800/40 opacity-80 hover:opacity-100"}`}>
                      <span className={`text-xs font-bold truncate mr-1 ${isSelected ? "text-white" : "text-slate-300"}`}>{meal}</span>
                      <span className={`text-base font-black whitespace-nowrap ${isSelected ? "text-amber-300" : "text-sky-400"}`}>{count} <span className="text-[10px] font-bold opacity-70">份</span></span>
                    </button>
                  );
                })}
              </div>

              <div className="bg-slate-950/40 p-3 rounded-xl border border-sky-800/40">
                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-xs text-slate-300 font-bold">{selectedMealFilter ? `「${selectedMealFilter}」發放進度` : "全團總發放進度"}</span>
                  <div className="text-right leading-none">
                    <span className="text-lg font-black text-sky-400">{mealGiven}</span>
                    <span className="text-[10px] text-slate-500 font-bold mx-1">/</span>
                    <span className="text-xs font-bold text-slate-400">{mealTotal}</span>
                  </div>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all duration-500 ease-out ${mealRemain === 0 && mealTotal > 0 ? "bg-amber-400" : "bg-sky-500"}`} style={{ width: `${mealPercent}%` }}></div>
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
                  <div key={originalIdx} className={`bg-white border-2 p-4 rounded-2xl shadow-sm space-y-3 transition-colors ${isClaimed ? "border-slate-200/50 opacity-80" : "border-sky-400 shadow-md"}`}>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-slate-800">{member.姓名}</h3>
                        {!isClaimed && <span className="text-[10px] bg-amber-100 text-amber-700 font-black px-1.5 py-0.5 rounded-md animate-pulse">待領取</span>}
                        {isVegetarian && <span className="text-[10px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded-md">🥬 素食</span>}
                      </div>
                      <span className="text-xs font-bold text-slate-500">{member.分組 || "未編組"}</span>
                    </div>
                    <div className="bg-sky-50/60 border border-sky-100 rounded-xl p-3 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-sky-800 font-black mb-0.5">🍱 五合目餐食</p>
                        <p className="text-sm font-black text-slate-800">{member.五合目餐點 || "常規餐點"}</p>
                      </div>
                      <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-sky-200 shadow-sm active:scale-95 transition-all cursor-pointer">
                        <input type="checkbox" className="w-5 h-5 rounded text-sky-600" checked={isClaimed} onChange={(e) => handleMemberFieldUpdate(originalIdx, "餐點領取", e.target.checked ? "TRUE" : "FALSE")}/>
                        <span className={`font-black text-xs ${isClaimed ? "text-sky-800" : "text-slate-400"}`}>{isClaimed ? "已點收" : "確認領取"}</span>
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
