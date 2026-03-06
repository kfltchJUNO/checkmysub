export default function SubMissionDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">미션 수행</h1>
      <p>현재 미션 ID: {params.id}</p>
      <p>카메라 강제 촬영 및 제출 버튼이 들어갈 자리입니다.</p>
    </div>
  );
}