// src/app/api/verify-invite/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  // 나중에 여기에 초대 코드 검증 로직이 들어갑니다.
  return NextResponse.json({ message: "초대 코드 검증 API 준비 중" });
}