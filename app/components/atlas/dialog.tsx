"use client";
import { useEffect, useRef } from "react";
import { Icon } from "./icon";
export function Dialog({ title, onClose, children, className = "" }: { title: string; onClose: () => void; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); dialog?.querySelector<HTMLInputElement>("input")?.focus(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={`atlas-dialog ${className}`} aria-label={title} onCancel={e => { e.preventDefault(); onClose(); }}><header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></header>{children}</dialog>;
}
