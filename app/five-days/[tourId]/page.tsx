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

  // 🏨 三階段飯店切換狀態 (預設看東京首日)
  const [selectedHotelStage, setSelectedHotelStage] = useState<string>("東京首日");

  const SHEETDB_URL = "https://sheetdb.io/api/v1/ng85gs3977snc";

  const calculateStats = (members: any[], rooms: any[]) => {
    const mealsMap: { [key: string]: number } = {};
    const transferMap: { [key: string]: number } = {};
    const bikesMap: { [key: string]: number } = {};
    const groupsSet = new Set<string>();

    members.forEach((m: any) => {
      // 餐點
      const meal = m.五合目餐點 ? String(m.五合目餐點).trim() : "常規餐點";
      mealsMap[meal] = (mealsMap[meal] || 0) + 1;

      // 接送模式
      const trans = m.接送模式 ? String(m.接送模式).trim() : "未定";
      transferMap[trans] = (transferMap[trans] || 0) + 1;

      // 單車需求
      const bike = m.單車需求 ? String(m.單車需求).trim() : "無";
      if (bike !== "無") {
        bikesMap[bike] = (bikesMap[bike] || 0) + 1;
      }

      // 分組
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

  // 🏨 飯店排房更新邏輯
  const handleRoomNumberChange = (index: number, newValue: string) => {
    const newData = [...roomData];
    newData[index] = { ...newData[index], 實際房號: newValue };
    setRoomData(newData);
  };

  // 🏨 儲存單一房間：只要存這一列，同房4人的房號就自動連動完成了！
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

  // 🌟 跨表連動：取得該房客人的禁忌食材
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

  // === 各模組進度運算 ===
  const displayedCheckins = selectedTransferFilter ? memberData.filter(m => (m.接送模式 ? String(m.接送模式).trim() : "未定") === selectedTransferFilter) : [...memberData];
  displayedCheckins.sort((a, b) => (a.報到狀態 === "TRUE" ? 1 : -1));
  const checkinTotal = displayedCheckins.length;
  const checkinDone = displayedCheckins.filter(m => m.報到狀態 === "TRUE").length;

  const equipmentMembers = memberData.filter((m) => m.裝備明細 && m.裝備明細.trim() !== "" && m.裝備明細 !== "無");
  const equipTotal = equipmentMembers.length;
  const equipGiven = equipmentMembers.filter(m => m.裝備借出 === "TRUE").length;

  const displayedMeals = selectedMealFilter ? memberData.filter(m => (m.五合目餐點 ? String(m.五合目餐點).trim() : "常規餐點") === selectedMealFilter) : memberData;
  const mealTotal = displayedMeals.length;
  const mealGiven = displayedMeals.filter(m => m.餐點領取 === "TRUE").length;

  const bikeMembers = memberData.filter((m) => m.單車需求 && m.單車需求.trim() !== "" && m.單車需求 !== "無");
  const bikeTotal = bikeMembers.length;
  const bikeGiven = bikeMembers.filter(m => m.單車點收 === "TRUE").length;

  // 🏨 當前階段的飯店排房資料過濾
  const currentStageRooms = roomData.filter((r) => r.住宿階段 === selectedHotelStage);

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center pb-12">
      {/* 頂部導覽列 (海洋深藍系) */}
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
            {view === "bikes" && "🚴 河口湖單車點收"}
          </h1>
        </div>
        {view === "menu" ? (
          <Link href="/five-days" className="text-sky-100 text-xs font-bold bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl active:scale-95 transition-all">返回總表</Link>
        ) : (
          <button onClick={() => { setView("menu"); setSelectedTransferFilter(null); setSelectedMealFilter(null); }} className="text-sky-950 text-xs font-black bg-sky-400 hover:bg-sky-300 px-4 py-2 rounded-xl active:scale-95 transition-all shadow-sm">↩ 回選單</button>
        )}
      </div>

      {/* 戰術狀態提示條 */}
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

            {/* 兩兩並排的小模組 */}
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
              <p className="text-[10px] text-sky-700 font-bold">河口湖車輛點收</p>
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

        {/* ================= ✈️ 機場接駁與報到 (五日團專屬) ================= */}
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
                    <input type="text" placeholder="追加註記..." value={member.備註 || ""} onChange={(e) => handleLocalTextChange(originalIdx, "備註", e.target.value)} onBlur={(e) => handleMemberFieldUpdate(originalIdx, "備註", e.target.value)} className="w-full text-xs font-bold border-2 border-slate-200 rounded-xl px-3 py-2 bg-slate-50 focus:border-sky-500"/>
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

        {/* ================= 🏨 三階段飯店排房 (五日團專屬) ================= */}
        {view === "rooms" && (
          <div className="space-y-4">
            {/* 🌟 飯店階段切換器 */}
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
                
                // 🌟 自動去抓這間房客人的禁忌食材
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

                    {/* 🌟 溫泉旅館專屬：禁忌食材紅燈警告 */}
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

        {/* ================= 🚴 單車租借 (五日團專屬) ================= */}
        {view === "bikes" && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-sky-800 to-sky-950 text-white p-4 rounded-2xl shadow-md border border-sky-700">
              <h3 className="text-sm font-black text-sky-100 mb-3">🚴 單車需求總計</h3>
              <div className="flex gap-2">
                {Object.entries(bikeStats).map(([type, count]) => (
                  <div key={type} className="flex-1 bg-slate-900/50 border border-sky-500/50 p-3 rounded-xl text-center">
                    <p className="text-[10px] text-sky-300 font-bold mb-1">{type}</p>
                    <p className="text-xl font-black text-white">{count} <span className="text-xs font-normal">台</span></p>
                  </div>
                ))}
              </div>
            </div>

            {bikeMembers.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-slate-200">
                <p className="text-slate-400 text-sm font-bold">本團無人登記單車需求</p>
              </div>
            ) : (
              bikeMembers.map((member, _idx) => {
                const originalIdx = memberData.findIndex(m => m.姓名 === member.姓名);
                const isBikeGiven = member.單車點收 === "TRUE";

                return (
                  <div key={originalIdx} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex justify-between items-center">
                    <div>
                      <h3 className="text-base font-black text-slate-800">{member.姓名}</h3>
                      <span className="inline-block mt-1 bg-sky-100 text-sky-800 text-[10px] px-2 py-0.5 rounded-md font-bold">{member.單車需求}</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 shadow-sm active:scale-95">
                      <input type="checkbox" className="w-5 h-5 rounded text-sky-600" checked={isBikeGiven} onChange={(e) => handleMemberFieldUpdate(originalIdx, "單車點收", e.target.checked ? "TRUE" : "FALSE")}/>
                      <span className={`font-black text-xs ${isBikeGiven ? "text-sky-800" : "text-slate-500"}`}>{isBikeGiven ? "已領車" : "點收"}</span>
                    </label>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ================= 總房表、裝備、餐點、名單、聯絡人 (共用簡化邏輯) ================= */}
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
                      <input type="text" placeholder="損壞回報..." value={member.問題回報 || ""} onChange={(e) => handleLocalTextChange(originalIdx, "問題回報", e.target.value)} onBlur={(e) => handleMemberFieldUpdate(originalIdx, "問題回報", e.target.value)} className="w-full text-xs font-bold border border-red-200 rounded-lg px-2 py-1.5 bg-red-50"/>
                      <div className="flex gap-2 pt-1">
                        <label className="flex-1 flex justify-center items-center gap-2 bg-white px-2 py-2 rounded-lg border border-slate-200">
                          <input type="checkbox" className="w-4 h-4 text-sky-600" checked={member.裝備借出 === "TRUE"} onChange={(e) => handleMemberFieldUpdate(originalIdx, "裝備借出", e.target.checked ? "TRUE" : "FALSE")}/><span className="text-xs font-bold">已借出</span>
                        </label>
                        <label className="flex-1 flex justify-center items-center gap-2 bg-white px-2 py-2 rounded-lg border border-slate-200">
                          <input type="checkbox" className="w-4 h-4 text-sky-600" checked={member.裝備歸還 === "TRUE"} onChange={(e) => handleMemberFieldUpdate(originalIdx, "裝備歸還", e.target.checked ? "TRUE" : "FALSE")}/><span className="text-xs font-bold">已歸還</span>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {view === "meals" && (
          <div className="space-y-3">
             {displayedMeals.map((member, _idx) => {
                const originalIdx = memberData.findIndex(m => m.姓名 === member.姓名);
                return (
                  <div key={originalIdx} className="bg-white border border-slate-200 p-3 rounded-xl flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-black text-slate-800">{member.姓名}</h3>
                      <p className="text-[10px] text-amber-600 font-bold mt-0.5">{member.五合目餐點 || "常規餐點"}</p>
                    </div>
                    <label className="flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200">
                      <input type="checkbox" className="w-4 h-4 text-sky-600" checked={member.餐點領取 === "TRUE"} onChange={(e) => handleMemberFieldUpdate(originalIdx, "餐點領取", e.target.checked ? "TRUE" : "FALSE")}/>
                      <span className="font-bold text-[10px]">已領</span>
                    </label>
                  </div>
                );
              })}
          </div>
        )}

        {view === "roomSummary" && (
           <div className="space-y-3">
             {roomData.map((room, idx) => {
               const guests = getGuestsList(room);
               return (
                 <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200">
                   <div className="flex-1">
                     <div className="text-[9px] text-sky-600 font-bold mb-0.5">{room.住宿階段} | {room.飯店名稱}</div>
                     <div className="text-xs font-black text-slate-800">{guests.length > 0 ? guests.join("、") : "未排"}</div>
                   </div>
                   <div className="ml-2 pl-2 border-l border-slate-200 flex flex-col items-center justify-center min-w-[50px]">
                     <span className="text-[9px] text-slate-400 font-bold">房號</span>
                     <span className={`text-base font-black ${room.實際房號 ? "text-sky-700" : "text-slate-300"}`}>{room.實際房號 || "—"}</span>
                   </div>
                 </div>
               );
             })}
           </div>
        )}

      </div>
    </main>
  );
}
