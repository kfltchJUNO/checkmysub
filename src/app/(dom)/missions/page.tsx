"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, addDoc, doc, getDoc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import DomNavBar from "@/components/DomNavBar";

interface ApprovedSub {
  id: string;
  username: string;
  name: string;
}

interface MissionTemplate {
  id: string;
  title: string;
  content: string;
  require_live_camera: boolean;
}

export default function DomMissionsPage() {
  const router = useRouter();
  const [approvedSubs, setApprovedSubs] = useState<ApprovedSub[]>([]);
  const [templates, setTemplates] = useState<MissionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [missionContent, setMissionContent] = useState("");
  const [deadline, setDeadline] = useState("");
  const [scheduledAt, setScheduledAt] = useState(""); // ⭐ 예약 시간 상태
  const [requireLiveCamera, setRequireLiveCamera] = useState(true);
  const [templateTitle, setTemplateTitle] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return router.push("/login");
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists() || userDoc.data().role !== "dom") return router.push("/login");
      fetchApprovedSubs();
      fetchTemplates();
    });
    return () => unsubscribe();
  }, [router]);

  const fetchApprovedSubs = async () => {
    const q = query(collection(db, "users"), where("role", "==", "sub"), where("status", "==", "approved"));
    const querySnapshot = await getDocs(q);
    const subsData: ApprovedSub[] = [];
    for (const userDoc of querySnapshot.docs) {
      const profileDoc = await getDoc(doc(db, "profiles", userDoc.id));
      if (profileDoc.exists()) {
        subsData.push({ id: userDoc.id, username: userDoc.data().username, name: profileDoc.data().name });
      }
    }
    setApprovedSubs(subsData);
    setLoading(false);
  };

  const fetchTemplates = async () => {
    const snapshot = await getDocs(query(collection(db, "mission_templates")));
    setTemplates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MissionTemplate)));
  };

  const handleSubmitMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSubIds.length === 0) return alert("SUB을 선택하세요.");
    setSubmitting(true);
    try {
      const isScheduled = scheduledAt !== "";
      const promises = selectedSubIds.map((subId) => {
        return addDoc(collection(db, "missions"), {
          dom_id: auth.currentUser?.uid,
          sub_id: subId,
          content: missionContent,
          deadline: new Date(deadline).toISOString(),
          scheduled_at: isScheduled ? new Date(scheduledAt).toISOString() : null, // ⭐ 예약 시간 저장
          require_live_camera: requireLiveCamera,
          status: isScheduled ? "scheduled" : "pending", // ⭐ 예약 시 scheduled 상태로 저장
          created_at: new Date().toISOString(),
        });
      });
      await Promise.all(promises);
      alert(isScheduled ? "미션이 예약되었습니다." : "미션이 즉시 하달되었습니다.");
      setMissionContent(""); setDeadline(""); setScheduledAt(""); setSelectedSubIds([]);
    } catch (error) { console.error(error); }
    setSubmitting(false);
  };

  const inputStyle = "w-full rounded border border-gray-300 bg-white px-4 py-2 text-black";

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <DomNavBar />
      <div className="mx-auto max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-white p-5 rounded-xl border shadow-lg">
          <h2 className="mb-4 font-extrabold">미션 템플릿</h2>
          <div className="flex flex-col gap-2">
            {templates.map(temp => (
              <div key={temp.id} onClick={() => {setMissionContent(temp.content); setRequireLiveCamera(temp.require_live_camera);}} className="cursor-pointer rounded border p-3 bg-gray-50 hover:bg-white text-xs">
                <p className="font-bold">{temp.title}</p>
                <p className="text-gray-500 line-clamp-1">{temp.content}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-2 bg-white p-8 rounded-xl border shadow-lg">
          <form onSubmit={handleSubmitMission} className="flex flex-col gap-6">
            <section>
              <h2 className="mb-3 font-extrabold">1. 대상 선택</h2>
              <div className="grid grid-cols-2 gap-2">
                {approvedSubs.map((sub) => (
                  <label key={sub.id} className={`flex items-center gap-2 border p-2 rounded cursor-pointer ${selectedSubIds.includes(sub.id) ? 'border-black bg-gray-50' : ''}`}>
                    <input type="checkbox" checked={selectedSubIds.includes(sub.id)} onChange={() => setSelectedSubIds(prev => prev.includes(sub.id) ? prev.filter(i => i !== sub.id) : [...prev, sub.id])} />
                    <span className="text-sm font-bold">{sub.name}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="font-extrabold">2. 미션 및 시간 설정</h2>
              <textarea placeholder="지시 내용을 입력하세요." required className={`${inputStyle} h-24`} value={missionContent} onChange={(e) => setMissionContent(e.target.value)} />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500">전송 예약 (선택)</label>
                  <input type="datetime-local" className={inputStyle} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-bold text-red-500">마감 기한 (필수)</label>
                  <input type="datetime-local" required className={inputStyle} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                </div>
              </div>

              <label className="flex items-center gap-2 p-3 bg-gray-50 rounded border">
                <input type="checkbox" checked={requireLiveCamera} onChange={(e) => setRequireLiveCamera(e.target.checked)} />
                <span className="text-sm font-bold text-red-600">실시간 카메라 촬영 강제</span>
              </label>
            </section>

            <button type="submit" disabled={submitting} className="w-full bg-black text-white py-4 rounded font-bold hover:bg-gray-800 disabled:bg-gray-400">
              {submitting ? "처리 중..." : "미션 하달하기"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}