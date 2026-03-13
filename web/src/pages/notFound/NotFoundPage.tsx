// NotFoundPage: shown for any URL that doesn't match a known route,
// or when the documentId URL param is not a valid positive integer.
function NotFoundPage() {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#1f1f1f] text-zinc-400">
            <p className="text-2xl font-semibold text-zinc-200">404</p>
            <p className="mt-2 text-sm">Page not found</p>
        </div>
    );
}

export default NotFoundPage;
