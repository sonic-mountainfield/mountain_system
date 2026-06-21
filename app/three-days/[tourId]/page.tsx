"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type ViewState = "menu" | "checkin" | "equipment" | "meals" | "rooms" | "roomSummary" | "groupDetail";

export default function TourDashboardPage() {
  const params = useParams();
  const tourId = params.tourId as string;

  const [view, setView] = useState<ViewState>("menu");
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  
  const [memberData, setMemberData] = useState<any[]>([]);
  const [roomData, setRoomData] = useState<any[]>([]);
  const [tourGroups, setTourGroups] = useState<string[]>([]);

  // 🌟 自動統計用的 State 宣告
  const [mealStats, setMealStats] = useState<{ [key: string]: number }>({});
  const [dropoffStats, setDropoffStats] = useState<{ [key: string]: number }>({});
  const [roomTypeStats, setRoomTypeStats] = useState<{ [key: string]: number }>({});

  const SHEETDB_URL = "https://sheetdb.io/api/v1/ng85gs3977snc";

  async function fetchData() {
    try {
      setLoading(true);
      // 1. 撈取團員名單並進行餐點與下車點統計
      const resMembers = await fetch(`${SHEETDB_URL}?sheet=3日出團總表`, { cache: "no-store" });
      const allMembers = await resMembers.json();
      const filteredMembers = Array.isArray(allMembers) ? allMembers.filter((m: any) => m.團號 === tourId) : [];
      setMemberData(filteredMembers);

      // 🔄 [自動化統計 A]: 登山口餐點 & 報到下車地點
      const mealsMap: { [key: string]: number } = {};
      const dropoffMap: { [key: string]: number } = {};
      const groupsSet = new Set<string>();

      filteredMembers.forEach((m: any) => {
        // 餐點統計
        const meal = m.五合目餐點 ? String(m.五合目餐點).trim() : "常規餐點";
        mealsMap[meal] = (mealsMap[meal] || 0) + 1;

        // 下車地點統計
        const loc = m.下車地點 ? String(m.下車地點).trim() : "未填寫";
        dropoffMap[loc] = (dropoffMap[loc] || 0) + 1;

        // 分組收集
        const gName = m.分組 ? String(m.分組).trim() : "";
        if (gName && gName !== "無" && gName !== "undefined" && gName !== "null") {
          groupsSet.add(gName);
        }
      });
      setMealStats(mealsMap);
      setDropoffStats(dropoffMap);
      setTourGroups(Array.from(groupsSet).sort());

      // 2. 撈取排房表並進行房型數量統計
      const resRooms = await fetch(`${SHEETDB_URL}?sheet=3日排房表`, { cache: "no-store" });
      const allRooms = await resRooms.json();
      const filteredRooms = Array.isArray(allRooms) ? allRooms.filter((r: any) => r.團號 === tourId) : [];
      setRoomData(filteredRooms);

      // 🔄 [自動化統計 B]: 房表房型統計
      const roomsMap: { [key: string]: number } = {};
      filteredRooms.forEach((r: any) => {
        const rType = r.房型 ? String(r.房型).trim() : "未定房型";
        roomsMap[rType] = (roomsMap[rType] || 0) + 1;
      });
      setRoomTypeStats(roomsMap);

    } catch (error) {
      console.error("資料自動化統計失敗:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tourId) fetchData();
  }, [tourId]);

  const handleMemberStatusChange = async (index: number, field: string, isChecked: boolean) => {
    setSyncStatus("saving");
    const updatedMembers = [...memberData];
    const valueStr = isChecked ? "TRUE" : "FALSE";
    updatedMembers[index] = { ...updatedMembers[index], [field]: valueStr };
    setMemberData(updatedMembers);

    const memberName = updatedMembers[index].姓名;

    try {
      const response = await fetch(`${SHEETDB_URL}/姓名/${encodeURIComponent(memberName)}?sheet=3日出團總表`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { [field]: valueStr } })
      });
      if (response.ok) setSyncStatus("success");
      else { setSyncStatus("error"); alert("雲端同步失敗！"); }
    } catch (error) { console.error(error); setSyncStatus("error"); }
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
      const response = await fetch(`${SHEETDB_URL}/房客 1/${encodeURIComponent(primaryGuest)}?sheet=3日排房表`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { 實際房號: room.實際房號 || "" } })
      });
      if (response.ok) setSyncStatus("success");
      else setSyncStatus("error");
    } catch (error) { setSyncStatus("error"); } finally { setSavingIdx(null); }
  };

  const handleSaveAllAndSummary = async () => {
    setLoading(true);
    setSyncStatus("saving");
    try {
      for (let i = 0; i < roomData.length; i++) {
        const room = roomData[i];
        const primaryGuest = room["房客 1"] || room.房客1;
        if (primaryGuest) {
          await fetch(`${SHEETDB_URL}/房客 1/${encodeURIComponent(primaryGuest)}?sheet=3日排房表`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: { 實際房號: room.實際房號 || "" } })
          });
        }
      }
      setSyncStatus("success");
      await fetchData();
      setView("roomSummary");
    } catch (error) { setSyncStatus("error"); setView("roomSummary"); } finally { setLoading(false); }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center">
        <p className="text-emerald-400 font-bold animate-pulse">🌲 岳野運算引擎・核心數據統計中...</p>
      </div>
    );
  }

  const equipmentMembers = memberData.filter((m) => m.裝備明細 && m.裝備明細.trim() !== "" && m.裝備明細 !== "無");

  return (
    <main className="min-h-screen bg-stone-100 flex flex-col items-center pb-12">
      {/* 頂部山林導覽列 */}
      <div className="w-full bg-emerald-950 text-white py-4 px-6 sticky top-0 z-10 flex items-center justify-between shadow-md border-b border-emerald-900">
        <div>
          <span className="text-[10px] font-black bg-amber-500 text-emerald-950 px-2 py-0.5 rounded-full uppercase tracking-wider">團號 {tourId}</span>
          <h1 className="text-lg font-black text-emerald-50 mt-1 tracking-wide">
            {view === "menu" && "岳野嚮導工作台"}
            {view === "groupDetail" && "🥾 團隊分組總覽"}
            {view === "checkin" && "📋 報到下車點統計與名單"}
            {view === "equipment" && "🎒 裝備確認單"}
            {view === "meals" && "🍱 餐點發放統計與名單"}
            {view === "rooms" && "🏨 飯店分房登記"}
            {view === "roomSummary" && "🗝️ 總房型統計與快速房表"}
          </h1>
        </div>
        {view === "menu" ? (
          <Link href="/three-days" className="text-emerald-100 text-xs font-bold bg-emerald-900/60 border border-emerald-800 px-4 py-2 rounded-xl active:scale-95 transition-all">返回列表</Link>
        ) : (
          <button onClick={() => setView("menu")} className="text-emerald-950 text-xs font-black bg-amber-400 px-4 py-2 rounded-xl active:scale-95 transition-all shadow-sm">↩ 返回選單</button>
        )}
      </div>

      {/* 同步狀態提示條 */}
      {view !== "menu" && (
        <div className="w-full max-w-md px-4 mt-3">
          <div className={`text-center py-1.5 rounded-xl text-xs font-bold shadow-sm border transition-all ${
            syncStatus === "saving" ? "bg-amber-50 text-amber-800 border-amber-200 animate-pulse" :
            syncStatus === "success" ? "bg-emerald-800 text-emerald-50 border-emerald-700" :
            syncStatus === "error" ? "bg-orange-100 text-orange-800 border-orange-200" : "bg-stone-200/80 text-stone-600 border-stone-300"
          }`}>
            {syncStatus === "saving" && "⏳ 正在將變更上傳至 Google 試算表..."}
            {syncStatus === "success" && "🌲 雲端資料已即時同步存檔成功"}
            {syncStatus === "error" && "❌ 雲端連線失敗，請檢查高山收訊"}
            {syncStatus === "idle" && "🌿 岳野雲端安全連線中"}
          </div>
        </div>
      )}

      <div className="w-full max-w-md px-4 mt-4">
        
        {/* ================= 主選單畫面 ================= */}
        {view === "menu" && (
          <div className="grid grid-cols-1 gap-4">
            <button onClick={() => setView("groupDetail")} className="flex items-center justify-between bg-gradient-to-r from-emerald-800 to-emerald-900 p-5 rounded-2xl shadow-md border border-emerald-700 text-white active:scale-[0.98] transition-all">
              <div className="text-left">
                <h2 className="text-lg font-black text-amber-400">🥾 登山分組看名單</h2>
                <p className="text-xs text-emerald-200 mt-1">快速切換查看 A組、B組各組成員是誰</p>
              </div>
              <span className="text-xl text-amber-400 font-bold">➔</span>
            </button>

            <button onClick={() => setView("checkin")} className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-stone-200 active:scale-[0.98] transition-all hover:border-emerald-300">
              <div className="text-left">
                <h2 className="text-lg font-black text-stone-800">📋 報到與基本資料 (含下車點統計)</h2>
                <p className="text-xs text-stone-500 mt-1">下車地點人次自動化加總、點名報到</p>
              </div>
              <span className="text-xl text-emerald-700 font-bold">➔</span>
            </button>

            <button onClick={() => setView("equipment")} className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-stone-200 active:scale-[0.98] transition-all hover:border-emerald-300">
              <div className="text-left">
                <h2 className="text-lg font-black text-stone-800">🎒 裝備借出與歸還</h2>
                <p className="text-xs text-stone-500 mt-1">自動過濾名單、確認租借明細</p>
              </div>
              <span className="text-xl text-emerald-700 font-bold">➔</span>
            </button>

            <button onClick={() => setView("meals")} className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-stone-200 active:scale-[0.98] transition-all hover:border-emerald-300">
              <div className="text-left">
                <h2 className="text-lg font-black text-stone-800">🍱 登山口餐點發放 (含數量統計)</h2>
                <p className="text-xs text-stone-500 mt-1">便當餐包數量自動統計、餐食領取確認</p>
              </div>
              <span className="text-xl text-emerald-700 font-bold">➔</span>
            </button>

            <button onClick={() => setView("rooms")} className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-stone-200 active:scale-[0.98] transition-all hover:border-emerald-300">
              <div className="text-left">
                <h2 className="text-lg font-black text-stone-800">🏨 飯店分房登記</h2>
                <p className="text-xs text-stone-500 mt-1">查看入住名單、填寫現場實際房號</p>
              </div>
              <span className="text-xl text-emerald-700 font-bold">➔</span>
            </button>

            <button onClick={() => setView("roomSummary")} className="flex items-center justify-between bg-emerald-50 p-5 rounded-2xl shadow-sm border-2 border-emerald-600/40 active:scale-[0.98] transition-all">
              <div className="text-left">
                <h2 className="text-lg font-black text-emerald-900">🗝️ 飯店總房表快速對照 (含房型統計)</h2>
                <p className="text-xs text-emerald-700 mt-1">櫃檯領鑰匙必備、雙人房四人房總數清點</p>
              </div>
              <span className="text-xl text-emerald-600 font-bold">➔</span>
            </button>
          </div>
        )}

        {/* ================= 🥾 分組名單畫面 ================= */}
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
                        <div key={idx} className="p-3 flex justify-between items-center bg-white hover:bg-stone-50/50">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-stone-800 text-base">{member.姓名}</span>
                              {isVegetarian && <span className="text-[10px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded-md">🥬 素食</span>}
                            </div>
                            <span className="text-xs text-stone-400 font-medium block mt-0.5">📱 {member.手機 || "無"}</span>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-md border ${member.報到狀態 === "TRUE" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-stone-50 text-stone-400 border-stone-200"}`}>{member.報到狀態 === "TRUE" ? "✅ 已報到" : "⏳ 未報到"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================= 📋 3. 報到與下車地點 (新增全自動統計看板) ================= */}
        {view === "checkin" && (
          <div className="space-y-4">
            {/* 📊 🤖 下車點自動化統計看板 */}
            <div className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white p-4 rounded-2xl shadow-md border border-emerald-800">
              <p className="text-[9px] text-emerald-400 font-black tracking-widest uppercase">Drop-off Automation Stats</p>
              <h3 className="text-sm font-black text-emerald-100 mt-0.5 mb-3">📍 下車接駁地點人次加總</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(dropoffStats).map(([loc, count]) => (
                  <div key={loc} className="bg-stone-950/40 border border-emerald-800/40 p-2.5 rounded-xl flex justify-between items-center">
                    <span className="text-xs font-bold text-stone-300 truncate mr-1">{loc}</span>
                    <span className="text-base font-black text-amber-400 whitespace-nowrap">{count} <span className="text-[10px] text-stone-400 font-bold">人</span></span>
                  </div>
                ))}
              </div>
            </div>

            {memberData.map((member, idx) => {
              const isVegetarian = String(member.病史 || "").includes("素") || String(member.五合目餐點 || "").includes("素");
              return (
                <div key={idx} className="bg-white border border-stone-200 p-4 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-stone-800">{member.姓名}</h3>
                        {isVegetarian && <span className="text-[10px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded-md">🥬 素食</span>}
                      </div>
                      <p className="text-xs text-stone-500 font-medium mt-1">📱 {member.手機 || "無"}</p>
                    </div>
                    <span className="bg-stone-100 text-stone-600 text-xs px-2.5 py-1 rounded-lg font-bold border border-stone-200">{member.分組 || "未編組"}</span>
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex justify-between items-center mt-2">
                    <div>
                      <p className="text-[10px] text-emerald-700 font-black mb-0.5">📍 下車地點</p>
                      <p className="text-sm font-black text-stone-700">{member.下車地點 || "未填寫"}</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-emerald-200 shadow-sm active:scale-95 transition-all">
                      <input type="checkbox" className="w-5 h-5 rounded text-emerald-700" checked={member.報到狀態 === "TRUE"} onChange={(e) => handleMemberStatusChange(idx, "報到狀態", e.target.checked)}/>
                      <span className="font-black text-emerald-900 text-sm">已報到</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================= 🎒 4. 裝備確認 ================= */}
        {view === "equipment" && (
          <div className="space-y-4">
            {equipmentMembers.length === 0 ? (
              <div className="text-center bg-white border border-stone-200 py-12 rounded-2xl">
                <p className="text-3xl">🎉</p>
                <p className="text-stone-600 font-black text-sm mt-2">此團嚮導不需發放任何租借裝備</p>
              </div>
            ) : (
              equipmentMembers.map((member, idx) => {
                const originalIdx = memberData.findIndex(m => m.姓名 === member.姓名);
                return (
                  <div key={idx} className="bg-white border border-stone-200 p-4 rounded-2xl shadow-sm">
                    <div className="flex justify-between items-center border-b border-stone-100 pb-2 mb-3">
                      <h3 className="text-base font-black text-stone-800">{member.姓名}</h3>
                      <span className="text-xs font-bold text-stone-500">{member.分組 || "未編組"}</span>
                    </div>
                    <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                      <p className="text-[10px] text-emerald-800 font-black mb-1">🎒 租借明細</p>
                      <p className="text-sm font-black text-stone-700 mb-3">{member.裝備明細}</p>
                      <div className="flex gap-2">
                        <label className="flex-1 flex justify-center items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-stone-200 active:scale-95 transition-all cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 text-emerald-700 rounded" checked={member.裝備借出 === "TRUE"} onChange={(e) => handleMemberStatusChange(originalIdx, "裝備借出", e.target.checked)}/>
                          <span className="font-black text-stone-700 text-xs">已借出</span>
                        </label>
                        <label className="flex-1 flex justify-center items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-stone-200 active:scale-95 transition-all cursor-pointer">
                          <input type="checkbox" className="w-4 h-4 text-emerald-700 rounded" checked={member.裝備歸還 === "TRUE"} onChange={(e) => handleMemberStatusChange(originalIdx, "裝備歸還", e.target.checked)}/>
                          <span className="font-black text-stone-700 text-xs">已歸還</span>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ================= 🍱 5. 登山口餐點 (新增全自動餐食統計看板) ================= */}
        {view === "meals" && (
          <div className="space-y-4">
            {/* 📊 🤖 餐點數量自動化統計看板 */}
            <div className="bg-gradient-to-br from-emerald-900 to-stone-900 text-white p-4 rounded-2xl shadow-md border border-emerald-800">
              <p className="text-[9px] text-emerald-400 font-black tracking-widest uppercase">Catering Automation Stats</p>
              <h3 className="text-sm font-black text-emerald-100 mt-0.5 mb-3">🍱 五合目登山口物資總量清點</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(mealStats).map(([meal, count]) => (
                  <div key={meal} className="bg-stone-950/40 border border-emerald-800/40 p-2.5 rounded-xl flex justify-between items-center">
                    <span className="text-xs font-bold text-stone-300 truncate mr-1">{meal}</span>
                    <span className="text-base font-black text-amber-400 whitespace-nowrap">{count} <span className="text-[10px] text-stone-400 font-bold">份</span></span>
                  </div>
                ))}
              </div>
            </div>

            {memberData.map((member, idx) => {
              const isVegetarian = String(member.病史 || "").includes("素") || String(member.五合目餐點 || "").includes("素");
              return (
                <div key={idx} className="bg-white border border-stone-200 p-4 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-center border-b border-stone-100 pb-2 mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-stone-800">{member.姓名}</h3>
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
                      <input type="checkbox" className="w-5 h-5 rounded text-orange-600" checked={member.餐點領取 === "TRUE"} onChange={(e) => handleMemberStatusChange(idx, "餐點領取", e.target.checked)}/>
                      <span className="font-black text-orange-950 text-xs">已點收</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================= 🏨 6. 飯店排房登記 ================= */}
        {view === "rooms" && (
          <div className="space-y-4">
            {roomData.map((room, idx) => {
              const guests = getGuestsList(room);
              return (
                <div key={idx} className="bg-white border border-stone-200 p-4 rounded-2xl shadow-sm">
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
                    <input type="text" placeholder="填寫實際房號" value={room.實際房號 || ""} onChange={(e) => handleRoomNumberChange(idx, e.target.value)} className="flex-1 min-w-0 border-2 border-stone-300 rounded-xl px-3 py-2 font-black text-stone-800 focus:outline-none focus:border-emerald-600 bg-stone-50 text-sm"/>
                    <button onClick={() => saveSingleRoomNumber(idx)} disabled={savingIdx !== null} className="bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs px-3 py-2.5 rounded-xl active:scale-95 disabled:bg-stone-300 transition-all">{savingIdx === idx ? "⏳" : "💾 儲存"}</button>
                  </div>
                </div>
              );
            })}
            <button onClick={handleSaveAllAndSummary} className="w-full mt-6 bg-emerald-700 text-white font-black py-4 rounded-2xl shadow-md active:scale-95 transition-all text-center text-sm tracking-wide">🌲 一鍵同步雲端並看總房表 ➔</button>
          </div>
        )}

        {/* ================= 🗝️ 7. 總房表快速對照 (新增房型加總統計看板) ================= */}
        {view === "roomSummary" && (
          <div className="space-y-3">
            {/* 📊 🤖 房型總量自動化統計看板 */}
            <div className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white p-4 rounded-2xl shadow-md border border-emerald-800 mb-2">
              <p className="text-[9px] text-emerald-400 font-black tracking-widest uppercase">Room-type Automation Stats</p>
              <h3 className="text-sm font-black text-emerald-100 mt-0.5 mb-3">🏨 飯店各式房型總量清點 (向櫃檯拿鑰匙專用)</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(roomTypeStats).map(([rType, count]) => (
                  <div key={rType} className="bg-stone-950/40 border border-emerald-800/40 p-2.5 rounded-xl flex justify-between items-center">
                    <span className="text-xs font-bold text-stone-300 truncate mr-1">{rType}</span>
                    <span className="text-base font-black text-amber-400 whitespace-nowrap">{count} <span className="text-[10px] text-stone-400 font-bold">間</span></span>
                  </div>
                ))}
              </div>
            </div>

            {roomData.map((room, idx) => {
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
            })}
          </div>
        )}

      </div>
    </main>
  );
}
