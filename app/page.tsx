import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center py-16 px-6">
      <div className="w-full max-w-sm mb-12 text-center">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">岳野登山公司</h1>
        <p className="text-slate-500">領隊交團資料系統</p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-5">
        <Link 
          href="/three-days"
          className="flex items-center justify-between bg-blue-600 text-white p-6 rounded-2xl shadow-sm hover:bg-blue-700 hover:shadow-md transition-all active:scale-[0.98]"
        >
          <div>
            <h2 className="text-xl font-bold">富士山 三日團</h2>
            <p className="text-blue-100 text-sm mt-1">裝備 / 餐點 / 排房表</p>
          </div>
          <span className="text-2xl">🗻</span>
        </Link>

        <Link 
          href="/five-days"
          className="flex items-center justify-between bg-emerald-600 text-white p-6 rounded-2xl shadow-sm hover:bg-emerald-700 hover:shadow-md transition-all active:scale-[0.98]"
        >
          <div>
            <h2 className="text-xl font-bold">富士山 五日團</h2>
            <p className="text-emerald-100 text-sm mt-1">含機場接送與單車</p>
          </div>
          <span className="text-2xl">🏔️</span>
        </Link>

        <Link 
          href="/other"
          className="flex items-center justify-between bg-slate-700 text-white p-6 rounded-2xl shadow-sm hover:bg-slate-800 hover:shadow-md transition-all active:scale-[0.98]"
        >
          <div>
            <h2 className="text-xl font-bold">日本其他行程</h2>
            <p className="text-slate-300 text-sm mt-1">一般常規行程</p>
          </div>
          <span className="text-2xl">🗾</span>
        </Link>
      </div>
    </main>
  );
}
