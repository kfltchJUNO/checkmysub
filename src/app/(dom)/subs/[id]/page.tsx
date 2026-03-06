// src/app/(dom)/subs/[id]/page.tsx
"use client";

import { useEffect, useState, use } from "react";
import { auth, db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, doc, getDoc, orderBy } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ArchiveItem {
  id: string; // submission id
  missionContent: string;
  mediaUrl: string;
  message: string;
  status: string; // approved, rejected, submitted
  submittedAt: string;
}

interface SubProfile {
  name: string;
  username: string;
  face_photo_url: string;
}

export default function SubArchivePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const subId = resolvedParams.id;

  const [subProfile, setSubProfile] = useState<SubProfile | null>(null);
  const [archives, setArchives] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push("/login");

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists() || userDoc.data().role !== "dom") {
        alert("접근 권한이 없습니다.");
        return router.push("/login");
      }

      fetchSubArchive();
    });
    return () => unsubscribe();
  }, [router, subId]);

  const fetchSubArchive = async () => {
    try {
      // 1. SUB 기본 프로필 가져오기
      const profileDoc = await getDoc(doc(db, "profiles", subId));
      const userDoc = await getDoc(doc(db, "users", subId));
      
      if (profileDoc.exists() && userDoc.exists()) {
        setSubProfile({
          name: profileDoc.data().name,
          username: userDoc.data().username,
          face_photo_url: profileDoc.data().face_photo_url,
        });
      }

      // 2. 해당 SUB이 제출한 모든 submissions 가져오기
      const subq = query(collection(db, "submissions"), where("sub_id", "==", subId));
      const subSnapshot = await getDocs(subq);

      const archiveData: ArchiveItem[] = [];

      // 3. 각 제출물에 해당하는 미션(missions) 정보를 조인하여 합치기
      for (const sDoc of subSnapshot.docs) {
        const submission = sDoc.data();
        const missionDoc = await getDoc(doc(db, "missions", submission.mission_id));
        
        if (missionDoc.exists()) {
          const mission = missionDoc.data();
          archiveData.push({
            id: sDoc.id,
            missionContent: mission.content,
            mediaUrl: submission.media_url,
            message: submission.message,
            status: mission.status, // 현재 미션의 최종 상태 (합격/불합격)
            submittedAt: submission.created_at,
          });
        }
      }

      // 최신 제출 순으로 정렬
      archiveData.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setArchives(archiveData);

    } catch (error) {
      console.error(error);
      alert("기록을 불러오는 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved": return <span className="absolute top-2 left-2 rounded bg-green-500 px-2 py-1 text-xs font-bold text-white shadow">✅ 합격</span>;
      case "rejected": return <span className="absolute top-2 left-2 rounded bg-red-500 px-2 py-1 text-xs font-bold text-white shadow">❌ 불합격</span>;
      default: return <span className="absolute top-2 left-2 rounded bg-yellow-500 px-2 py-1 text-xs font-bold text-white shadow">⏳ 검토 중</span>;
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center font-bold">기록 보관소를 여는 중...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      
      {/* 상단 네비게이션 */}
      <div className="mx-auto mb-6 flex max-w-6xl items-center justify-between rounded-lg bg-black px-6 py-4 text-white shadow-md">
        <div className="flex items-center gap-4">
          <Link href="/subs" className="text-sm font-bold text-gray-400 hover:text-white transition-colors">
            ← 뒤로가기
          </Link>
          <h1 className="text-xl font-bold">SUB 아카이브 (개인 기록)</h1>
        </div>
      </div>

      <div className="mx-auto max-w-6xl flex flex-col gap-6">
        
        {/* SUB 요약 정보 헤더 */}
        {subProfile && (
          <div className="flex items-center gap-5 rounded-xl border bg-white p-6 shadow-sm">
            <img src={subProfile.face_photo_url} alt="Profile" className="h-20 w-20 rounded-full border border-gray-200 object-cover shadow-sm" />
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">{subProfile.name}</h2>
              <p className="text-sm font-bold text-gray-500">{subProfile.username} 의 모든 미션 기록</p>
            </div>
            <div className="ml-auto text-right">
              <span className="block text-sm font-bold text-gray-500">누적 제출 횟수</span>
              <span className="text-3xl font-black text-black">{archives.length}건</span>
            </div>
          </div>
        )}

        {/* 사진 갤러리 그리드 영역 */}
        {archives.length === 0 ? (
          <div className="rounded-xl border bg-white p-12 text-center text-gray-500 shadow-sm">
            아직 제출된 기록이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {archives.map((item) => (
              <div key={item.id} className="group relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-md transition-all hover:-translate-y-1 hover:shadow-xl">
                
                {/* 갤러리 이미지 (정사각형 비율) */}
                <div className="relative aspect-square w-full overflow-hidden bg-gray-200">
                  <a href={item.mediaUrl} target="_blank" rel="noreferrer">
                    <img 
                      src={item.mediaUrl} 
                      alt="Mission" 
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" 
                    />
                  </a>
                  {getStatusBadge(item.status)}
                  <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
                    <p className="text-xs font-bold text-white/80">
                      {new Date(item.submittedAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </div>

                {/* 하단 텍스트 정보 */}
                <div className="flex flex-1 flex-col p-4">
                  <span className="mb-2 block text-xs font-bold text-red-500">DOM의 지시</span>
                  <p className="mb-3 flex-1 text-sm font-bold text-gray-900 line-clamp-2">
                    {item.missionContent}
                  </p>
                  
                  {item.message && (
                    <div className="rounded bg-gray-50 p-2 text-xs text-gray-600 border border-gray-100">
                      <span className="font-bold text-gray-800 mr-1">보고:</span> 
                      <span className="italic">"{item.message}"</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}