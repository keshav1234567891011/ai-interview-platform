"use client";
const groups = [
  { name: "User management", items: [["users.view", "View users"], ["users.manage", "Manage candidate accounts"]] },
  { name: "Interview support", items: [["interviews.view", "View interviews and schedules"]] },
  { name: "Resume support", items: [["resumes.view", "View resume metadata"]] },
  { name: "Analytics", items: [["analytics.view", "View application analytics"]] },
  { name: "Account support", items: [["support.manage", "Edit candidate display names"]] },
];
export function PermissionPicker({ value, onChange, disabled }: { value: string[]; onChange: (value: string[]) => void; disabled: boolean }) {
  return <div className="permission-grid">{groups.map(group => <fieldset key={group.name} disabled={disabled}><legend>{group.name}</legend>{group.items.map(([id, label]) => <label key={id}><input type="checkbox" checked={value.includes(id)} onChange={event => onChange(event.target.checked ? [...value, id] : value.filter(item => item !== id))} />{label}</label>)}</fieldset>)}<p className="fine-note">Viewing accounts requires View users. Permissions never grant owner, secret or administrator-management access.</p></div>;
}
