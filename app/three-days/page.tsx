import Link from "next/link";

// 建立一個非同步函式來抓取 Google 表單 (SheetDB) 的資料
async function getTours() {
  const sheetDbUrl = process.env.NEXT_PUBLIC_SHEETDB_URL;
  if (!sheetDbUrl) return [];

  try {
    // 加上 cache: 'no-store' 確保每次重新整理都能抓到最新資料
    const res = await fetch(`${sheetDbUrl}?sheet=3日出團總表`, { cache: "no-store" });
    const data = await res.json();
    
    // 過濾並整理出不重複的「團號」與「出發日期」
    const uniqueTours: { tourId: string; date: string }[] = [];
    const seen = new Set();
    
    data.forEach((row: any) => {
      // 如果有團號，而且這個團號還沒被加入過，就把它加進清單
      if (row.團號 && !seen.has(row.團號)) {
        seen.add(row.團號);
        uniqueTours.push({
          tourId: row.團號,
          date: row.出發日期 || "未定日期"
        });
      }
    });
    
    return uniqueTours;
  } catch (error) {
    console.error("讀取資料失敗:", error);
    return [];
  }
}

export default async function ThreeDaysTourPage() {
  const tours = await getTours();

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-6">
      <div className="w-full max-w-sm mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">選擇三日團</h1>
        <Link href="/" className="text-blue-600 text-sm font-medium hover:underline">
          返回首頁
        </Link>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4">
        {tours.length === 0 ? (
          <p className="text-center text-slate-500 py-10">
            目前沒有出團資料，或是請檢查 API 網址設定。
          </p>
        ) : (
          tours.map((tour) => (
            <Link 
              key={tour.tourId}
              href={`/three-days/${tour.tourId}`}
              className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all active:scale-[0.98] flex justify-between items-center"
            >
              <div>
                <h2 className="text-lg font-bold text-slate-800">{tour.tourId}</h2>
                <p className="text-slate-500 text-sm mt-1">出發日：{tour.date}</p>
              </div>
              <span className="text-slate-400 font-bold">➔</span>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
