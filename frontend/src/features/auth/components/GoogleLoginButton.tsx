import React, { useEffect, useRef, useState } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';

interface GoogleLoginButtonProps {
  onSuccess: (credentialResponse: CredentialResponse) => void;
  onError: () => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
}

export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  onSuccess,
  onError,
  text = 'signin_with',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [btnWidth, setBtnWidth] = useState<string>('400');

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const measured = containerRef.current.clientWidth;
        if (measured > 0) {
          // Google GSI accepts width between 200 and 400
          const clamped = Math.min(Math.max(measured, 200), 400);
          setBtnWidth(String(Math.floor(clamped)));
        }
      }
    };

    updateWidth();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(() => updateWidth());
      observer.observe(containerRef.current);
    }
    window.addEventListener('resize', updateWidth);

    return () => {
      window.removeEventListener('resize', updateWidth);
      if (observer) {
        observer.disconnect();
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="auth-google-btn-container">
      <GoogleLogin
        key={btnWidth}
        onSuccess={onSuccess}
        onError={onError}
        type="standard"
        text={text}
        shape="rectangular"
        theme="outline"
        size="medium"
        width={btnWidth}
        auto_select={false}
        use_fedcm_for_button={false}
      />
    </div>
  );
};

export default GoogleLoginButton;

