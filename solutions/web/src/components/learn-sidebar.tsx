"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  FolderOpen,
  Menu,
  X,
} from "lucide-react";
import { TRACKS } from "@/lib/curriculum";

const LEVEL_COLORS: Record<string, string> = {
  Beginner: "text-emerald-400 bg-emerald-400/10",
  Intermediate: "text-blue-400 bg-blue-400/10",
  Advanced: "text-amber-400 bg-amber-400/10",
  Expert: "text-rose-400 bg-rose-400/10",
};

interface LearnSidebarProps {
  existingFiles: string[];
}

export default function LearnSidebar({ existingFiles }: LearnSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeMilestone = pathname?.split("/").filter(Boolean).pop() ?? "";

  const initialOpenState = useMemo(
    () =>
      TRACKS.reduce(
        (acc, track) => ({
          ...acc,
          [track.id]:
            track.milestones.some((m) => m.slug === activeMilestone) ||
            track.id === "core",
        }),
        {} as Record<string, boolean>,
      ),
    [activeMilestone],
  );

  const [openTracks, setOpenTracks] =
    useState<Record<string, boolean>>(initialOpenState);

  useEffect(() => {
    setOpenTracks(initialOpenState);
  }, [initialOpenState]);

  const existingFilesSet = useMemo(
    () => new Set(existingFiles),
    [existingFiles],
  );

  const toggleTrack = (trackId: string) => {
    if (collapsed) {
      setCollapsed(false);
      setOpenTracks((prev) => ({
        ...prev,
        [trackId]: true,
      }));
    } else {
      setOpenTracks((prev) => ({
        ...prev,
        [trackId]: !prev[trackId],
      }));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-2 top-2 z-50 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card/95 text-foreground shadow-lg backdrop-blur sm:left-3 sm:top-3 sm:h-10 sm:w-10 lg:hidden"
        aria-label="Open course sections"
      >
        <Menu className="h-4 w-4" />
      </button>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close course sections"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 h-[100dvh] w-[86vw] max-w-sm border-r border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out lg:sticky lg:top-0 lg:h-full lg:translate-x-0 lg:bg-card/60 lg:self-start ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-20" : "lg:w-72"}`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border/40 px-2 py-2.5 sm:px-3 sm:py-3">
            <button
              type="button"
              onClick={() => setCollapsed((prev) => !prev)}
              className="hidden h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-background/70 text-muted-foreground transition-all duration-200 hover:bg-muted/50 hover:text-foreground sm:h-9 sm:w-9 lg:flex"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4 transition-transform duration-300" />
              ) : (
                <ChevronLeft className="h-4 w-4 transition-transform duration-300" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-background/70 text-muted-foreground transition hover:bg-muted/50 hover:text-foreground lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
            <div
              className={`flex min-w-0 items-center gap-1.5 pr-1 transition-all duration-300 sm:gap-2 ${
                collapsed
                  ? "pointer-events-none opacity-0 lg:hidden"
                  : "opacity-100"
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
              <span className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground sm:text-[11px]">
                Sections
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="space-y-2 p-2 sm:p-3">
              {TRACKS.map((track) => {
                const isOpen = openTracks[track.id] ?? false;
                return (
                  <div
                    key={track.id}
                    className="overflow-hidden rounded-2xl border border-border/40 bg-background/30"
                  >
                    <button
                      type="button"
                      onClick={() => toggleTrack(track.id)}
                      title={collapsed ? track.title : undefined}
                      className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition hover:bg-muted/40 sm:px-3 sm:py-2.5"
                    >
                      <track.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {!collapsed && (
                        <span className="flex-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-[11px]">
                          {track.title}
                        </span>
                      )}
                      {!collapsed && (
                        <span
                          className={`transition-transform duration-200 ${
                            isOpen ? "rotate-180" : "rotate-0"
                          }`}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      )}
                    </button>

                    {!collapsed && isOpen && (
                      <div className="overflow-hidden transition-all duration-300 ease-out">
                        <nav className="space-y-1 px-2 pb-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                          {track.milestones.map((m) => {
                            const exists = existingFilesSet.has(m.slug);
                            const isActive = activeMilestone === m.slug;
                            const levelColor = LEVEL_COLORS[m.level];
                            return (
                              <Link
                                key={m.slug}
                                href={exists ? `/learn/${m.slug}` : "#"}
                                onClick={() => setMobileOpen(false)}
                                className={`group flex items-start gap-2.5 rounded-xl px-2.5 py-2 transition-all duration-200 sm:gap-3 sm:px-3 sm:py-2.5 ${
                                  isActive
                                    ? "bg-primary/10 text-primary"
                                    : exists
                                      ? "hover:bg-muted/60 text-foreground"
                                      : "cursor-not-allowed opacity-40"
                                }`}
                              >
                                <span
                                  className={`mt-0.5 flex-shrink-0 ${
                                    isActive
                                      ? "text-primary"
                                      : "text-muted-foreground group-hover:text-primary"
                                  }`}
                                >
                                  <Circle className="h-3 w-3 fill-current sm:h-3.5 sm:w-3.5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium leading-snug sm:text-sm">
                                    {m.title}
                                  </p>
                                  <span
                                    className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide ${levelColor} sm:text-[9px]`}
                                  >
                                    {m.level}
                                  </span>
                                </div>
                              </Link>
                            );
                          })}
                        </nav>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
