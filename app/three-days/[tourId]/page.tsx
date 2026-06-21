"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function TourDashboardPage() {
  const params = useParams();
  const tourId = params.tourId as string;

  const [activeTab, setActiveTab] = useState<"status" | "rooms">("status");
  const [loading, setLoading] = useState(true);
  const [memberData, setMemberData] = useState<any[]>([]);
  const [roomData, setRoomData] = useState<any[]>([]);

  // 直接寫入資料庫網址
  const SHEETDB_URL = "https://sheetdb.io/api/v1/ng85gs3977snc";

  // 同步抓取這兩個工作表的資料
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // 抓取總表
        const resMembers = await fetch(`${SHEETDB_URL}?sheet=3日出團總表`, { cache: "no-store" });
        const allMembers = await resMembers.json();
        const filteredMembers = Array.isArray(allMembers) ? allMembers.filter((m: any) => m.團號 === tourId) : [];
        setMemberData(filteredMembers);

        // 抓取房表
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
        <p className="text-slate-500 font-medium">⏳ 資料載入中，請稍候...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center pb-12">
      {/* 頂部導覽列 */}
      <div className="w-full bg-white border-b border-slate-200 py-4 px-6 sticky top-0 z-10 flex items-center justify-between shadow-sm">
        <div>
          <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">3日行程</span>
          <h1 className="text-xl font-bold text-slate-800 mt-0.5">團號：{tourId}</h1>
        </div>
        <Link href="/three-days" className="text-slate-500 text-sm hover:underline font-bold bg-slate-100 px-3 py-1.5 rounded-lg">
          返回列表
        </Link>
      </div>

      {/* 功能切換頁籤 */}
      <div className="w-full max-w-md mt-4 px-4 flex gap-2">
        <button
          onClick={() => setActiveTab("status")}
          className={`flex-1 py-3 rounded-xl font-bold transition-all shadow-sm ${
            activeTab === "status"
              ? "bg-slate-800 text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
          }`}
        >
          📋 團員交團表
        </button>
        <button
          onClick={() => setActiveTab("rooms")}
          className={`flex-1 py-3 rounded-xl font-bold transition-all shadow-sm ${
            activeTab === "rooms"
              ? "bg-slate-800 text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
          }`}
        >
          🏨 飯店排房表
        </button>
      </div>

      {/* 頁面內容區 */}
      <div className="w-full max-w-md px-4 mt-4">
        {activeTab === "status" ? (
          /* =========================================
             頁籤一：團員交團表 (涵蓋您的需求 1, 3, 4, 5)
             ========================================= */
          <div className="space-y-4">
            {memberData.length === 0 ? (
              <p className="text-center text-slate-400 py-10 font-medium">此團目前沒有團員資料</p>
            ) : (
              memberData.map((member, idx) => (
                <div key={idx} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-4">
                  
                  {/* 需求 5: 客戶基本資料 */}
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">{member.姓名}</h3>
                      <p className="text-sm text-slate-500 mt-1">📱 {member.手機 || "無聯絡電話"}</p>
                    </div>
                    <span className="bg-slate-100 text-slate-600 text-sm px-3 py-1 rounded-lg font-bold">
                      {member.分組 || "未編組"}
                    </span>
                  </div>

                  {/* 病史警告 */}
                  {member.病史 && (
                    <div className="bg-red-50 border border-red-100 text-red-700 text-sm p-3 rounded-xl font-bold">
                      ⚠️ 特殊狀況：{member.病史}
                    </div>
                  )}

                  {/* 需求 1: 下車地點與報到 */}
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-blue-600 font-bold mb-0.5">📍 下車地點</p>
                      <p className="text-sm font-bold text-slate-700">{member.下車地點 || "未填寫"}</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm active:scale-95 transition-all">
                      <input type="checkbox" className="w-5 h-5 rounded text-blue-600" defaultChecked={member.報到狀態 === "TRUE"} />
                      <span className="font-bold text-blue-800 text-sm">已報到</span>
                    </label>
                  </div>

                  {/* 需求 4: 登山口餐點確認單 */}
                  <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-orange-600 font-bold mb-0.5">🍱 登山口餐點</p>
                      <p className="text-sm font-bold text-slate-700">{member.五合目餐點 || "無"}</p>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-orange-100 shadow-sm active:scale-95 transition-all">
                      <input type="checkbox" className="w-5 h-5 rounded text-orange-600" defaultChecked={member.餐點領取 === "TRUE"} />
                      <span className="font-bold text-orange-800 text-sm">已領取</span>
                    </label>
                  </div>

                  {/* 需求 3: 裝備確認單 */}
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 space-y-3">
                    <div>
                      <p className="text-xs text-emerald-600 font-bold mb-0.5">🎒 裝備明細</p>
                      <p className="text-sm font-bold text-slate-700">{member.裝備明細 || "無租借裝備"}</p>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-emerald-200/50">
                      <label className="flex-1 flex justify-center items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-emerald-100 shadow-sm active:scale-95 transition-all">
                        <input type="checkbox" className="w-5 h-5 rounded text-emerald-600" defaultChecked={member.裝備借出 === "TRUE"} />
                        <span className="font-bold text-emerald-800 text-sm">已借出</span>
                      </label>
                      <label className="flex-1 flex justify-center items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg border border-emerald-100 shadow-sm active:scale-95 transition-all">
                        <input type="checkbox" className="w-5 h-5 rounded text-emerald-600" defaultChecked={member.裝備歸還 === "TRUE"} />
                        <span className="font-bold text-emerald-800 text-sm">已歸還</span>
                      </label>
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>
        ) : (
          /* =========================================
             頁籤二：飯店排房表 (涵蓋您的需求 2)
             ========================================= */
          <div className="space-y-4">
            {roomData.length === 0 ? (
              <p className="text-center text-slate-400 py-10 font-medium">此團目前沒有排房資料</p>
            ) : (
              roomData.map((room, idx) => (
                <div key={idx} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
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

                  {/* 房客名單 */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-400 font-bold mb-1">入住名單</p>
                    <p className="text-base font-bold text-slate-700">
                      {[room.房客1, room.房客2, room.房客3, room.房客4].filter(Boolean).join(" 、 ")}
                    </p>
                  </div>

                  {/* 備註 */}
                  {room.備註 && (
                    <div className="text-sm bg-amber-50 border border-amber-100 text-amber-800 p-3 rounded-xl font-medium">
                      💬 {room.備註}
                    </div>
                  )}

                  {/* 導遊填寫實際房號 */}
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-sm font-bold text-slate-700 whitespace-nowrap">登記房號：</span>
                    <input
                      type="text"
                      placeholder="導遊輸入房號..."
                      defaultValue={room.實際房號}
                      className="flex-1 min-w-0 border-2 border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all bg-white"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}
