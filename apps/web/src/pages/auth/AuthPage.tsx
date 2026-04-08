import { AUTH_CSRF_STATE } from "../../constants/constants";

/**
 * Landing page that initiates the Google OAuth flow. Renders a sign-in button
 * and handles the redirect to Google's authorisation endpoint.
 */
const AuthPage = () => {
    /**
     * Generates a CSRF state token, stores it in localStorage, then redirects
     * the browser to Google's OAuth authorisation endpoint.
     */
    const handleSignInWithGoogle = () => {
        const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!GOOGLE_CLIENT_ID) {
            throw new Error("Google client id doesn't exist");
        }

        const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/auth";

        // Generate a random CSRF state token to validate the callback and prevent CSRF attacks.
        const state = btoa(
            String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))),
        );

        localStorage.setItem(AUTH_CSRF_STATE, state);

        // Build the Google OAuth redirect URL with all required parameters.
        const params = new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            redirect_uri: `${window.location.origin}/auth/callback`,
            response_type: "code",
            access_type: "offline",
            scope: "openid email profile",
            state,
        });

        window.location.assign(`${GOOGLE_AUTH_URL}?${params}`);
    };

    return (
        <div className="w-screen h-screen flex flex-col items-center justify-center">
            <h1 className="sm:text-6xl text-4xl font-normal tracking-tight text-text-primary font-montserrat">
                Converge
            </h1>
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
