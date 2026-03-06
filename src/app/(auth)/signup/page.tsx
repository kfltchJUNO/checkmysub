"use client";

import { useState } from "react";
import { auth, db, storage } from "@/lib/firebase/config";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs, setDoc, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    password: "", 
    name: "", 
    age: "", 
    job: "", // ⭐ 직업 필드 추가
    height: "", 
    weight: "", 
    length: "", 
    bio: "",
  });

  const [facePhoto, setFacePhoto] = useState<File | null>(null);
  const [bodyPhoto, setBodyPhoto] = useState<File | null>(null);

  const verifyInviteCode = async () => {
    setLoading(true); setError("");
    try {
      const q = query(collection(db, "invite_codes"), where("code", "==", inviteCode), where("is_used", "==", false));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setError("유효하지 않거나 이미 사용된 초대 코드입니다.");
        setLoading(false); return;
      }
      setStep(2);
    } catch (err) {
      setError("코드 검증 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!facePhoto || !bodyPhoto) {
      setError("얼굴 사진과 신체 사진을 모두 업로드해야 합니다.");
      return;
    }

    setLoading(true); setError("");

    try {
      const randomId = `sub_${Math.floor(1000 + Math.random() * 9000)}`;
      const dummyEmail = `${randomId}@private.app`;

      const userCredential = await createUserWithEmailAndPassword(auth, dummyEmail, formData.password);
      const user = userCredential.user;

      const faceRef = ref(storage, `sub_media/${user.uid}/face_${Date.now()}`);
      const bodyRef = ref(storage, `sub_media/${user.uid}/body_${Date.now()}`);

      await uploadBytes(faceRef, facePhoto);
      await uploadBytes(bodyRef, bodyPhoto);

      const facePhotoUrl = await getDownloadURL(faceRef);
      const bodyPhotoUrl = await getDownloadURL(bodyRef);

      await setDoc(doc(db, "users", user.uid), {
        role: "sub", username: randomId, status: "pending", created_at: new Date().toISOString(),
      });

      await setDoc(doc(db, "profiles", user.uid), {
        sub_id: user.uid,
        name: formData.name, 
        age: Number(formData.age), 
        job: formData.job, // ⭐ 직업 데이터 저장
        height: Number(formData.height),
        weight: Number(formData.weight), 
        length: Number(formData.length), 
        bio: formData.bio,
        face_photo_url: facePhotoUrl,
        body_photo_url: bodyPhotoUrl,
      });

      const q = query(collection(db, "invite_codes"), where("code", "==", inviteCode));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        await updateDoc(doc(db, "invite_codes", querySnapshot.docs[0].id), { is_used: true });
      }

      alert(`가입 완료! DOM의 승인을 대기합니다.\n당신의 아이디는 [${randomId}] 입니다.`);
      router.push("/login");

    } catch (err: any) {
      console.error(err);
      setError("에러 상세: " + err.message);
    }
    setLoading(false);
  };

  const inputStyle = "w-full rounded border border-gray-300 px-4 py-2 text-black placeholder:text-gray-400 bg-white focus:border-black outline-none";
  const fileInputStyle = "w-full text-sm text-gray-800 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-black file:text-white hover:file:bg-gray-800 cursor-pointer";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800">
          {step === 1 ? "초대 코드 인증" : "프로필 입력"}
        </h1>

        {error && <p className="mb-4 text-center text-sm text-red-500 font-bold">{error}</p>}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <input type="text" placeholder="초대 코드" className={inputStyle}
              value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
            <button onClick={verifyInviteCode} disabled={loading || !inviteCode}
              className="w-full rounded bg-black py-2.5 font-bold text-white hover:bg-gray-800 disabled:bg-gray-400 transition-colors">
              {loading ? "확인 중..." : "코드 확인"}
            </button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-100 p-5 shadow-inner">
              <label className="text-sm font-bold text-gray-800 mb-1">얼굴 사진 <span className="text-red-500">*</span></label>
              <input type="file" accept="image/*" required className={fileInputStyle} onChange={(e) => setFacePhoto(e.target.files?.[0] || null)} />
              
              <label className="mt-3 text-sm font-bold text-gray-800 mb-1">신체 사진 <span className="text-red-500">*</span></label>
              <input type="file" accept="image/*" required className={fileInputStyle} onChange={(e) => setBodyPhoto(e.target.files?.[0] || null)} />
            </div>

            <input type="password" placeholder="비밀번호 설정 (6자리 이상)" required className={inputStyle}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
            
            <div className="grid grid-cols-2 gap-4">
              <input type="text" placeholder="이름/닉네임" required className={inputStyle} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              <input type="number" placeholder="나이" required className={inputStyle} 
                onChange={(e) => setFormData({ ...formData, age: e.target.value })} />
              
              {/* ⭐ 직업 입력란 추가 */}
              <input type="text" placeholder="직업 (예: 대학생)" required className={inputStyle} 
                onChange={(e) => setFormData({ ...formData, job: e.target.value })} />
              
              <input type="number" placeholder="키 (cm)" required className={inputStyle} 
                onChange={(e) => setFormData({ ...formData, height: e.target.value })} />
              
              <input type="number" placeholder="몸무게 (kg)" required className={inputStyle} 
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })} />
              
              <input type="number" placeholder="신체 길이 (선택)" className={inputStyle} 
                onChange={(e) => setFormData({ ...formData, length: e.target.value })} />
            </div>
            
            <textarea placeholder="자기소개 및 특이사항" required className={`${inputStyle} h-24 resize-none`} 
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })} />
            
            <button type="submit" disabled={loading} className="mt-4 w-full rounded-md bg-black py-4 font-bold text-white hover:bg-gray-800 disabled:bg-gray-400 transition-all text-lg shadow-md disabled:cursor-not-allowed">
              {loading ? "업로드 및 가입 요청 중..." : "가입 및 승인 요청"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}