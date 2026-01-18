import { useState } from 'react';
import './Login.css';

function Login({ onLoginSuccess }) {
    const [isChecking, setIsChecking] = useState(false);

    const handleContinue = async () => {
        setIsChecking(true);

        // Try to access the API - backend will check email
        try {
            const response = await fetch(
                import.meta.env.VITE_API_URL ||
                'https://script.google.com/macros/s/REDACTED_SECRET_2/exec?action=getDashboardStats&period=MONTH'
            );

            const result = await response.json();

            if (result.code === 401 || result.error) {
                alert('⚠️ Unauthorized Access\n\nYou are not logged in with an authorized Google account.\n\nPlease:\n1. Make sure you\'re logged into Google in this browser\n2. Use an authorized account\n3. Contact admin for access');
                setIsChecking(false);
            } else {
                // Success - user is authorized
                localStorage.setItem('user_checked', 'true');
                onLoginSuccess({ email: 'authorized_user' });
            }
        } catch (error) {
            console.error('Access check error:', error);
            alert('Cannot connect to server. Please check:\n1. Are you connected to internet?\n2. Is Code.gs deployed in Google Apps Script?');
            setIsChecking(false);
        }
    };

    return (
        <div className="login-overlay">
            <div className="login-card">
                <div className="logo-section">
                    <div className="text-logo">FF</div>
                    <h1>Fareez Invoice System</h1>
                </div>

                <p className="login-subtitle">
                    Sign in to continue
                </p>

                <button
                    onClick={handleContinue}
                    disabled={isChecking}
                    className="continue-button"
                >
                    {isChecking ? 'Checking...' : 'Check Access'}
                </button>

                <div className="login-footer">
                    <p className="footer-note">Authorized users only</p>
                </div>
            </div>
        </div>
    );
}

export default Login;
