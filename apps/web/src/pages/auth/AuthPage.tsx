import Page from "../../components/Page";
import { AUTH_CSRF_STATE } from "../../constants/constants";
import { FcGoogle } from "react-icons/fc";
import lockupWhite from "/lockup-white.svg";

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
        <Page className="space-y-8 items-center justify-center">
            <img
                src={lockupWhite}
                alt="Converge"
                className="w-[360px] sm:w-[720px] ml-[120px] sm:ml-[200px]"
            />
            <p className="sm:text-lg text-base text-center text-white max-w-[250px] sm:max-w-[800px]">
                Sign in to get started
            </p>
            <button
                className="flex items-center gap-3 px-5 py-3 rounded-lg cursor-pointer
                            bg-white text-zinc-700 shadow-sm border border-zinc-200
                            hover:shadow-md transition-shadow duration-150"
                onClick={handleSignInWithGoogle}
            >
                <FcGoogle className="sm:w-6 sm:h-6 w-3 h-3 shrink-0" />
                <span className=" text-sm sm:text-lg font-medium">
                    Sign in with Google
                </span>
            </button>
        </Page>
    );
};

export default AuthPage;
