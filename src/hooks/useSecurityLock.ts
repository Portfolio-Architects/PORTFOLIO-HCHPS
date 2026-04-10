import { useState, useEffect } from 'react';
import { initCryptoContext } from '@/lib/crypto';

export const useSecurityLock = () => {
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [hasSetupPIN, setHasSetupPIN] = useState<boolean | null>(null); // null means checking

  useEffect(() => {
    const autoUnlock = async () => {
      // 핀번호 기능 삭제 요청으로 강제 바이패스 키를 삽입하여 자동 초기화합니다.
      await initCryptoContext('0509');
      setHasSetupPIN(true);
      setIsLocked(false);
    };
    autoUnlock();
  }, []);

  return {
    isLocked,
    hasSetupPIN,
    failCount: 0,
    verifyPIN: async (pin: string) => true,
    setupPIN: async (pin: string) => {},
  };
};
