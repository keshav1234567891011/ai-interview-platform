import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  children,
  centered = false,
  titleId,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  centered?: boolean;
  titleId?: string;
}) {
  return (
    <div className={`section-heading ${centered ? "centered" : ""}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={titleId}>{title}</h2>
      {children && <p className="section-description">{children}</p>}
    </div>
  );
}
