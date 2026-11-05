import React from 'react';
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
  return (
    <div className="auth-google-btn-container">
      <GoogleLogin
        onSuccess={onSuccess}
        onError={onError}
        type="standard"
        text={text}
        shape="rectangular"
        theme="outline"
        size="medium"
        auto_select={false}
        use_fedcm_for_button={false}
      />
    </div>
  );
};

export default GoogleLoginButton;
