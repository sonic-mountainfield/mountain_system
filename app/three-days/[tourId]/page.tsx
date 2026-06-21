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
  const [tourGroups, setTourGroups] = useState<string[]>([]); // 🌟 新增：用來存放這團所有不重複的分組

  const SHEETDB_URL = "https://sheetdb.io/api/v1/ng85gs3977snc";

  async function fetchData() {
    try {
      setLoading(true);
      const resMembers = await fetch(`${SHEETDB_URL}?sheet=3日出團總表`, { cache: "no-store" });
      const allMembers = await resMembers.json();
      const filteredMembers = Array.isArray(allMembers) ? allMembers.filter((m: any) => m.團號 === tourId) : [];
      setMemberData(filteredMembers);

      // 🌟 動態分析這團的所有不重複分組標籤
      const groupsSet = new Set<string>();
      filteredMembers.forEach((m: any) => {
        const gName = m.分組 ? String(m.分組).trim() : "";
        if (gName && gName !== "無" && gName !== "undefined" && gName !== "null") {
          groupsSet.add(gName);
        }
      });
      setTourGroups(Array.from(groupsSet).sort());

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
      <div className="min-h-screen bg-stone-900 flex items-center justify-center">
        <p className="text-emerald-400 font-bold animate-pulse">🌲 嚮導平台雲端同步中...</p>
      </div>
    );
  }

  const equipmentMembers = memberData.filter(
    (m) => m.裝備明細 && m.裝備明細.trim() !== "" && m.裝備明細 !== "無"
  );

  return (
    <main className="min-h-screen bg-stone-100 flex flex-col items-center pb-12">
      {/* 頂部山林墨綠導覽列 */}
      <div className="w-full bg-emerald-950 text-white py-4 px-6 sticky top-0 z-10 flex items-center justify-between shadow-md border-b border-emerald-900">
        <div>
          <span className="text-[10px] font-black bg-amber-500 text-emerald-950 px-2 py-0.5 rounded-full uppercase tracking-wider">
            團號 {tourId}
          </span>
          <h1 className="text-lg font-black text-emerald-50 mt-1 tracking-wide">
            {view === "menu" && "岳野嚮導工作台"}
            {view === "checkin" && "📋 報到與基本資料"}
            {view === "equipment" && "🎒 裝備確認單"}
            {view === "meals" && "🍱 登山口餐點"}
            {view === "rooms" && "🏨 飯店排房表"}
            {view === "roomSummary" && "🗝️ 總房表 (發鑰匙)"}
          </h1>
        </div>
        
        {view === "menu" ? (
          <Link href="/three-days" className="text-emerald-100 text-xs font-bold bg-emerald-900/60 border border-emerald-800 px-4 py-2 rounded-xl active:scale-95 transition-all">
            返回列表
          </Link>
        ) : (
          <button onClick={() => setView("menu")} className="text-emerald-950 text-xs font-black bg-amber-400 px-4 py-2 rounded-xl active:scale-95 transition-all shadow-sm">
            ↩ 返回選單
          </button>
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
        
        {/* ================= 主選單畫面 (image_07cbb4.png 畫面) ================= */}
        {view === "menu" && (
          <div className="grid grid-cols-1 gap-4">
            
            {/* 🌟 新增：頂部登山分組情報標籤板 */}
            <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 text-white p-4 rounded-2xl shadow-sm border border-emerald-800/60 text-left">
              <p className="text-[10px] text-emerald-400 font-black tracking-widest uppercase">Mountaineering Groups</p>
              <h3 className="text-sm font-black text-emerald-100 mt-0.5 mb-2.5">🏔️ 本團現有登山分組</h3>
              <div className="flex flex-wrap gap-1.5">
                {tourGroups.length === 0 ? (
                  <span className="text-xs text-emerald-400 italic font-medium">（後台尚未設定分組資料）</span>
                ) : (
                  tourGroups.map((grp, i) => (
                    <span 
                      key={i} 
                      className="text-xs font-black bg-amber-500 text-stone-950 px-3 py-1 rounded-full shadow-2xs border border-amber-600"
                    >
                      🥾 {grp}
                    </span>
                  ))
                )}
              </div>
            </div>

            <button onClick={() => setView("checkin")} className="flex items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-stone-200 active:scale-[0.98] transition-all hover:border-emerald-300">
              <div className="text-left">
                <h2 className="text-lg font-black text-stone-800">📋 報到與基本資料</h2>
                <p className="text-xs text-stone-500 mt-1">團員聯絡電話、分組、下車點報到</p>
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
                <h2 className="text-lg font-black text-stone-800">🍱 登山口餐點發放</h2>
                <p className="text-xs text-stone-500 mt-1">五合目餐食內容確認與點收</p>
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
                <h2 className="text-lg font-black text-emerald-900">🗝️ 飯店總房表快速對照</h2>
                <p className="text-xs text-emerald-700 mt-1">櫃檯領取鑰匙、一目了然發放房號</p>
              </div>
              <span className="text-xl text-emerald-600 font-bold">➔</span>
            </button>
          </div>
        )}

        {/* ================= 1. 報到資料 ================= */}
        {view === "checkin" && (
          <div className="space-y-4">
            {memberData.map((member, idx) => (
              <div key={idx} className="bg-white border border-stone-200 p-4 rounded-2xl shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-black text-stone-800">{member.姓名}</h3>
                    <p className="text-xs text-stone-500 font-medium mt-1">📱 {member.手機 || "無聯絡電話"}</p>
                  </div>
                  <span className="bg-stone-100 text-stone-600 text-xs px-2.5 py-1 rounded-lg font-bold border border-stone-200">{member.分組 || "未編組"}</span>
                </div>
                {member.病史 && (
                  <div className="bg-red-50 border border-red-100 text-red-700 text-xs p-3 rounded-xl font-bold mb-3">
                    ⚠️ 特殊狀況：{member.病史}
                  </div>
                )}
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex justify-between items-center mt-2">
                  <div>
                    <p className="text-[10px] text-emerald-700 font-black tracking-wide mb-0.5">📍 下車地點</p>
                    <p className="text-sm font-black text-stone-700">{member.下車地點 || "未填寫"}</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-emerald-200 shadow-sm active:scale-95 transition-all">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded text-emerald-700 focus:ring-emerald-600" 
                      checked={member.報到狀態 === "TRUE"} 
                      onChange={(e) => handleMemberStatusChange(idx, "報到狀態", e.target.checked)}
                    />
                    <span className="font-black text-emerald-900 text-sm">已報到</span>
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
                      <p className="text-[10px] text-emerald-800 font-black mb-1 tracking-wider">🎒 租借明細</p>
                      <p className="text-sm font-black text-stone-700 mb-3">{member.裝備明細}</p>
                      <div className="flex gap-2">
                        <label className="flex-1 flex justify-center items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-stone-200 shadow-sm active:scale-95 transition-all cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 text-emerald-700 rounded" 
                            checked={member.裝備借出 === "TRUE"} 
                            onChange={(e) => handleMemberStatusChange(originalIdx, "裝備借出", e.target.checked)}
                          />
                          <span className="font-black text-stone-700 text-xs">已借出</span>
                        </label>
                        <label className="flex-1 flex justify-center items-center gap-2 bg-white px-3 py-2.5 rounded-xl border border-stone-200 shadow-sm active:scale-95 transition-all cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 text-emerald-700 rounded" 
                            checked={member.裝備歸還 === "TRUE"} 
                            onChange={(e) => handleMemberStatusChange(originalIdx, "裝備歸還", e.target.checked)}
                          />
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

        {/* ================= 3. 餐點發放 ================= */}
        {view === "meals" && (
          <div className="space-y-4">
            {memberData.map((member, idx) => (
              <div key={idx} className="bg-white border border-stone-200 p-4 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center border-b border-stone-100 pb-2 mb-3">
                  <h3 className="text-base font-black text-stone-800">{member.姓名}</h3>
                  <span className="text-xs font-bold text-stone-500">{member.分組 || "未編組"}</span>
                </div>
                <div className="bg-orange-50/60 border border-orange-100 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-orange-800 font-black mb-0.5 tracking-wider">🍱 五合目餐食</p>
                    <p className="text-sm font-black text-stone-800">{member.五合目餐點 || "常規餐點"}</p>
                  </div>
                  <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-orange-200 shadow-sm active:scale-95 transition-all cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded text-orange-600 focus:ring-orange-500" 
                      checked={member.餐點領取 === "TRUE"} 
                      onChange={(e) => handleMemberStatusChange(idx, "餐點領取", e.target.checked)}
                    />
                    <span className="font-black text-orange-950 text-xs">已點收</span>
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
                <div key={idx} className="bg-white border border-stone-200 p-4 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-center border-b border-stone-100 pb-3 mb-3">
                    <div>
                      <span className="text-[10px] bg-stone-100 text-stone-600 font-bold px-2 py-1 rounded-md border border-stone-200">
                        入住：{room.入住日期 ? room.入住日期.substring(5) : "當日"}
                      </span>
                      <h3 className="text-base font-black text-stone-800 mt-2">{room.飯店名稱}</h3>
                    </div>
                    <span className="text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">
                      {room.房型}
                    </span>
                  </div>
                  <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 mb-3">
                    <p className="text-[10px] text-stone-400 font-bold mb-1">入住成員名單</p>
                    <p className="text-sm font-black text-stone-700 tracking-wide">
                      {guests.length > 0 ? guests.join(" 、 ") : <span className="text-stone-400 font-normal text-xs">未排定房客</span>}
                    </p>
                  </div>
                  {room.備註 && (
                    <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl font-medium mb-3">
                      💬 備註：{room.備註}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-stone-700 whitespace-nowrap">分配房號：</span>
                    <input
                      type="text"
                      placeholder="填寫實際房號"
                      value={room.實際房號 || ""}
                      onChange={(e) => handleRoomNumberChange(idx, e.target.value)}
                      className="flex-1 min-w-0 border-2 border-stone-300 rounded-xl px-3 py-2 font-black text-stone-800 focus:outline-none focus:border-emerald-600 bg-stone-50 text-sm shadow-inner"
                    />
                    <button
                      onClick={() => saveSingleRoomNumber(idx)}
                      disabled={savingIdx !== null}
                      className="bg-emerald-700 hover:bg-emerald-600 text-white font-black text-xs px-3 py-2.5 rounded-xl shadow-sm active:scale-95 disabled:bg-stone-300 transition-all whitespace-nowrap"
                    >
                      {savingIdx === idx ? "⏳" : "💾 儲存"}
                    </button>
                  </div>
                </div>
              );
            })}
            
            <button 
              onClick={handleSaveAllAndSummary}
              className="w-full mt-6 bg-emerald-700 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-md active:scale-95 transition-all text-center text-sm tracking-wide shadow-emerald-950/20"
            >
              🌲 一鍵同步雲端並看總房表 ➔
            </button>
          </div>
        )}

        {/* ================= 5. 總房表畫面 ================= */}
        {view === "roomSummary" && (
          <div className="space-y-3">
            {roomData.map((room, idx) => {
              const guests = getGuestsList(room);
              return (
                <div key={idx} className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-stone-200">
                  <div className="flex-1">
                    <div className="text-[10px] text-stone-400 font-bold mb-1">
                      {room.入住日期 ? room.入住日期.substring(5) : ""} | {room.飯店名稱}
                    </div>
                    <div className="text-sm font-black text-stone-800">
                      {guests.length > 0 ? guests.join(" 、 ") : <span className="text-slate-400 font-normal text-xs">未排定房客</span>}
                    </div>
                  </div>
                  <div className="ml-4 pl-4 border-l border-stone-200 flex flex-col items-center justify-center min-w-[70px]">
                    <span className="text-[10px] text-stone-400 font-bold mb-0.5">房號</span>
                    <span className={`text-xl font-black ${room.實際房號 ? "text-emerald-700" : "text-stone-300"}`}>
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
