import { messages } from "@/lib/i18n";
import { sanitizeSvg } from "@/lib/svg";
import type { MethodMatch as MethodMatchData } from "@/lib/ai/schemas";
import { Label } from "@/components/ui";

/**
 * The parent's algorithm and the curriculum's model, side by side.
 *
 * Both columns are presented as correct, because both are. The whole feature
 * exists to stop the conversation that starts "that's not how you do it" and
 * ends with a child who thinks one of the two adults is wrong.
 */
export default function MethodMatch({
  data,
  locale = null,
}: {
  data: MethodMatchData;
  /* A server component inside the packet, so the locale arrives as a prop.
     Null means English, which is what an anonymous parent gets. */
  locale?: string | null;
}) {
  const t = messages(locale);
  const svg = sanitizeSvg(data.schoolMethod.svg);

  return (
    <div>
      <div className="pp-method-grid">
        <div>
          <Label>{t.packet.yourMethodLabel}</Label>
          <h3 style={{ marginBottom: 12, fontSize: "1.05rem" }}>{data.parentMethod.title}</h3>
          <ol className="pp-method-steps">
            {data.parentMethod.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="pp-method-rule" aria-hidden="true" />

        <div>
          <Label>{t.packet.schoolMethodLabel}</Label>
          <h3 style={{ marginBottom: 12, fontSize: "1.05rem" }}>{data.schoolMethod.title}</h3>
          <ol className="pp-method-steps">
            {data.schoolMethod.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </div>

      {svg && (
        <div
          className="pp-diagram"
          style={{ marginTop: 26, borderTop: "1px solid var(--rule)", paddingTop: 22 }}
          // Sanitised by lib/svg.ts: allowlisted tags and attributes only, no
          // script, no external references, no gradients, no rounded corners.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}

      {data.bothValid && (
        <p style={{ marginTop: 22, fontSize: 15, color: "var(--muted)" }}>{t.packet.bothCorrect}</p>
      )}

      {data.whySchoolWay && (
        <p style={{ marginTop: 12, fontSize: 16 }}>{data.whySchoolWay}</p>
      )}
    </div>
  );
}
