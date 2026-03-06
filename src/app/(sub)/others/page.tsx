"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase/config";
import { collection, query, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";

interface AnonymousSub {
  id: string;
  age: number;
  height: number;
  weight: number;
  length?: number;
  job: string;
}

export default function OthersPage() {
  const [others, setOthers] = useState<AnonymousSub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ⭐ 인증 상태를 감시하여 현재 사용자의 UID를 확실히 가져옵니다.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchOthers(user.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchOthers = async (currentUid: string) => {
    try {
      const q = query(collection(db, "profiles"));
      const snapshot = await getDocs(q);
      const list = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        // ⭐ 본인(currentUid)을 제외한 다른 SUB들만 필터링합니다.
        .filter(p => p.sub_id !== currentUid) 
        .map(p => ({
          id: p.id,
          age: p.age,
          height: p.height,
          weight: p.weight,
          length: p.length,
          job: p.job || "미입력"
        }));
      setOthers(list);
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    }
    setLoading(false);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white font-bold">다른 SUB들의 데이터를 수거 중...</div>;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black italic tracking-tighter text-red-600">ARENA: OTHERS</h1>
            <p className="text-xs text-gray-400 font-bold mt-1">
              현재 당신을 포함한 <span className="text-white">{others.length + 1}명</span>의 SUB이 명령을 수행 중입니다.
            </p>
          </div>
          <Link href="/my-missions" className="text-[10px] font-black border border-gray-600 px-3 py-1 rounded hover:bg-white hover:text-black transition-all">
            내 미션으로
          </Link>
        </div>

        <div className="grid gap-4">
          {others.length === 0 ? (
            <div className="p-10 text-center bg-gray-800 rounded-xl border border-gray-700 text-gray-500 font-bold">
              아레나에 당신 외에 다른 SUB이 존재하지 않습니다.
            </div>
          ) : (
            others.map((other, index) => (
              <div key={other.id} className="bg-gray-800 p-5 rounded-xl border border-gray-700 shadow-xl transition-transform active:scale-95">
                <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Identify: SUB #{index + 1}</span>
                  <span className="text-[10px] bg-gray-900 px-2 py-0.5 rounded text-gray-400 font-bold">{other.job}</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div><p className="text-[8px] text-gray-500 font-black uppercase mb-1">Age</p><p className="font-bold text-sm">{other.age}</p></div>
                  <div><p className="text-[8px] text-gray-500 font-black uppercase mb-1">Height</p><p className="font-bold text-sm">{other.height}cm</p></div>
                  <div><p className="text-[8px] text-gray-500 font-black uppercase mb-1">Weight</p><p className="font-bold text-sm">{other.weight}kg</p></div>
                  <div><p className="text-[8px] text-gray-500 font-black uppercase mb-1">Spec</p><p className="font-bold text-sm text-red-400">{other.length || '?'}</p></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}