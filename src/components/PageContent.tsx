import Link from "next/link";
import type { EditablePage } from "@/lib/site";

/** Admin-editable hero banner. Renders nothing when no image is set. */
export function PageHeroImage({ page }: { page: EditablePage }) {
  if (!page.heroImage) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={page.heroImage}
      alt=""
      style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 16, marginBottom: 20 }}
    />
  );
}

/** Admin-editable FAQ block. Renders nothing when the page has no FAQs. */
export function PageFaqList({ page, title = "Frequently asked questions" }: { page: EditablePage; title?: string }) {
  if (!page.faqs || page.faqs.length === 0) return null;
  return (
    <section style={{ marginTop: 40 }}>
      <h2 style={{ fontSize: 22, margin: "0 0 16px" }}>{title}</h2>
      <div style={{ display: "grid", gap: 12 }}>
        {page.faqs.map((f) => (
          <div key={f.q} className="bm-faq-item">
            <h3>{f.q}</h3>
            <p>{f.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Admin-editable CTA button. Renders nothing when no label is set. */
export function PageCta({ page, fallbackHref = "/", fallbackLabel = "" }: { page: EditablePage; fallbackHref?: string; fallbackLabel?: string }) {
  const label = page.ctaLabel || fallbackLabel;
  if (!label) return null;
  return (
    <div style={{ marginTop: 28 }}>
      <Link href={page.ctaHref || fallbackHref} className="bm-btn bm-btn-primary">
        {label}
      </Link>
    </div>
  );
}
