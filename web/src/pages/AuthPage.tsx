// AuthPage: login page for Google OAuth.

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
        <div className="flex flex-col items-center justify-center h-screen bg-[#1f1f1f] text-zinc-400">
            <p className="text-2xl font-semibold text-zinc-200 mb-2">
                Converge
            </p>
            <p className="mb-8 text-sm">Sign in to start collaborating</p>
            <button
                onClick={handleSignInWithGoogle}
                className="flex items-center gap-3 px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-lg transition-colors"
            >
                Sign in with Google
            </button>
        </div>
    );
}

export default AuthPage;
