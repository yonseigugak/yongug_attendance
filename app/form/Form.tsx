import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Form = () => {
  const [song, setSong] = useState('');
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        song,
        name,
        date,
        status,
        reason,
        timestamp: new Date().toISOString(),
      }),
    });

    if (response.ok) {
      alert('제출 완료!');
      router.push('/');
    } else {
      alert('제출 실패! 다시 시도해주세요.');
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen">
      <Card className="w-full max-w-md p-6 shadow-lg">
        <CardHeader>
          <h1 className="text-2xl font-bold mb-4">합주곡 관리</h1>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label>곡 선택:</label>
              <select value={song} onChange={(e) => setSong(e.target.value)} className="w-full p-2 border border-gray-300 rounded">
                <option value="">선택하세요</option>
                <option value="취타">취타</option>
                <option value="축제">축제</option>
                <option value="미락흘">미락흘</option>
                <option value="도드리">도드리</option>
                <option value="플투스">플투스</option>
              </select>
            </div>
            <div>
              <label>이름:</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full p-2 border border-gray-300 rounded"/>
            </div>
            <div>
              <label>날짜:</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded"/>
            </div>
            <div>
              <label>출결 상태:</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full p-2 border border-gray-300 rounded">
                <option value="">선택하세요</option>
                <option value="출결">출결</option>
                <option value="일반결석계">일반결석계</option>
                <option value="고정결석계">고정결석계</option>
              </select>
            </div>
            <div>
              <label>사유:</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="w-full p-2 border border-gray-300 rounded"/>
            </div>
            <Button type="submit" className="w-full mt-4">제출</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default Form;
