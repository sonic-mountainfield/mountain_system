"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

// 定義畫面的狀態
type ViewState = "menu" | "checkin" | "equipment" | "meals" | "rooms";

export default function TourDashboardPage() {
  const params = useParams();
  const tourId = params.tourId as string;

  const [view, setView] = useState<ViewState>("menu");
  const [loading, setLoading] = useState(true);
  const [memberData, setMemberData] = useState<any[]>([]);
  const [roomData, setRoomData] = useState<any[]>([]);

  const SHEETDB_URL = "https://sheetdb.io/api/v1/ng85gs3977snc";

  useEffect(() => {
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
    if (tourId) fetchData();
  }, [tourId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 font-bold animate-pulse">⏳ 資料載入中...</p>
      </div>
    );
  }

  // 🌟 預先過濾出「有借裝備」的團員
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
            {view === "menu" && "導遊工作台"}
            {view === "checkin" && "📋 報到與基本資料"}
            {view === "equipment" && "🎒 裝備確認單"}
            {view === "meals" && "🍱 登山口餐點"}
            {view === "rooms" && "🏨 飯店排房表"}
          </h1>
        </div>
        
        {view === "menu" ? (
          <Link href="/three-days" className="text-slate-500 text-sm font-bold bg-slate-100 px-4 py-2 rounded-xl active:scale-95 transition-all">
            返回列表
          </Link>
        ) : (
          <button 
            onClick={() => setView("menu")} 
            className="text-white text-sm font-bold bg-slate-800 px-4 py-2 rounded-xl active:scale-95 transition-all"
          >
            ↩ 返回選單
          </button>
        )}
      </div>

      <div className="w-full max-w-md px-4 mt-6">
        
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
          </div>
        )}

        {/* ================= 1. 報到與基本資料畫面 ================= */}
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
                  <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-blue-100 shadow-sm">
                    <input type="checkbox" className="w-5 h-5 rounded text-blue-600" defaultChecked={member.報到狀態 === "TRUE"} />
                    <span className="font-bold text-blue-800">已報到</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================= 2. 裝備確認畫面 ================= */}
        {view === "equipment" && (
          <div className="space-y-4">
            {equipmentMembers.length === 0 ? (
              <p className="text-center text-slate-400 py-10 font-bold">🎉 此團無人需要租借裝備</p>
            ) : (
              equipmentMembers.map((member, idx) => (
                <div key={idx} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
                    <h3 className="text-lg font-bold text-slate-800">{member.姓名}</h3>
                    <span className="text-xs font-bold text-slate-500">{member.分組 || "未編組"}</span>
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                    <p className="text-xs text-emerald-600 font-bold mb-1">🎒 裝備明細</p>
                    <p className="text-sm font-bold text-slate-700 mb-3">{member.裝備明細}</p>
                    <div className="flex gap-2">
                      <label className="flex-1 flex justify-center items-center gap-2 bg-white px-3 py-2 rounded-lg border border-emerald-100 shadow-sm">
                        <input type="checkbox" className="w-5 h-5 rounded text-emerald-600" defaultChecked={member.裝備借出 === "TRUE"} />
                        <span className="font-bold text-emerald-800 text-sm">已借出</span>
                      </label>
                      <label className="flex-1 flex justify-center items-center gap-2 bg-white px-3 py-2 rounded-lg border border-emerald-100 shadow-sm">
                        <input type="checkbox" className="w-5 h-5 rounded text-emerald-600" defaultChecked={member.裝備歸還 === "TRUE"} />
                        <span className="font-bold text-emerald-800 text-sm">已歸還</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ================= 3. 餐點發放畫面 ================= */}
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
                  <label className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-orange-100 shadow-sm">
                    <input type="checkbox" className="w-5 h-5 rounded text-orange-600" defaultChecked={member.餐點領取 === "TRUE"} />
                    <span className="font-bold text-orange-800 text-sm">已領取</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================= 4. 飯店排房畫面 ================= */}
        {view === "rooms" && (
          <div className="space-y-4">
            {roomData.map((room, idx) => (
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
                    {[room.房客1, room.房客2, room.房客3, room.房客4].filter(Boolean).join(" 、 ")}
                  </p>
                </div>
                {room.備註 && (
                  <div className="text-sm bg-amber-50 border border-amber-100 text-amber-800 p-3 rounded-xl font-medium mb-3">
                    💬 {room.備註}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-700 whitespace-nowrap">登記房號：</span>
                  <input
                    type="text"
                    placeholder="導遊輸入房號..."
                    defaultValue={room.實際房號}
                    className="flex-1 min-w-0 border-2 border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 focus:outline-none focus:border-blue-500 bg-white"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
