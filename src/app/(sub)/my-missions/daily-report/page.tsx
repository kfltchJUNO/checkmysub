"use client";
import { useState } from "react";
import { db, auth } from "@/lib/firebase/config";
import { addDoc, collection } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function DailyReportPage() {
  const [content, setContent] = useState("");
  const [mood, setMood] = useState(5); // 1~10점
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "reports"), {
        sub_id: auth.currentUser?.uid,
        content,
        mood_score: mood,
        created_at: new Date().toISOString(),
      });
      
      // DOM에게 알림 전송
      await addDoc(collection(db, "notifications"), {
        type: "report",
        message: "SUB이 오늘의 복종 일기를 제출했습니다.",
        created_at: new Date().toISOString(),
        is_read: false
      });

      alert("오늘의 보고를 완료했습니다.");
      router.push("/sub-dashboard");
    } catch (e) { alert("제출 실패"); }
  };

  return (
    <div className="min-h-screen bg-white p-6">
      <h2 className="text-2xl font-black mb-6">일일 복종 보고서</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-bold mb-2">오늘의 심리 상태 (1~10)</label>
          <input type="range" min="1" max="10" value={mood} onChange={(e)=>setMood(Number(e.target.value))} className="w-full accent-black" />
          <p className="text-right text-xs font-bold">{mood} / 10</p>
        </div>
        <div>
          <label className="block text-sm font-bold mb-2">DOM에게 드리는 글</label>
          <textarea 
            required
            className="w-full h-64 p-4 border-2 border-black rounded-lg focus:outline-none"
            placeholder="오늘 미션을 수행하며 느낀 점과 반성할 점을 적으십시오."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
        <button className="w-full bg-black text-white py-4 font-bold rounded-lg shadow-lg">보고서 바치기</button>
      </form>
    </div>
  );
}