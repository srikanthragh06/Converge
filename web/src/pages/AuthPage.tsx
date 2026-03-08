// AuthPage: login page for Google OAuth.

import { FcGoogle } from "react-icons/fc";
import { supabase } from "../lib/supabase";

// Shown at /auth — users click "Sign in with Google" to begin the OAuth flow.
function AuthPage() {
    const handleSignInWithGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#1f1f1f] text-zinc-400 gap-10">
            <p className="text-4xl font-extrabold text-zinc-200 mb-2">
                Converge
            </p>
            {/* <p className="mb-8 text-sm">Sign in to start collaborating</p> */}
            <button
                onClick={handleSignInWithGoogle}
                className="flex items-center gap-3 px-5 py-3 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 text-sm font-medium rounded-lg shadow transition-colors cursor-pointer"
            >
                <FcGoogle size={20} />
                Sign in with Google
            </button>
        </div>
    );
}

export default AuthPage;
