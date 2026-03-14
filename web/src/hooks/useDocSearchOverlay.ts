// useDocSearchOverlay: encapsulates all state, refs, and effects for DocSearchOverlay.
// Manages open/close state, document search results, keyboard navigation, and the
// Ctrl+P shortcut. Returns everything the overlay component needs to render.

import { useAtom, useSetAtom } from "jotai";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useDocumentSearch from "./useDocumentSearch";
import { isDocSearchOpenAtom } from "../atoms/uiAtoms";

const useDocSearchOverlay = () => {
    const navigate = useNavigate();

    // Driven by isDocSearchOpenAtom — toggled by Ctrl+P and closed by Escape/backdrop.
    const [isOpen, setIsOpen] = useAtom(isDocSearchOpenAtom);

    const { query, setQuery, documents, isLoading } = useDocumentSearch();

    // Ref for the search input — used to auto-focus when the overlay opens.
    const inputRef = useRef<HTMLInputElement>(null);

    // Refs for each result row — used to scroll the focused item into view.
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    // Which item is keyboard-focused (-1 = none).
    const [focusedIndex, setFocusedIndex] = useState(-1);

    // Only show the skeleton after 300ms — prevents a flash on fast fetches.
    const [showSkeleton, setShowSkeleton] = useState(false);

    // Write-only setter for the Ctrl+P toggle effect — useSetAtom avoids subscribing
    // the effect closure to atom changes, preventing unnecessary re-runs.
    const setIsDocSearchOpen = useSetAtom(isDocSearchOpenAtom);

    const handleSelectDoc = (id: number) => {
        navigate(`/note/${id}`);
        setIsOpen(false);
    };

    // Only show the loading skeleton after 300ms — prevents a flash on fast fetches.
    useEffect(() => {
        if (!isOpen) return;

        if (!isLoading) {
            setShowSkeleton(false);
            return;
        }
        const timer = setTimeout(() => setShowSkeleton(true), 300);
        return () => clearTimeout(timer);
    }, [isLoading, isOpen]);

    // Reset focused item whenever the result list changes.
    useEffect(() => {
        if (!isOpen) return;
        setFocusedIndex(-1);
    }, [documents, isOpen]);

    // Scroll the focused item into view when the index changes.
    useEffect(() => {
        if (!isOpen) return;
        if (focusedIndex >= 0)
            itemRefs.current[focusedIndex]?.scrollIntoView({
                block: "nearest",
            });
    }, [focusedIndex, isOpen]);

    // Auto-focus the input when the overlay opens; clear query and focus on close.
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 75);
        } else {
            setQuery("");
            setFocusedIndex(-1);
        }
    }, [isOpen]);

    // Keyboard: Escape closes, ArrowDown/Up moves focus, Enter selects.
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsOpen(false);
                return;
            }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setFocusedIndex((prev) =>
                    Math.min(prev + 1, documents.length - 1),
                );
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setFocusedIndex((prev) => Math.max(prev - 1, 0));
                return;
            }
            if (
                e.key === "Enter" &&
                focusedIndex >= 0 &&
                documents[focusedIndex]
            ) {
                e.preventDefault();
                handleSelectDoc(documents[focusedIndex]!.id);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [documents, focusedIndex, isOpen]);

    // Ctrl+P / Cmd+P toggles this overlay; prevents the browser's print dialog.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "p") {
                e.preventDefault();
                setIsDocSearchOpen((prev) => !prev);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    return {
        isOpen,
        setIsOpen,
        inputRef,
        query,
        setQuery,
        showSkeleton,
        documents,
        focusedIndex,
        setFocusedIndex,
        itemRefs,
        handleSelectDoc,
    };
};

export default useDocSearchOverlay;
