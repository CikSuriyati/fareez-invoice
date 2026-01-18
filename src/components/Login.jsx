import { useState } from 'react';
import './Login.css';

function Login({ onLoginSuccess }) {
    const [isChecking, setIsChecking] = useState(false);

    const handleContinue = async () => {
        setIsChecking(true);

        // Try to access the API - backend will check email
        try {
            const baseUrl = (import.meta.env.VITE_API_URL || 'https://script.google.com/macros/s/REDACTED_SECRET_7/exec').split('?')[0];
            const response = await fetch(`${baseUrl}?action=getDashboardStats&period=MONTH`);

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
                    Welcome! Please ensure you're logged into Google with an authorized account.
                </p>

                <div className="login-instructions">
                    <p><strong>To proceed:</strong></p>
                    <ol>
                        <li>Make sure you're logged into Google in this browser</li>
                        <li>Your email must be in the authorized users list</li>
                        <li>Click "Check Access" below</li>
                    </ol>
                </div>

                <button
                    onClick={handleContinue}
                    disabled={isChecking}
                    className="continue-button"
                >
                    {isChecking ? 'Checking...' : 'Check Access'}
                </button>

                <div className="login-footer">
                    <p>🔒 Authorized users only</p>
                    <p className="footer-note">
                        Contact admin if you need access
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Login;
