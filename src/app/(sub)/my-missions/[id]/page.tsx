// src/app/(sub)/my-missions/[id]/page.tsx
"use client";

import { useEffect, useState, use } from "react";
import { auth, db, storage } from "@/lib/firebase/config";
import { doc, getDoc, addDoc, collection, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface MissionDetail {
  id: string;
  content: string;
  deadline: string;
  status: string; // pending, submitted, approved, rejected, appealed
  require_live_camera: boolean;
  dom_id: string;
  appeal_message?: string; // 지연 사유서 내용
}

export default function SubMissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const missionId = resolvedParams.id;

  const [mission, setMission] = useState<MissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 일반 제출 폼
  const [message, setMessage] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  // 지연 사유서(Appeal) 폼
  const [appealText, setAppealText] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push("/login");
      fetchMissionDetail(user.uid);
    });
    return () => unsubscribe();
  }, [router, missionId]);

  const fetchMissionDetail = async (uid: string) => {
    try {
      const docRef = doc(db, "missions", missionId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists() && docSnap.data().sub_id === uid) {
        setMission({ id: docSnap.id, ...docSnap.data() } as MissionDetail);
      } else {
        alert("잘못된 접근입니다.");
        router.push("/my-missions");
      }
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  // 1. 정상 미션 제출 로직
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photo) return alert("인증 사진을 반드시 촬영해야 합니다.");
    setSubmitting(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("로그인 필요");

      const photoRef = ref(storage, `sub_media/${user.uid}/missions/${missionId}_${Date.now()}`);
      await uploadBytes(photoRef, photo);
      const mediaUrl = await getDownloadURL(photoRef);

      await addDoc(collection(db, "submissions"), {
        mission_id: missionId,
        sub_id: user.uid,
        message: message,
        media_url: mediaUrl,
        media_type: "image",
        created_at: new Date().toISOString(),
      });

      await updateDoc(doc(db, "missions", missionId), { status: "submitted" });

      // [DOM 알림 생성 로직] - 나중에 DOM 네비게이션바에서 🔔 아이콘으로 보여줄 데이터
      await addDoc(collection(db, "notifications"), {
        dom_id: mission?.dom_id,
        sub_id: user.uid,
        mission_id: missionId,
        type: "submission",
        message: "새로운 미션 인증이 제출되었습니다.",
        is_read: false,
        created_at: new Date().toISOString()
      });

      alert("미션이 성공적으로 제출되었습니다. DOM의 확인을 대기합니다.");
      router.push("/my-missions");
    } catch (error) {
      alert("제출 중 오류가 발생했습니다.");
    }
    setSubmitting(false);
  };

  // 2. 지연 사유서(Appeal) 제출 로직
  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (appealText.trim().length < 10) return alert("사유서는 최소 10자 이상 성의껏 작성해야 합니다.");
    
    if (!confirm("지연 사유서를 제출하시겠습니까? DOM이 이를 읽고 처벌 또는 연장을 결정합니다.")) return;

    setSubmitting(true);
    try {
      // 미션 상태를 'appealed'로 바꾸고 사유서 내용을 저장합니다.
      await updateDoc(doc(db, "missions", missionId), { 
        status: "appealed",
        appeal_message: appealText
      });

      // [DOM 알림 생성] - 사유서 제출 알림
      await addDoc(collection(db, "notifications"), {
        dom_id: mission?.dom_id,
        sub_id: auth.currentUser?.uid,
        mission_id: missionId,
        type: "appeal",
        message: "미션 지연 사유서(Appeal)가 도착했습니다.",
        is_read: false,
        created_at: new Date().toISOString()
      });

      alert("사유서가 제출되었습니다. DOM의 자비를 기다리십시오.");
      router.push("/my-missions");
    } catch (error) {
      alert("사유서 제출 중 오류가 발생했습니다.");
    }
    setSubmitting(false);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center font-bold">로딩 중...</div>;
  if (!mission) return <div className="p-6 text-center">미션을 찾을 수 없습니다.</div>;

  // ⏳ 마감 기한 지각 여부 판별 (현재 시간이 마감 시간보다 큰지 확인)
  const isOverdue = new Date() > new Date(mission.deadline);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-xl">
        <Link href="/my-missions" className="mb-4 inline-block text-sm font-bold text-gray-500 underline hover:text-black">
          ← 목록으로 돌아가기
        </Link>

        {/* 미션 지시사항 영역 */}
        <div className={`mb-6 rounded-xl border p-6 shadow-sm ${isOverdue && mission.status === 'pending' ? 'bg-red-900 text-white border-red-900' : 'bg-red-50 border-red-200'}`}>
          <h2 className={`mb-2 text-sm font-bold ${isOverdue && mission.status === 'pending' ? 'text-red-300' : 'text-red-600'}`}>
            DOM의 지시사항
          </h2>
          <p className="text-xl font-extrabold">{mission.content}</p>
          <div className={`mt-4 text-xs font-bold ${isOverdue && mission.status === 'pending' ? 'text-red-200' : 'text-gray-500'}`}>
            마감 기한: {new Date(mission.deadline).toLocaleString()}
          </div>
        </div>

        {/* 상태별 화면 분기 처리 */}
        {mission.status === "appealed" ? (
          <div className="rounded-xl border border-gray-300 bg-white p-8 text-center shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-2">사유서 검토 대기 중</h3>
            <p className="text-sm text-gray-500 mb-4">DOM이 당신의 사유서를 읽고 처분을 결정할 때까지 대기하십시오.</p>
            <div className="bg-gray-100 p-4 rounded text-left text-sm text-gray-700 italic border border-gray-200">
              "{mission.appeal_message}"
            </div>
          </div>
        ) : mission.status !== "pending" ? (
          <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
            <h3 className="text-lg font-bold text-gray-800">제출이 완료된 미션입니다.</h3>
            <p className="mt-2 text-sm text-gray-500">현재 상태: {mission.status}</p>
          </div>
        ) : isOverdue ? (
          
          /* 🚨 마감 지각 시 나타나는 [사유서 제출 폼] */
          <form onSubmit={handleAppealSubmit} className="flex flex-col gap-5 rounded-xl border border-red-400 bg-white p-6 shadow-md">
            <div className="flex flex-col items-center mb-2">
              <span className="text-4xl mb-2">🚨</span>
              <h3 className="text-lg font-black text-red-600">마감 기한 초과 (Submission Blocked)</h3>
              <p className="text-sm text-gray-600 text-center mt-1">
                기한 내에 미션을 완수하지 못해 인증 권한이 박탈되었습니다.<br/>
                DOM에게 지연 사유서를 제출하여 자비를 구하십시오.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-800">지연 사유 / 연장 요청서 <span className="text-red-500">*</span></label>
              <textarea 
                required
                placeholder="도대체 왜 기한을 넘겼는지, 얼마나 연장이 필요한지 상세히 적으십시오."
                className="h-32 w-full resize-none rounded border border-gray-300 p-3 text-black placeholder:text-gray-400 focus:border-red-500 focus:outline-none"
                value={appealText}
                onChange={(e) => setAppealText(e.target.value)}
              />
            </div>

            <button type="submit" disabled={submitting} className="mt-2 w-full cursor-pointer rounded-md bg-red-600 py-4 text-lg font-bold text-white shadow-md transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400">
              {submitting ? "제출 중..." : "DOM에게 사유서 제출하기"}
            </button>
          </form>

        ) : (
          
          /* ✅ 기한 내 정상 제출 폼 */
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-xl border bg-white p-6 shadow-md">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-800">인증 사진 촬영 <span className="text-red-500">*</span></label>
              {mission.require_live_camera && (
                <p className="text-xs font-bold text-red-500 mb-1">※ 이 미션은 기기의 카메라로 즉시 촬영한 사진만 허용됩니다.</p>
              )}
              <input 
                type="file" 
                accept="image/*" 
                required 
                {...(mission.require_live_camera ? { capture: "environment" } : {})}
                className="w-full cursor-pointer rounded border border-gray-200 p-2 text-sm text-gray-800 file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-gray-800"
                onChange={(e) => setPhoto(e.target.files?.[0] || null)} 
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-800">보고 메시지 (선택)</label>
              <textarea 
                placeholder="DOM에게 남길 메시지를 작성하세요."
                className="h-24 w-full resize-none rounded border border-gray-300 p-3 text-black placeholder:text-gray-400"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <button type="submit" disabled={submitting} className="mt-2 w-full cursor-pointer rounded-md bg-black py-4 text-lg font-bold text-white shadow-md transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400">
              {submitting ? "제출 중..." : "미션 제출 완료하기"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}