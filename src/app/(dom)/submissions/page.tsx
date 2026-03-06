// src/app/(dom)/submissions/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase/config";
import { collection, query, where, getDocs, doc, updateDoc, getDoc, writeBatch } from "firebase/firestore";
import DomNavBar from "@/components/DomNavBar"; // 위에서 만든 컴포넌트 불러오기

interface Submission {
  id: string; // mission_id
  sub_name: string;
  content: string;
  status: string;
  appeal_message?: string;
  media_url?: string;
  message?: string;
}

export default function DomSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubmissions();
    markNotificationsAsRead(); // 페이지 진입 시 알림 모두 읽음 처리
  }, []);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      // 'submitted'(일반제출) 또는 'appealed'(사유서제출) 상태인 미션들 가져오기
      const q = query(collection(db, "missions"), where("status", "in", ["submitted", "appealed"]));
      const snapshot = await getDocs(q);
      
      const list: Submission[] = [];
      for (const mDoc of snapshot.docs) {
        const mData = mDoc.data();
        const subProfile = await getDoc(doc(db, "profiles", mData.sub_id));
        
        // 만약 일반 제출물(submission)이 있다면 해당 데이터도 가져옴
        let subDetail = {};
        if (mData.status === "submitted") {
          const sq = query(collection(db, "submissions"), where("mission_id", "==", mDoc.id));
          const sSnap = await getDocs(sq);
          if (!sSnap.empty) subDetail = sSnap.docs[0].data();
        }

        list.push({
          id: mDoc.id,
          sub_name: subProfile.data()?.name || "알 수 없는 SUB",
          content: mData.content,
          status: mData.status,
          appeal_message: mData.appeal_message,
          ...subDetail
        });
      }
      setSubmissions(list);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const markNotificationsAsRead = async () => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, "notifications"), where("dom_id", "==", user.uid), where("is_read", "==", false));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.update(d.ref, { is_read: true }));
    await batch.commit();
  };

  // ⚖️ 판결 1: 합격 처리
  const handleApprove = async (id: string) => {
    await updateDoc(doc(db, "missions", id), { status: "approved" });
    alert("미션을 승인했습니다.");
    fetchSubmissions();
  };

  // ⚖️ 판결 2: 불합격 (처벌)
  const handleReject = async (id: string) => {
    await updateDoc(doc(db, "missions", id), { status: "rejected" });
    alert("미션을 실패 처리했습니다.");
    fetchSubmissions();
  };

  // ⚖️ 판결 3: 지연 사유 인정 및 시간 연장 (1시간 추가)
  const handleExtend = async (id: string) => {
    const newDeadline = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await updateDoc(doc(db, "missions", id), { 
      status: "pending", // 다시 수행 가능 상태로
      deadline: newDeadline,
      appeal_message: "" // 사유서 초기화
    });
    alert("사유를 인정하여 기한을 1시간 연장했습니다.");
    fetchSubmissions();
  };

  if (loading) return <div className="p-10 text-center font-bold">검토 데이터 로딩 중...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <DomNavBar />

      <div className="mx-auto max-w-5xl">
        <h2 className="mb-6 text-2xl font-black text-gray-800">미션 판결 대기소</h2>

        {submissions.length === 0 ? (
          <div className="rounded-xl bg-white p-20 text-center text-gray-400 border shadow-sm">
            현재 판결을 기다리는 미션이 없습니다.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {submissions.map((s) => (
              <div key={s.id} className={`overflow-hidden rounded-xl border-2 bg-white shadow-lg ${s.status === 'appealed' ? 'border-red-500' : 'border-black'}`}>
                
                {/* 일반 제출물(사진)이 있는 경우 */}
                {s.media_url && (
                  <img src={s.media_url} className="h-64 w-full object-cover" alt="Submission" />
                )}

                <div className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className={`rounded px-2 py-1 text-xs font-black text-white ${s.status === 'appealed' ? 'bg-red-600' : 'bg-black'}`}>
                      {s.status === 'appealed' ? "🚨 지연 사유서 도착" : "✅ 일반 인증 제출"}
                    </span>
                    <span className="font-bold text-gray-900">{s.sub_name}</span>
                  </div>

                  <p className="mb-4 text-sm font-bold text-gray-700">지시: {s.content}</p>

                  {/* 사유서 내용 표시 */}
                  {s.status === 'appealed' && (
                    <div className="mb-6 rounded bg-red-50 p-4 border border-red-200">
                      <p className="text-xs font-bold text-red-600 mb-1">SUB의 변명:</p>
                      <p className="text-sm italic text-gray-800">"{s.appeal_message}"</p>
                    </div>
                  )}

                  {/* 버튼 그룹 */}
                  <div className="flex gap-2">
                    {s.status === 'appealed' ? (
                      <>
                        <button onClick={() => handleExtend(s.id)} className="flex-1 bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 rounded-lg shadow">자비: 1시간 연장</button>
                        <button onClick={() => handleReject(s.id)} className="flex-1 bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 rounded-lg shadow">처벌: 최종 탈락</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleApprove(s.id)} className="flex-1 bg-black py-3 text-sm font-bold text-white hover:bg-gray-800 rounded-lg shadow">합격 승인</button>
                        <button onClick={() => handleReject(s.id)} className="flex-1 border border-red-500 py-3 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg">불합격 처리</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}