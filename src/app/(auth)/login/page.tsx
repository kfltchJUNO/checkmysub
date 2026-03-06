// src/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase/config";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 입력받은 아이디를 파이어베이스용 가짜 이메일로 변환
      const dummyEmail = `${userId}@private.app`;
      const userCredential = await signInWithEmailAndPassword(auth, dummyEmail, password);
      const user = userCredential.user;

      // Firestore에서 유저 권한(role) 및 상태(status) 가져오기
      const userDoc = await getDoc(doc(db, "users", user.uid));
      
      if (!userDoc.exists()) {
        setError("데이터베이스에 사용자 정보가 없습니다.");
        auth.signOut();
        setLoading(false);
        return;
      }

      const userData = userDoc.data();

      // 권한별 라우팅 처리
      if (userData.role === "dom") {
        router.push("/dashboard"); // DOM은 대시보드로 이동
      } else if (userData.role === "sub") {
        if (userData.status === "pending") {
          setError("아직 DOM의 승인을 대기 중인 계정입니다.");
          auth.signOut();
        } else if (userData.status === "rejected") {
          setError("가입이 거절된 계정입니다.");
          auth.signOut();
        } else {
          router.push("/my-missions"); // 승인된 SUB는 미션 페이지로 이동
        }
      }
    } catch (err: any) {
      console.error(err);
      setError("아이디 또는 비밀번호가 일치하지 않습니다.");
    }
    setLoading(false);
  };

  const inputStyle = "w-full rounded border border-gray-300 bg-white px-4 py-2 text-black placeholder:text-gray-400";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800">시스템 로그인</h1>
        
        {error && <p className="mb-4 text-center text-sm font-bold text-red-500">{error}</p>}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="아이디"
            required
            className={inputStyle}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
          <input
            type="password"
            placeholder="비밀번호"
            required
            className={inputStyle}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full cursor-pointer rounded bg-black py-3 font-bold text-white shadow-md transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {loading ? "인증 중..." : "접속하기"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          초대 코드가 있으신가요?{" "}
          <Link href="/signup" className="font-bold text-black underline">
            가입하기
          </Link>
        </div>
      </div>
    </div>
  );
}