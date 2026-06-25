"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TourGroup {
  id: string;
  date: string;
  guides: string[];
}

export default function FiveDaysListPage() {
  const [tours, setTours] = useState<TourGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserName, setCurrentUserName] = useState("");

  const SHEETDB_URL = "https://sheetdb.io/api/v1/ng85gs3977snc";

  useEffect(() => {
    // 讀取當前登入的嚮導姓名，用來做主客場高亮防呆
    const savedName = localStorage.getItem("yuenor_user_name") || "";
    setCurrentUserName(savedName);

    async function fetchTours() {
      try {
        const res = await fetch(`${SHEETDB_URL}?sheet=5日出團總表`, { cache: "no-store" });
        const data = await res.json();
        
        if (Array.isArray(data)) {
          const tourMap = new Map<string, TourGroup>();
          
          // 自動從巨量名單中提煉出不重複的「團號」、「出發日期」與「負責嚮導」
          data.forEach((row: any) => {
            const tId = row.團號 ? String(row.團號).trim() : "";
            if (!tId) return;
            
            if (!tourMap.has(tId)) {
              const g1 = row.負責嚮導1 ? String(row.負責嚮導1).trim() : "";
              const g2 = row.負責嚮導2 ? String(row.負責嚮導2).trim() : "";
              const g3 = row.負責嚮導3 ? String(row.負責嚮導3).trim() : "";
              const guides = [g1, g2, g3].filter(Boolean);
              
              tourMap.set(tId, {
                id: tId,
                date: row.出發日期 || "未填寫",
                guides: guides
              });
            }
          });
          
          // 依照出發日期排序
          const tourList = Array.from(tourMap.values()).sort((a, b) => a.date.localeCompare(b.date));
          setTours(tourList);
        }
      } catch (error) {
        console.error("無法載入5日團列表", error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchTours();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-sky-400 font-bold animate-pulse">🌊 TAKENO 五日團航線載入中...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center pb-12">
      {/* 頂部導覽列 */}
      <div className="w-full bg-slate-900 text-white py-4 px-6 sticky top-0 z-10 flex justify-between items-center shadow-lg border-b border-sky-900/50">
        <div>
          <span className="text-[10px] font-black text-sky-400 tracking-widest uppercase">TAKENO EXPEDITION</span>
          <h1 className="text-base font-black text-slate-50 mt-0.5 flex items-center gap-2">
            <span className="text-lg">👤</span> {currentUserName || "未知名"} <span className="text-xs text-sky-500 font-bold">嚮導</span>
          </h1>
        </div>
        <Link href="/" className="text-sky-100 text-xs font-bold bg-sky-900/60 border border-sky-800 px-4 py-2 rounded-xl active:scale-95 transition-all">
          ↩ 系統首頁
        </Link>
      </div>

      <div className="w-full max-w-md px-4 mt-6">
        <div className="flex items-center gap-2 mb-4 pl-1">
          <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
          <h2 className="text-sm font-black text-slate-600">富士山五日團・全航線總表</h2>
        </div>

        {tours.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-slate-400 text-sm font-bold">目前雲端尚未建立任何五日團資料</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tours.map((tour) => {
              // 判斷當前登入者是否為該團的主力嚮導 (主客場防呆視覺化)
              const isMyTour = currentUserName && tour.guides.includes(currentUserName);
              
              return (
                <Link key={tour.id} href={`/five-days/${encodeURIComponent(tour.id)}`} className="block">
                  <div className={`bg-white rounded-3xl p-5 transition-all active:scale-[0.98] ${
                    isMyTour 
                      ? "border-2 border-sky-400 shadow-md ring-4 ring-sky-50" 
                      : "border border-slate-200 shadow-sm hover:border-sky-200"
                  }`}>
                    
                    <div className="flex justify-between items-start mb-3">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${
                        isMyTour ? "bg-sky-500 text-white shadow-sm" : "bg-slate-100 text-slate-500"
                      }`}>
                        {isMyTour ? "⚓ 我的專屬主場" : "⚓ 協同夥伴團"}
                      </span>
                    </div>

                    <h3 className={`text-3xl font-black tracking-tight mb-2 ${isMyTour ? "text-sky-950" : "text-slate-800"}`}>
                      團號：{tour.id}
                    </h3>
                    
                    <p className="text-sm font-bold text-slate-500 flex items-center gap-2 mb-4">
                      <span>🗓️ 出發航程：</span>
                      <span className="text-slate-700">{tour.date}</span>
                    </p>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400">隨船夥伴:</span>
                        <div className="flex gap-1">
                          {tour.guides.length > 0 ? tour.guides.map((guide, idx) => (
                            <span key={idx} className={`text-[10px] font-black px-2 py-1 rounded-full border ${
                              guide === currentUserName ? "bg-sky-100 border-sky-200 text-sky-700" : "bg-slate-50 border-slate-200 text-slate-600"
                            }`}>
                              {guide}
                            </span>
                          )) : (
                            <span className="text-[10px] font-bold text-slate-300">尚未指派</span>
                          )}
                        </div>
                      </div>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isMyTour ? "bg-sky-100 text-sky-600" : "bg-slate-50 text-slate-400"}`}>
                        ➔
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
