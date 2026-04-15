import { type ReactNode } from "react";

/**
 * Full-viewport page shell shared across all top-level routes. Renders a
 * full-screen flex column container with horizontal overflow clipped, and
 * accepts optional Tailwind classes and children.
 */
const Page = ({
    className = "",
    children,
}: {
    className?: string;
    children?: ReactNode;
}) => {
    return (
        <div
            className={`w-screen h-screen flex flex-col overflow-x-hidden ${className}`}
        >
            {children}
        </div>
    );
};

export default Page;
