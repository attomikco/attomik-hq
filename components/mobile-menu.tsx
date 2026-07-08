"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

/**
 * Mobile navigation drawer control. The drawer/overlay styling lives in
 * globals.css and reacts to `body.sidebar-open`; this component renders the
 * hamburger + overlay and manages that class. Hidden on desktop via CSS
 * (.mobile-menu-btn is display:none until <=768px).
 */
export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Reflect open state on <body> so the CSS drawer + overlay react.
  useEffect(() => {
    document.body.classList.toggle("sidebar-open", open);
    return () => document.body.classList.remove("sidebar-open");
  }, [open]);

  // Close the drawer when the route changes (a nav link was tapped).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        className="mobile-menu-btn"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
      </button>
      <div
        className="sidebar-overlay"
        onClick={() => setOpen(false)}
        aria-hidden
      />
    </>
  );
}
