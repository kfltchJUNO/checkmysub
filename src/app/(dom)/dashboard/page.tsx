"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc, addDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import DomNavBar from "@/components/DomNavBar";

interface PendingSub {
  id: string;
  username: string;
  created_at: string;
  profile: {
    name: string;
    age: number;
    height: number;
    weight: number;
    length?: number;
    job: string;
    bio: string;
    face_photo_url: string;
    body_photo_url: string;
  };
}

export default function DomDashboardPage() {
  const router = useRouter();
  const [pendingSubs, setPendingSubs] = useState<PendingSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const [selectedSub, setSelectedSub] = useState<PendingSub | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push("/login");
      fetchPendingSubs();
    });
    return () => unsubscribe();
  }, [router]);

  const fetchPendingSubs = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "users"), where("role", "==", "sub"), where("status", "==", "pending"));
      const querySnapshot = await getDocs(q);
      const subsData: PendingSub[] = [];
      for (const userDoc of querySnapshot.docs) {
        const profileDoc = await getDoc(doc(db, "profiles", userDoc.id));
        if (profileDoc.exists()) {
          subsData.push({
            id: userDoc.id,
            username: userDoc.data().username,
            created_at: userDoc.data().created_at,
            profile: profileDoc.data() as PendingSub["profile"],
          });
        }
      }
      setPendingSubs(subsData);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const generateInviteCode = async () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const nums = '0123456789';
    let code = '';
    for(let i=0; i<2; i++) code += letters.charAt(Math.floor(Math.random() * letters.length));
    for(let i=0; i<3; i++) code += nums.charAt(Math.floor(Math.random() * nums.length));
    
    try {
      await addDoc(collection(db, "invite_codes"), {
        code, is_used: false, dom_id: auth.currentUser?.uid, created_at: new Date().toISOString()
      });
      alert(`코드 생성됨: ${code}`);
    } catch (e) { alert("생성 권한이 없습니다."); }
  };

  const handleApprove = async (sub: PendingSub) => {
    if (!confirm(`${sub.profile.name}을 승인합니까?`)) return;
    setActionLoading(sub.id);
    try {
      await updateDoc(doc(db, "users", sub.id), { status: "approved" });
      setPendingSubs(prev => prev.filter(p => p.id !== sub.id));
      setSelectedSub(null);
    } catch (e) { alert("오류 발생"); }
    setActionLoading(null);
  };

  const handleReject = async (sub: PendingSub) => {
    if (!confirm(`${sub.profile.name}의 모든 데이터를 파기합니까?`)) return;
    setActionLoading(sub.id);
    try {
      await deleteDoc(doc(db, "profiles", sub.id));
      await deleteDoc(doc(db, "users", sub.id));
      setPendingSubs(prev => prev.filter(p => p.id !== sub.id));
      setSelectedSub(null);
    } catch (e) { alert("오류 발생"); }
    setActionLoading(null);
  };

  if (loading) return <div className="p-10 text-center font-bold">SUB 데이터 분석 중...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <DomNavBar />

      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between bg-white p-6 rounded-xl shadow-md border-l-4 border-black">
          <div>
            <h2 className="text-lg font-black text-gray-900">초대 코드 발행</h2>
            <p className="text-xs text-gray-600 font-medium">알파벳 2개 + 숫자 3개 조합</p>
          </div>
          <button onClick={generateInviteCode} className="bg-black text-white px-6 py-3 font-bold rounded-lg hover:bg-gray-800 transition-colors">신규 코드 생성</button>
        </div>

        <h2 className="mb-6 text-2xl font-black text-gray-900">가입 대기 목록 ({pendingSubs.length})</h2>

        <div className="grid gap-6 md:grid-cols-3">
          {pendingSubs.map((sub) => (
            <div 
              key={sub.id} 
              onClick={() => setSelectedSub(sub)}
              className="cursor-pointer overflow-hidden rounded-xl bg-white shadow-lg border border-gray-200 hover:scale-[1.02] transition-transform"
            >
              <img src={sub.profile.face_photo_url} className="h-44 w-full object-cover" />
              <div className="p-4 bg-white">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-gray-900">{sub.profile.name}</span>
                  <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded font-black text-gray-600">{sub.profile.job}</span>
                </div>
                <p className="text-xs text-gray-600 line-clamp-1 font-medium">{sub.profile.bio}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ⭐ 상세보기 모달 (가독성 개선 버전) */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-3xl bg-white p-6 md:p-10 shadow-2xl">
            <button 
                onClick={() => setSelectedSub(null)} 
                className="absolute top-5 right-5 text-3xl font-light text-gray-400 hover:text-black transition-colors"
            >
                ✕
            </button>
            
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <div className="w-full md:w-1/2 overflow-hidden rounded-2xl shadow-inner bg-gray-100">
                <img src={selectedSub.profile.face_photo_url} className="w-full object-cover h-72" alt="Face" />
              </div>
              <div className="w-full md:w-1/2 overflow-hidden rounded-2xl shadow-inner bg-gray-100">
                <img src={selectedSub.profile.body_photo_url} className="w-full object-cover h-72" alt="Body" />
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-end border-b-2 border-gray-100 pb-3">
                <h3 className="text-3xl font-black text-gray-900 tracking-tight">{selectedSub.profile.name}</h3>
                <span className="text-sm text-gray-500 font-bold bg-gray-100 px-3 py-1 rounded-full">{selectedSub.username}</span>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-black mb-1 tracking-widest uppercase">Age</p>
                    <p className="text-xl font-black text-gray-900">{selectedSub.profile.age}<span className="text-sm ml-0.5">세</span></p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-black mb-1 tracking-widest uppercase">Height</p>
                    <p className="text-xl font-black text-gray-900">{selectedSub.profile.height}<span className="text-sm ml-0.5">cm</span></p>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-black mb-1 tracking-widest uppercase">Weight</p>
                    <p className="text-xl font-black text-gray-900">{selectedSub.profile.weight}<span className="text-sm ml-0.5">kg</span></p>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-2 mb-3">
                    <div className="h-4 w-1 bg-blue-600 rounded-full"></div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Job & Bio</p>
                </div>
                <p className="text-lg font-black text-blue-700 mb-3">{selectedSub.profile.job}</p>
                <p className="text-base leading-relaxed text-gray-800 font-medium whitespace-pre-wrap">
                    {selectedSub.profile.bio}
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => handleReject(selectedSub)}
                  disabled={!!actionLoading}
                  className="flex-1 rounded-2xl border-2 border-red-100 py-4 font-black text-red-500 hover:bg-red-50 hover:border-red-200 transition-all active:scale-95"
                >
                  거절 및 파기
                </button>
                <button 
                  onClick={() => handleApprove(selectedSub)}
                  disabled={!!actionLoading}
                  className="flex-[2] rounded-2xl bg-black py-4 font-black text-white hover:bg-gray-800 shadow-xl transition-all active:scale-95"
                >
                  최종 승인하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}