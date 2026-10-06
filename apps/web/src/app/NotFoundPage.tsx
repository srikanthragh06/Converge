import AuthScreen from "@/features/auth/components/AuthScreen";
import { LogoMark } from "@/components/common/Logo";

/**
 * Rendered when no route matches the current URL. The mockup has no
 * not-found page, so it keeps its content ("404", "Page not found") on the
 * same backdrop as the sign-in and authentication screens.
 */
const NotFoundPage = () => (
    <AuthScreen>
        <LogoMark size={34} className="text-fg-muted" />
        <h1 className="mt-8 font-serif text-6xl font-medium text-fg">404</h1>
        <p className="mt-2 text-base text-fg-secondary">Page not found</p>
    </AuthScreen>
);

export default NotFoundPage;
