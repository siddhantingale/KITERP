import { useState, useEffect } from 'react';

export const useDeviceType = () => {
  const [deviceType, setDeviceType] = useState('desktop');

  useEffect(() => {
    const detectDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const width = window.innerWidth;

      // Mobile detection
      if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent) || width < 768) {
        return 'mobile';
      }
      
      // Tablet detection
      if (/tablet|ipad|playbook|silk/i.test(userAgent) || (width >= 768 && width < 1024)) {
        return 'tablet';
      }
      
      // Desktop
      return 'desktop';
    };

    setDeviceType(detectDevice());

    const handleResize = () => {
      setDeviceType(detectDevice());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return deviceType;
};

export const isMobile = () => {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent.toLowerCase();
  const width = window.innerWidth;
  return /mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent) || width < 768;
};

export const isTablet = () => {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent.toLowerCase();
  const width = window.innerWidth;
  return /tablet|ipad|playbook|silk/i.test(userAgent) || (width >= 768 && width < 1024);
};

export const isDesktop = () => {
  return !isMobile() && !isTablet();
};