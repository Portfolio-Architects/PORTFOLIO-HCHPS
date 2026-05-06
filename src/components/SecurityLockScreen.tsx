import React, { useState, useEffect } from 'react';
import { Lock, Unlock, AlertCircle } from 'lucide-react';

interface Props {
  hasSetupPIN: boolean;
  failCount: number;
  onVerify: (pin: string) => Promise<boolean>;
  onSetup: (pin: string) => void;
}

const PIN_LENGTH = 4;

export const SecurityLockScreen: React.FC<Props> = ({ hasSetupPIN, failCount, onVerify, onSetup }) => {
  const [pin, setPin] = useState<string>('');
  const [setupStep, setSetupStep] = useState<1 | 2>(1);
  const [firstPin, setFirstPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isShaking, setIsShaking] = useState(false);

  // Trigger shake animation
  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
    setPin('');
  };

  const handlePinComplete = async (currentPin: string) => {
    if (hasSetupPIN) {
      const isValid = await onVerify(currentPin);
      if (!isValid) {
        triggerError('비밀번호가 일치하지 않습니다.');
      }
    } else {
      if (setupStep === 1) {
        setFirstPin(currentPin);
        setSetupStep(2);
        setPin('');
      } else {
        if (currentPin === firstPin) {
          onSetup(currentPin);
        } else {
          setSetupStep(1);
          setFirstPin('');
          triggerError('비밀번호가 서로 다릅니다. 다시 설정해주세요.');
        }
      }
    }
  };

  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      handlePinComplete(pin);
    }
  }, [pin]);

  // 물리적 키보드(키패드) 입력 지원
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 숫자 키 입력
      if (e.key >= '0' && e.key <= '9') {
        setPin(prev => {
          if (prev.length < PIN_LENGTH) return prev + e.key;
          return prev;
        });
        setErrorMsg('');
      } 
      // 백스페이스 및 삭제 
      else if (e.key === 'Backspace' || e.key === 'Delete') {
        setPin(prev => prev.slice(0, -1));
        setErrorMsg('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);



  const handleNumberClick = (n: number) => {
    if (pin.length < PIN_LENGTH) {
      setPin(prev => prev + n.toString());
      setErrorMsg('');
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center p-6 sm:p-8">
      
      {/* 락 아이콘 */}
      <div className="mb-8 p-4 bg-slate-800/50 rounded-full shadow-lg border border-slate-700/50">
        {hasSetupPIN ? (
          <Lock size={32} className="text-blue-400" />
        ) : (
          <Unlock size={32} className="text-emerald-400" />
        )}
      </div>

      {/* 안내 메시지 */}
      <div className="text-center mb-8 h-16">
        <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
          {hasSetupPIN 
            ? 'VITAL 시스템 잠금 해제' 
            : setupStep === 1 ? '새로운 접근 비밀번호 설정' : '비밀번호를 한 번 더 입력해주세요'}
        </h2>
        <p className={`text-sm ${errorMsg ? 'text-red-400' : 'text-slate-400'}`}>
          {errorMsg || (hasSetupPIN ? '설정하신 4자리 PIN을 입력하세요.' : '자신만이 알 수 있는 4자리를 선택하세요.')}
        </p>
      </div>

      {/* 핀 도트 */}
      <div className={`flex gap-4 mb-12 ${isShaking ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div 
            key={i} 
            className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
              i < pin.length 
                ? 'bg-blue-500 border-blue-500 scale-110 shadow-[0_0_10px_rgba(59,130,246,0.6)]' 
                : 'bg-transparent border-slate-600'
            }`}
          />
        ))}
      </div>

      {/* 숫자 패드 */}
      <div className="grid grid-cols-3 gap-x-8 gap-y-6 max-w-[280px] w-full">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => handleNumberClick(n)}
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl text-slate-200 font-medium hover:bg-slate-800 transition-colors active:scale-95 mx-auto"
          >
            {n}
          </button>
        ))}
        <div /> {/* 빈 칸 */}
        <button
          onClick={() => handleNumberClick(0)}
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl text-slate-200 font-medium hover:bg-slate-800 transition-colors active:scale-95 mx-auto"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          className="w-16 h-16 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors active:scale-95 mx-auto text-lg"
        >
          지우기
        </button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-10px); }
          80% { transform: translateX(10px); }
        }
      `}} />
    </div>
  );
};
