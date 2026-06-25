"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TourCard = {
  tourId: string;
  date: string;
  guides: string[];
};

export default function ThreeDaysTourPage() {
  const [tours, setTours] = useState<TourCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [guideName, setGuideName] = useState("");

  const SHEETDB_URL = "https://sheetdb.io/api/v1/ng85gs3977snc";

  useEffect(() => {
    const savedName = localStorage.getItem("yuenor_user_name") || "嚮導";
    setGuideName(savedName);

    async function fetchAllTours() {
      try {
        setLoading(true);
        const res = await fetch(`${SHEETDB_URL}?sheet=3日出團總表`, { cache: "no-store" });
        const data = await res.json();
        
        if (Array.isArray(data)) {
          const uniqueTours: TourCard[] = [];
          const seen = new Set();
          
          data.forEach((row: any) => {
            if (row.團號 && !seen.has(row.團號)) {
              seen.add(row.團號);
              
              const guide1 = String(row.負責嚮導1 || row["負責嚮導 1"] || "").trim();
              const guide2 = String(row.負責嚮導2 || row["負責嚮導 2"] || "").trim();
              const guide3 = String(row.負責嚮導3 || row["負責嚮導 3"] || "").trim();
              
              const guidesList = [guide1, guide2, guide3].filter(
                g => g !== "" && g !== "undefined" && g !== "null"
              );

              uniqueTours.push({
                tourId: row.團號,
                date: row.出發日期 || "未定日期",
                guides: guidesList
              });
            }
          });
          
          setTours(uniqueTours);
        }
      } catch (error) {
        console.error("讀取專屬出團資料失敗:", error);
      } finally {
        // 🌟 修正：這裡換回正式的 finally 關鍵字，排除編譯錯誤！
        setLoading(false);
      }
    }

    fetchAllTours();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-sky-950 flex flex-col items-center justify-center">
        <span className="text-4xl animate-bounce">🌊</span>
        <p className="text-sky-300 font-extrabold tracking-wider mt-4 animate-pulse">岳野航海誌・出團總表載入中...</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-100 to-sky-100/60 flex flex-col items-center py-10 px-6 relative overflow-hidden">
      {/* 背景隱約的裝飾 */}
      <div className="absolute -top-20 -left-20 text-[12rem] opacity-5 select-none pointer-events-none">⚓</div>
      <div className="absolute -bottom-20 -right-20 text-[12rem] opacity-5 select-none pointer-events-none">🌊</div>
      
      {/* 大海系深藍頂欄 */}
      <div className="w-full max-w-md mb-6 bg-gradient-to-r from-sky-950 to-slate-900 p-5 rounded-3xl shadow-xl shadow-sky-950/20 border border-sky-900 text-white flex justify-between items-center">
        <div>
          <p className="text-[10px] text-sky-400 font-black tracking-widest uppercase">TAKENO Expedition</p>
          <h1 className="text-xl font-black text-sky-50 mt-0.5 flex items-center gap-1.5">
            <span>👤</span> {guideName} <span className="text-xs font-bold text-sky-300">嚮導</span>
          </h1>
        </div>
        <Link href="/" className="text-xs font-black bg-sky-900/60 hover:bg-sky-800 text-sky-200 px-3 py-2 rounded-xl border border-sky-800/80 transition-all active:scale-95">
          ↩ 系統首頁
        </Link>
      </div>

      <div className="w-full max-w-md mb-4 flex items-center gap-2 pl-1">
        <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">富士山三日團・全航線總表</p>
      </div>

      {/* 梯次清單區 */}
      <div className="w-full max-w-md flex flex-col gap-4">
        {tours.length === 0 ? (
          <div className="bg-white border border-slate-200 p-10 rounded-3xl text-center shadow-md">
            <span className="text-4xl">🧭</span>
            <p className="text-slate-700 font-black text-sm mt-3">當前海域晴空萬里</p>
            <p className="text-slate-400 text-xs mt-1">試算表內尚未建立出團梯次資料。</p>
          </div>
        ) : (
          tours.map((tour) => {
            const isMyTour = tour.guides.includes(guideName);

            return (
              <Link 
                key={tour.tourId}
                href={`/three-days/${tour.tourId}`}
                className={`bg-white p-5 rounded-3xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-[0.98] flex justify-between items-center group border-2 ${
                  isMyTour 
                    ? "border-sky-600/40 bg-gradient-to-br from-white to-sky-50/20" 
                    : "border-slate-200/80" 
                }`}
              >
                <div className="flex-1 pr-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      isMyTour 
                        ? "bg-sky-100 text-sky-800 border-sky-200" 
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    }`}>
                      {isMyTour ? "🐳 您的掌舵團" : "⚓ 協同夥伴團"}
                    </span>
                  </div>
                  
                  <h2 className="text-2xl font-black text-slate-800 mt-2.5 group-hover:text-sky-800 transition-colors tracking-tight">
                    團號：{tour.tourId}
                  </h2>
                  
                  <p className="text-slate-500 text-xs mt-1.5 font-bold flex items-center gap-1">
                    <span>📅</span> 出發航程：<span className="text-slate-700">{tour.date}</span>
                  </p>
                  
                  {/* 大海膠囊風 嚮導標籤 */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] font-black text-slate-400 tracking-wider mr-1">隨船夥伴:</span>
                    {tour.guides.length === 0 ? (
                      <span className="text-xs text-slate-400 font-medium italic">（未分派成員）</span>
                    ) : (
                      tour.guides.map((guide, i) => (
                        <span 
                          key={i} 
                          className={`text-xs font-black px-3 py-1 rounded-full border shadow-2xs transition-colors ${
                            guide === guideName 
                              ? "bg-sky-800 text-white border-sky-900" 
                              : "bg-slate-50 text-slate-600 border-slate-200/80 group-hover:bg-sky-50/50" 
                          }`}
                        >
                          {guide}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                
                {/* 右側海洋箭頭指標 */}
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:bg-sky-800 group-hover:border-sky-900 transition-all flex-shrink-0 ml-2 shadow-2xs">
                  <span className="text-sky-800 font-black text-sm group-hover:text-white group-hover:translate-x-0.5 transition-all">➔</span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}
