const AuthPage = () => {
    const handleSignInWithGoogle = () => {
        const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!GOOGLE_CLIENT_ID) {
            throw new Error("Google client id doesn't exist");
        }

        const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/auth";

        const state = btoa(
            String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
        );

        localStorage.setItem("authCSRFState", state);

        const params = new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            redirect_uri: `${window.location.origin}/auth/callback`,
            response_type: "code",
            access_type: "offline",
            scope: "openid email profile",
            prompt: "consent",
            state,
        });

        window.location.assign(`${GOOGLE_AUTH_URL}?${params}`);
    };

    return (
        <div className="w-screen h-screen flex flex-col items-center justify-center">
            <button
                className="text-lg px-3 py-2 cursor-pointer"
                onClick={handleSignInWithGoogle}
            >
                Sign in with Google
            </button>
        </div>
    );
};

export default AuthPage;
