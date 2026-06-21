"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type ViewState = "menu" | "checkin" | "equipment" | "meals" | "rooms" | "roomSummary";

export default function TourDashboardPage() {
  const params = useParams();
  const tourId = params.tourId as string;

  const [view, setView] = useState<ViewState>("menu");
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  
  const [memberData, setMemberData] = useState<any[]>([]);
  const [roomData, setRoomData] = useState<any[]>([]);

  const SHEETDB_URL = "https://sheetdb.io/api/v1/ng85gs3977snc";

  async function fetchData() {
    try {
      setLoading(true);
      const resMembers = await fetch(`${SHEETDB_URL}?sheet=3日出團總表`, { cache: "no-store" });
      const allMembers = await resMembers.json();
      const filteredMembers = Array.isArray(allMembers) ? allMembers.filter((m: any) => m.團號 === tourId) : [];
      setMemberData(filteredMembers);

      const resRooms = await fetch(`${SHEETDB_URL}?sheet=3日排房表`, { cache: "no-store" });
      const allRooms = await resRooms.json();
      const filteredRooms = Array.isArray(allRooms) ? allRooms.filter((r: any) => r.團號 === tourId) : [];
      setRoomData(filteredRooms);
    } catch (error) {
      console.error("資料讀取失敗:", error);
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
        body: JSON.stringify({
          data: { [field]: valueStr }
        })
      });

      if (response.ok) {
        setSyncStatus("success");
      } else {
        setSyncStatus("error");
        alert("雲端同步失敗，請確認網路！");
      }
    } catch (error) {
      console.error("更新成員狀態出錯:", error);
      setSyncStatus("error");
    }
  };

  const handleRoomNumberChange = (index: number, newValue: string) => {
    const newData = [...roomData];
    newData[index] = { ...newData[index], 實際房號: newValue };
    setRoomData(newData);
  };

  const saveSingleRoomNumber = async (index: number) => {
    const room = roomData[index];
    const primaryGuest = room["房客 1"] || room.房客1;
    
    if (!primaryGuest) {
      alert("此房間沒有主要房客（房客 1），無法定位儲存！");
      return;
    }

    try {
      setSavingIdx(index);
      setSyncStatus("saving");
      const response = await fetch(`${SHEETDB_URL}/房客 1/${encodeURIComponent(primaryGuest)}?sheet=3日排房表`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { 實際房號: room.實際房號 || "" }
        })
      });

      if (response.ok) {
        setSyncStatus("success");
      } else {
        setSyncStatus("error");
        alert("儲存房號失敗！");
      }
    } catch (error) {
      console.error("更新房號出錯:", error);
      setSyncStatus("error");
    } finally {
      setSavingIdx(null);
    }
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
    } catch (error) {
      console.error("批次儲存失敗:", error);
      setSyncStatus("error");
      setView("roomSummary");
    } finally {
      setLoading(false);
    }
  };

  const getGuestsList = (room: any) => {
    const guests = [
      room.房客1 || room["房客 1"] || room["房客  1"],
      room.房客2 || room["房客 2"] || room["房客  2"],
      room.房客3 || room["房客 3"] || room["房客  3"],
      room.房客4 || room["房客 4"] || room["房客  4"]
    ];
    return guests
      .map(g => (g ? String(g).trim() : ""))
      .filter(g => g !== "" && g !== "undefined" && g !== "null");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 font-bold animate-pulse">⏳ 資料載入/雲端同步中...</p>
      </div>
    );
  }

  const equipmentMembers = memberData.filter(
    (m) => m.裝備明細 && m.裝備明細.trim() !== "" && m.裝備明細 !== "無"
  );

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center pb-12">
      {/* 頂部導覽列 */}
      <div className="w-full bg-white border-b border-slate-200 py-4 px-6 sticky top-0 z-10 flex items-center justify-between shadow-sm">
        <div>
          <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">團號 {tourId}</span>
          <h1 className="text-lg font-bold text-slate-800 mt-1">
            {view === "menu" && "嚮導工作平台"}
            {view === "checkin" && "📋 報到與基本資料"}
            {view === "equipment" && "🎒 裝備確認單"}
            {view === "meals" && "🍱 登山口餐點"}
            {view === "rooms" && "🏨 飯店排房表"}
            {view === "roomSummary" && "🗝️ 總房表 (發鑰匙用)"}
          </h1>
        </div>
        
        {view === "menu" ? (
          <Link href="/three-days" className="text-slate-500 text-sm font-bold bg-slate-100 px-4 py-2 rounded-xl active:scale-95 transition-all">
            返回列表
          </Link>
        ) : (
          <button onClick={() => setView("menu")} className="text-white text-sm font-bold bg-slate-800 px-4 py-2 rounded-xl active:scale-95 transition-all">
            ↩ 返回選單
          </button>
        )}
      </div>

      {/* 同步狀態燈條 */}
      {view !== "menu" && (
        <div className="w-full max-w-md px-4 mt-3">
          <div className={`text-center py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all ${
            syncStatus === "saving" ? "bg-amber-100 text-amber-800 animate-pulse" :
            syncStatus === "success" ? "bg-emerald-100 text-emerald-800" :
            syncStatus === "error" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-500"
          }`}>
            {syncStatus === "saving" && "⏳ 變更正在同步至雲端 Google 表單..."}
            {syncStatus === "success" && "✅ 所有變更已完美儲存回雲端"}
            {syncStatus === "error" && "❌ 同步出錯，請重新整理網頁"}
            {syncStatus === "idle" && "👍 雲端資料連線正常"}
          </div>
        </div>
      )}

      <div className="w-full max-w-md px-4 mt-4">
        
        {/* ================= 主選單畫面 ================= */}
        {view === "menu" && (
          <div className="grid grid-cols-1 gap-4">
            <button onClick={() => setView("checkin")} className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200 active:scale-[0.98] transition-all">
              <div className="text-left">
                <h2 className="text-xl font-bold text-slate-800">📋 報到與資料</h2>
                <p className="text-sm text-slate-500 mt-1">基本資料、下車地點、報到狀態</p>
              </div>
              <span className="text-2xl text-slate-300">➔</span>
            </button>

            <button onClick={() => setView("equipment")} className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200 active:scale-[0.98] transition-all">
              <div className="text-left">
                <h2 className="text-xl font-bold text-slate-800">🎒 裝備確認</h2>
                <p className="text-sm text-slate-500 mt-1">裝備明細、借出與歸還紀錄</p>
              </div>
              <span className="text-2xl text-slate-300">➔</span>
            </button>

            <button onClick={() => setView("meals")} className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200 active:scale-[0.98] transition-all">
              <div className="text-left">
                <h2 className="text-xl font-bold text-slate-800">🍱 餐點發放</h2>
                <p className="text-sm text-slate-500 mt-1">五合目餐點確認與領取</p>
              </div>
              <span className="text-2xl text-slate-300">➔</span>
            </button>

            <button onClick={() => setView("rooms")} className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200 active:scale-[0.98] transition-all">
              <div className="text-left">
                <h2 className="text-xl font-bold text-slate-800">🏨 飯店排房</h2>
                <p className="text-sm text-slate-500 mt-1">名單、備註、填寫實際房號</p>
              </div>
              <span className="text-2xl text-slate-300">➔</span>
            </button>

            <button onClick={() => setView("roomSummary")} className="flex items-center justify-between bg-blue-50 p-6 rounded-2xl shadow-sm border border-blue-200 active:scale-[0.98] transition-all">
              <div className="text-left">
                <h2 className="text-xl font-bold text-blue-800">🗝️ 總房表總覽</h2>
                <p className="text-sm text-blue-600 mt-1">快速查看所有房號與名單 (發鑰匙用)</p>
              </div>
              <span className="text-2xl text-blue-300">➔</span>
            </button>
          </div>
        )}

        {/* ================= 1. 報到資料 ================= */}
        {view === "checkin" && (
          <div className="space-y-4">
            {memberData.map((member, idx) => (
              <div key={idx} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">{member.姓名}</h3>
                    <p className="text-sm text-slate-500 mt-1">📱 {member.手機 || "無聯絡電話"}</p>
                  </div>
                  <span className="bg-slate-100 text-slate-600 text-sm px-3 py-1 rounded-lg font-bold">{member.分組 || "未編組"}</span>
                </div>
                {member.病史 && (
                  <div className="bg-red-50 border border-red-100 text-red-700 text-sm p-3 rounded-xl font-bold mb-3">
                    ⚠️ 特殊狀況：{member.病史}
                  </div>
                )}
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex justify-between items-center mt-2">
                  <div>
                    <p className="text-xs text-blue-600 font-bold mb-0.5">📍 下車地點</p>
                    <p className="text-sm font-bold text-slate-700">{member.下車地點 || "未填寫"}</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-blue-100 shadow-sm active:scale-95 transition-all">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded text-blue-600" 
                      checked={member.報到狀態 === "TRUE"} 
                      onChange={(e) => handleMemberStatusChange(idx, "報到狀態", e.target.checked)}
                    />
                    <span className="font-bold text-blue-800">已報到</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================= 2. 裝備確認 ================= */}
        {view === "equipment" && (
          <div className="space-y-4">
            {equipmentMembers.length === 0 ? (
              <p className="text-center text-slate-400 py-10 font-bold">🎉 此團無人需要租借裝備</p>
            ) : (
              equipmentMembers.map((member, idx) => {
                const originalIdx = memberData.findIndex(m => m.姓名 === member.姓名);
                return (
                  <div key={idx} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
                      <h3 className="text-lg font-bold text-slate-800">{member.姓名}</h3>
                      <span className="text-xs font-bold text-slate-500">{member.分組 || "未編組"}</span>
                    </div>
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                      <p className="text-xs text-emerald-600 font-bold mb-1">🎒 裝備明細</p>
                      <p className="text-sm font-bold text-slate-700 mb-3">{member.裝備明細}</p>
                      <div className="flex gap-2">
                        <label className="flex-1 flex justify-center items-center gap-2 bg-white px-3 py-2 rounded-lg border border-emerald-100 shadow-sm active:scale-95 transition-all">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded text-emerald-600" 
                            checked={member.裝備借出 === "TRUE"} 
                            onChange={(e) => handleMemberStatusChange(originalIdx, "裝備借出", e.target.checked)}
                          />
                          <span className="font-bold text-emerald-800 text-sm">已借出</span>
                        </label>
                        <label className="flex-1 flex justify-center items-center gap-2 bg-white px-3 py-2 rounded-lg border border-emerald-100 shadow-sm active:scale-95 transition-all">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded text-emerald-600" 
                            checked={member.裝備歸還 === "TRUE"} 
                            onChange={(e) => handleMemberStatusChange(originalIdx, "裝備歸還", e.target.checked)}
                          />
                          <span className="font-bold text-emerald-800 text-sm">已歸還</span>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ================= 3. 餐點發放 ================= */}
        {view === "meals" && (
          <div className="space-y-4">
            {memberData.map((member, idx) => (
              <div key={idx} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
                  <h3 className="text-lg font-bold text-slate-800">{member.姓名}</h3>
                  <span className="text-xs font-bold text-slate-500">{member.分組 || "未編組"}</span>
                </div>
                <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-orange-600 font-bold mb-0.5">🍱 餐點內容</p>
                    <p className="text-sm font-bold text-slate-700">{member.五合目餐點 || "無"}</p>
                  </div>
                  <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-orange-100 shadow-sm active:scale-95 transition-all">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded text-orange-600" 
                      checked={member.餐點領取 === "TRUE"} 
                      onChange={(e) => handleMemberStatusChange(idx, "餐點領取", e.target.checked)}
                    />
                    <span className="font-bold text-orange-800 text-sm">已領取</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================= 4. 飯店排房表 ================= */}
        {view === "rooms" && (
          <div className="space-y-4">
            {roomData.map((room, idx) => {
              const guests = getGuestsList(room);
              return (
                <div key={idx} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-3">
                    <div>
                      <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-1 rounded-md">
                        入住：{room.入住日期 ? room.入住日期.substring(5) : "未定"}
                      </span>
                      <h3 className="text-lg font-bold text-slate-800 mt-2">{room.飯店名稱}</h3>
                    </div>
                    <span className="text-sm font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg">
                      {room.房型}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-3">
                    <p className="text-xs text-slate-400 font-bold mb-1">入住名單</p>
                    <p className="text-base font-bold text-slate-700">
                      {guests.length > 0 ? guests.join(" 、 ") : <span className="text-slate-400 font-normal text-sm">未排定房客</span>}
                    </p>
                  </div>
                  {room.備註 && (
                    <div className="text-sm bg-amber-50 border border-amber-100 text-amber-800 p-3 rounded-xl font-medium mb-3">
                      💬 {room.備註}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-700 whitespace-nowrap">登記房號：</span>
                    <input
                      type="text"
                      placeholder="輸入房號..."
                      value={room.實際房號 || ""}
                      onChange={(e) => handleRoomNumberChange(idx, e.target.value)}
                      className="flex-1 min-w-0 border-2 border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none focus:border-blue-500 bg-white text-sm"
                    />
                    <button
                      onClick={() => saveSingleRoomNumber(idx)}
                      disabled={savingIdx !== null}
                      className="bg-emerald-600 text-white font-bold text-xs px-3 py-2.5 rounded-xl shadow-sm active:scale-95 disabled:bg-slate-300 transition-all whitespace-nowrap"
                    >
                      {savingIdx === idx ? "⏳..." : "💾 儲存"}
                    </button>
                  </div>
                </div>
              );
            })}
            
            <button 
              onClick={handleSaveAllAndSummary}
              className="w-full mt-6 bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-md active:scale-95 transition-all text-center"
            >
              🚀 一鍵同步雲端並看總房表 ➔
            </button>
          </div>
        )}

        {/* ================= 5. 總房表表畫面 ================= */}
        {view === "roomSummary" && (
          <div className="space-y-3">
            {roomData.map((room, idx) => {
              const guests = getGuestsList(room);
              return (
                <div key={idx} className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex-1">
                    <div className="text-xs text-slate-500 font-bold mb-1">
                      {room.入住日期 ? room.入住日期.substring(5) : ""} | {room.飯店名稱}
                    </div>
                    <div className="text-base font-bold text-slate-800">
                      {guests.length > 0 ? guests.join(" 、 ") : <span className="text-slate-400 font-normal text-sm">未排定房客</span>}
                    </div>
                  </div>
                  <div className="ml-4 pl-4 border-l border-slate-100 flex flex-col items-center justify-center min-w-[70px]">
                    <span className="text-xs text-slate-400 font-bold mb-0.5">房號</span>
                    <span className={`text-2xl font-black ${room.實際房號 ? "text-blue-600" : "text-slate-300"}`}>
                      {room.實際房號 || "未填"}
                    </span>
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
