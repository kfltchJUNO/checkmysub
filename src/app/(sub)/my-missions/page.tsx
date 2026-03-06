"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Mission {
  id: string;
  content: string;
  deadline: string;
  status: string;
  scheduled_at: string | null;
  require_live_camera: boolean;
}

export default function SubMyMissionsPage() {
  const router = useRouter();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push("/login");
      fetchMyMissions(user.uid);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchMyMissions = async (uid: string) => {
    try {
      const q = query(collection(db, "missions"), where("sub_id", "==", uid));
      const querySnapshot = await getDocs(q);
      
      const now = new Date();
      const missionsData = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Mission))
        .filter(m => !m.scheduled_at || new Date(m.scheduled_at) <= now)
        .sort((a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime());
      
      setMissions(missionsData);
    } catch (error) { 
      console.error(error); 
    }
    setLoading(false);
  };

  // ⭐ 로그아웃 핸들러
  const handleLogout = async () => {
    if (confirm("시스템에서 로그아웃 하시겠습니까?")) {
      await signOut(auth);
      router.push("/login");
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center font-bold text-gray-900">미션 데이터 동기화 중...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 상단 네비게이션 바 */}
      <div className="mx-auto mb-6 flex max-w-2xl items-center justify-between rounded-xl bg-black px-6 py-4 text-white shadow-2xl">
        <h1 className="text-xl font-black uppercase italic tracking-tighter">My Mission</h1>
        <div className="flex items-center gap-3">
          {/* ⭐ 버튼 명칭 변경: 아레나 -> Sub목록 */}
          <Link href="/others" className="text-[10px] font-black bg-red-600 text-white px-4 py-2 rounded-full hover:bg-red-700 transition-all shadow-lg active:scale-95">
            Sub목록 🏟️
          </Link>
          
          {/* ⭐ 로그아웃 버튼 추가 */}
          <button 
            onClick={handleLogout}
            className="text-[10px] font-black bg-gray-800 text-gray-300 px-4 py-2 rounded-full hover:bg-white hover:text-black transition-all border border-gray-700"
          >
            LOGOUT
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl flex flex-col gap-4">
        {missions.length === 0 ? (
          <div className="p-10 text-center bg-white rounded-xl border-2 border-dashed border-gray-200 text-gray-400 font-bold">
            현재 하달된 명령이 없습니다. 대기하십시오.
          </div>
        ) : (
          missions.map((m) => (
            <Link href={`/my-missions/${m.id}`} key={m.id}>
              <div className={`p-5 rounded-2xl border bg-white shadow-sm hover:border-black transition-all group ${m.status === 'pending' ? 'border-l-8 border-l-red-500' : 'border-l-8 border-l-gray-300'}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[10px] font-black px-2 py-1 rounded shadow-sm ${m.status === 'pending' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {m.status.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-gray-400 font-black uppercase">
                    Deadline: {new Date(m.deadline).toLocaleString('ko-KR', { hour12: false })}
                  </span>
                </div>
                <p className="font-black text-gray-900 text-lg group-hover:text-red-600 transition-colors leading-tight">
                  {m.content}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}