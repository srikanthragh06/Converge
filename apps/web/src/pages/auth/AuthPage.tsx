import { AUTH_CSRF_STATE } from "../../constants/constants";
import { FcGoogle } from "react-icons/fc";
import AuthScreen from "../../components/auth/AuthScreen";
import Logo from "../../components/ui/Logo";

/**
 * Sign-in page (pp 59 / 63): the Converge logo, "Sign in to get started",
 * and a Sign in with Google button that starts the OAuth flow by
 * redirecting to Google's authorisation endpoint.
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
        <AuthScreen>
            <h1 className="sr-only">Sign in to Converge</h1>
            <Logo size={44} className="sm:hidden" />
            <Logo size={64} className="hidden sm:inline-flex" />
            <p className="mt-8 text-base text-fg-secondary sm:mt-10 sm:text-lg">
                Sign in to get started
            </p>
            <button
                type="button"
                onClick={handleSignInWithGoogle}
                className="mt-7 flex cursor-pointer items-center gap-3 rounded-lg border border-line-strong bg-surface-elevated px-6 py-3 text-base font-medium text-fg shadow-sm shadow-shadow outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-gold/60"
            >
                <FcGoogle className="h-5 w-5 shrink-0" />
                Sign in with Google
            </button>
        </AuthScreen>
    );
};

export default AuthPage;
