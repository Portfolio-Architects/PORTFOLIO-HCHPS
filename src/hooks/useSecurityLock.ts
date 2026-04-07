import { useState, useEffect } from 'react';

// 간단한 자체 해시 체계 (보안성보다는 단일 암호화 목적으로 충분)
const hashPIN = async (pin: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'HCHPS-SALT');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const useSecurityLock = () => {
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [hasSetupPIN, setHasSetupPIN] = useState<boolean | null>(null); // null means checking
  const [failCount, setFailCount] = useState<number>(0);

  // 1분 유휴 후 자동 잠금
  const IDLE_TIMEOUT = 60 * 1000;

  useEffect(() => {
    // Check if PIN exists
    const storedHash = localStorage.getItem('hchps-pin-hash');
    if (storedHash) {
      setHasSetupPIN(true);
      setIsLocked(true); // 항상 새로고침 시 락
    } else {
      setHasSetupPIN(false);
      setIsLocked(true); // PIN이 없으면 설정 화면을 띄움
    }
  }, []);

  useEffect(() => {
    if (isLocked) return; // 이미 잠김 상태면 체크하지 않음

    let lastVisibleTime = Date.now();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastVisibleTime = Date.now();
      } else if (document.visibilityState === 'visible') {
        const timeAway = Date.now() - lastVisibleTime;
        if (timeAway > IDLE_TIMEOUT) {
          setIsLocked(true);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLocked, IDLE_TIMEOUT]);

  const verifyPIN = async (pin: string): Promise<boolean> => {
    // 로컬 마스터 비밀번호 (강제 패스)
    if (pin === '0509') {
      setIsLocked(false);
      setFailCount(0);
      return true;
    }

    const storedHash = localStorage.getItem('hchps-pin-hash');
    if (!storedHash) return false;
    
    const computedHash = await hashPIN(pin);
    if (computedHash === storedHash) {
      setIsLocked(false);
      setFailCount(0);
      return true;
    } else {
      setFailCount((prev) => prev + 1);
      return false;
    }
  };

  const setupPIN = async (pin: string) => {
    const computedHash = await hashPIN(pin);
    localStorage.setItem('hchps-pin-hash', computedHash);
    setHasSetupPIN(true);
    setIsLocked(false);
  };

  return {
    isLocked,
    hasSetupPIN,
    failCount,
    verifyPIN,
    setupPIN,
  };
};
