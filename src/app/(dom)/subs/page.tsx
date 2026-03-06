"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface SubStats {
  id: string;
  username: string;
  name: string;
  face_photo_url: string;
  // ⭐ 모달용 상세 데이터 추가
  profile: {
    age: number;
    height: number;
    weight: number;
    length?: number;
    job: string;
    bio: string;
    body_photo_url: string;
  };
  stats: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    rate: number;
  };
  tier: "S" | "A" | "B" | "F" | "NEW";
}

export default function DomSubsPage() {
  const router = useRouter();
  const [subs, setSubs] = useState<SubStats[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ⭐ 상세 정보 모달 상태
  const [selectedSub, setSelectedSub] = useState<SubStats | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push("/login");

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists() || userDoc.data().role !== "dom") {
        alert("접근 권한이 없습니다.");
        return router.push("/login");
      }

      fetchSubsData();
    });
    return () => unsubscribe();
  }, [router]);

  const fetchSubsData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "users"), where("role", "==", "sub"), where("status", "==", "approved"));
      const userSnapshot = await getDocs(q);
      const subsData: SubStats[] = [];

      for (const userDoc of userSnapshot.docs) {
        const profileDoc = await getDoc(doc(db, "profiles", userDoc.id));
        const p = profileDoc.exists() ? profileDoc.data() : {};
        
        const mq = query(collection(db, "missions"), where("sub_id", "==", userDoc.id));
        const missionSnapshot = await getDocs(mq);
        
        let total = 0, approved = 0, rejected = 0, pending = 0;
        missionSnapshot.forEach((mDoc) => {
          total++;
          const status = mDoc.data().status;
          if (status === "approved") approved++;
          else if (status === "rejected") rejected++;
          else pending++;
        });

        const rate = total === 0 ? 0 : Math.round((approved / total) * 100);
        let tier: SubStats["tier"] = "NEW";
        if (total > 0) {
          if (rate >= 90) tier = "S";
          else if (rate >= 70) tier = "A";
          else if (rate >= 50) tier = "B";
          else tier = "F";
        }

        subsData.push({
          id: userDoc.id,
          username: userDoc.data().username,
          name: p.name || "이름 없음",
          face_photo_url: p.face_photo_url || "",
          profile: {
            age: p.age || 0,
            height: p.height || 0,
            weight: p.weight || 0,
            length: p.length || 0,
            job: p.job || "미입력",
            bio: p.bio || "",
            body_photo_url: p.body_photo_url || "",
          },
          stats: { total, approved, rejected, pending, rate },
          tier,
        });
      }

      subsData.sort((a, b) => b.stats.rate - a.stats.rate);
      setSubs(subsData);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const getTierStyle = (tier: string) => {
    switch (tier) {
      case "S": return { border: "border-yellow-400", bg: "bg-yellow-50", badge: "🥇 S급 (최우수)", text: "text-yellow-700" };
      case "A": return { border: "border-gray-300", bg: "bg-gray-50", badge: "🥈 A급 (우수)", text: "text-gray-700" };
      case "B": return { border: "border-orange-300", bg: "bg-orange-50", badge: "🥉 B급 (보통)", text: "text-orange-700" };
      case "F": return { border: "border-red-500", bg: "bg-red-50", badge: "🚨 F급 (위험군)", text: "text-red-700" };
      default: return { border: "border-blue-200", bg: "bg-blue-50", badge: "🌱 신규 (미션 없음)", text: "text-blue-700" };
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center font-black text-gray-900">데이터 로드 중...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto mb-6 flex max-w-5xl items-center justify-between rounded-lg bg-black px-6 py-4 text-white shadow-md">
        <h1 className="text-xl font-bold uppercase tracking-tighter">Subordinates Stats</h1>
        <Link href="/dashboard" className="text-sm font-bold text-gray-400 hover:text-white transition-colors">
          ← Dashboard
        </Link>
      </div>

      <div className="mx-auto max-w-5xl">
        {subs.length === 0 ? (
          <div className="rounded-xl border bg-white p-12 text-center text-gray-400 font-bold">승인된 SUB이 없습니다.</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {subs.map((sub) => {
              const style = getTierStyle(sub.tier);
              return (
                <div key={sub.id} className={`flex flex-col overflow-hidden rounded-2xl border-2 shadow-lg transition-all ${style.border} ${style.bg}`}>
                  
                  {/* 상단: 사진 클릭 시 모달 오픈 */}
                  <div className="flex items-center gap-4 p-5 border-b border-white/50">
                    <div 
                      className="relative cursor-pointer group"
                      onClick={() => setSelectedSub(sub)}
                    >
                      <img 
                        src={sub.face_photo_url} 
                        className={`h-16 w-16 rounded-full object-cover border-2 shadow-sm transition-transform group-hover:scale-110 ${style.border}`}
                        alt="Profile"
                      />
                      <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[8px] text-white font-black uppercase">Detail</span>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-gray-900">{sub.name}</h3>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{sub.profile.job}</p>
                    </div>
                    <div className="ml-auto">
                      <span className={`rounded-full bg-white px-3 py-1 text-[10px] font-black shadow-sm ${style.text}`}>
                        {style.badge}
                      </span>
                    </div>
                  </div>

                  {/* 중단: 통계 */}
                  <div className="p-5 flex-1 bg-white/30">
                    <div className="mb-4 flex items-end justify-between">
                      <span className="text-xs font-black text-gray-500 uppercase">Success Rate</span>
                      <span className={`text-2xl font-black ${style.text}`}>{sub.stats.rate}%</span>
                    </div>
                    <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                      <div className={`h-full ${sub.tier === 'F' ? 'bg-red-500' : 'bg-black'} transition-all duration-1000`} style={{ width: `${sub.stats.rate}%` }}></div>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-center">
                        {[{l:'TOTAL', v:sub.stats.total, c:'text-gray-900'}, {l:'ING', v:sub.stats.pending, c:'text-blue-600'}, {l:'PASS', v:sub.stats.approved, c:'text-green-600'}, {l:'FAIL', v:sub.stats.rejected, c:'text-red-600'}].map((stat, i) => (
                            <div key={i} className="bg-white/60 p-2 rounded-lg border border-white">
                                <p className="text-[8px] font-black text-gray-400 mb-0.5">{stat.l}</p>
                                <p className={`text-xs font-black ${stat.c}`}>{stat.v}</p>
                            </div>
                        ))}
                    </div>
                  </div>

                  {/* 하단: 액션 */}
                  <div className="flex border-t border-white/50 bg-white/20">
                    <button className="flex-1 py-3 text-[10px] font-black text-gray-400 hover:bg-black hover:text-white transition-all uppercase">Warning</button>
                    <Link href={`/subs/${sub.id}`} className="flex-1 py-3 text-[10px] font-black text-center border-l border-white/50 hover:bg-white transition-all uppercase">History →</Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ⭐ 상세보기 고대비 모달 */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="relative w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-3xl bg-white p-6 md:p-10 shadow-2xl border border-gray-100">
            <button 
                onClick={() => setSelectedSub(null)} 
                className="absolute top-5 right-5 text-3xl font-light text-gray-300 hover:text-black transition-colors"
            >
                ✕
            </button>
            
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <div className="w-full md:w-1/2 overflow-hidden rounded-2xl border-2 border-gray-100">
                <img src={selectedSub.face_photo_url} className="w-full object-cover h-80" alt="Face" />
                <p className="text-center text-[10px] font-black py-2 bg-gray-50 text-gray-400 uppercase tracking-widest">Face Identity</p>
              </div>
              <div className="w-full md:w-1/2 overflow-hidden rounded-2xl border-2 border-gray-100">
                <img src={selectedSub.profile.body_photo_url} className="w-full object-cover h-80" alt="Body" />
                <p className="text-center text-[10px] font-black py-2 bg-gray-50 text-gray-400 uppercase tracking-widest">Body Spec</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-end border-b-4 border-black pb-3">
                <h3 className="text-4xl font-black text-gray-900 tracking-tighter italic">{selectedSub.name}</h3>
                <span className="text-xs text-white font-black bg-black px-3 py-1 rounded-sm uppercase tracking-wider">{selectedSub.username}</span>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                {[ {l:'AGE', v:selectedSub.profile.age+'세'}, {l:'HEIGHT', v:selectedSub.profile.height+'cm'}, {l:'WEIGHT', v:selectedSub.profile.weight+'kg'} ].map((item, i) => (
                    <div key={i} className="bg-gray-100 p-4 rounded-2xl border-b-4 border-gray-300">
                        <p className="text-[10px] text-gray-500 font-black mb-1 uppercase tracking-widest">{item.l}</p>
                        <p className="text-2xl font-black text-gray-900">{item.v}</p>
                    </div>
                ))}
              </div>

              <div className="bg-gray-50 p-6 rounded-2xl border-2 border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Job & Biography</p>
                <p className="text-xl font-black text-blue-600 mb-3 underline decoration-4 underline-offset-4">{selectedSub.profile.job}</p>
                <p className="text-base leading-relaxed text-gray-900 font-bold whitespace-pre-wrap">
                    {selectedSub.profile.bio}
                </p>
              </div>

              <button 
                onClick={() => setSelectedSub(null)}
                className="w-full rounded-2xl bg-black py-5 font-black text-white shadow-xl hover:bg-gray-800 transition-all uppercase tracking-widest"
              >
                Close Subordinate Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}