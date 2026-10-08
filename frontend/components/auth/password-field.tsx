"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function PasswordField({ name, label, id = name, current = false, disabled = false }: { name: string; label: string; id?: string; current?: boolean; disabled?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <div className="field"><label htmlFor={id}>{label}</label><div className="password-field"><input id={id} name={name} type={visible ? "text" : "password"} autoComplete={current ? "current-password" : "new-password"} minLength={current ? 1 : 10} maxLength={128} required disabled={disabled} /><button type="button" className="icon-button" onClick={() => setVisible(!visible)} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} disabled={disabled}>{visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button></div></div>;
}
