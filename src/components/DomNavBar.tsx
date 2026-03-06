// src/components/DomNavBar.tsx
"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase/config";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DomNavBar() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // 실시간 알림 리스너: 읽지 않은(is_read == false) 알림 개수를 실시간으로 감시
    const q = query(
      collection(db, "notifications"),
      where("dom_id", "==", user.uid),
      where("is_read", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    auth.signOut();
    router.push("/login");
  };

  return (
    <div className="mx-auto flex max-w-5xl items-center justify-between rounded-lg bg-black px-6 py-4 text-white shadow-md mb-6">
      <Link href="/dashboard" className="text-xl font-bold">DOM CONTROL</Link>
      
      <div className="flex items-center gap-4">
        <Link href="/subs" className="rounded bg-blue-100 px-3 py-1.5 text-sm font-bold text-blue-800 hover:bg-blue-200">
          👥 내 SUB 통계
        </Link>
        
        {/* 알림 뱃지 아이콘 */}
        <Link href="/submissions" className="relative rounded bg-yellow-400 px-3 py-1.5 text-sm font-bold text-black hover:bg-yellow-500">
          📥 미션 검토
          {unreadCount > 0 && (
            <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] text-white animate-bounce">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        <Link href="/missions" className="rounded bg-white px-3 py-1.5 text-sm font-bold text-black hover:bg-gray-200">
          + 새 미션
        </Link>
        <button onClick={handleLogout} className="text-sm font-bold text-gray-300 underline hover:text-white ml-2">
          로그아웃
        </button>
      </div>
    </div>
  );
}