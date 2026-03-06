import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // 나중에 Firebase와 연결하여 실제 코드를 검증하는 로직이 들어갑니다.
  return NextResponse.json({ success: true, message: "API 통신 정상 작동" });
}