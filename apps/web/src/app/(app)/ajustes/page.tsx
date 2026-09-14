import type { Metadata } from "next";
import { AccountPanel } from "@/features/settings/ui/account-panel";
import { CatalogAttribution } from "@/features/settings/ui/catalog-attribution";
import { DataControls } from "@/features/settings/ui/data-controls";
import { Moulding } from "@/shared/ui/moulding";
import { SectionHeading } from "@/shared/ui/section-heading";
import { ThemeToggle } from "@/shared/ui/theme-toggle";

export const metadata: Metadata = { title: "Ajustes" };

/**
 * The four blocks docs/screens.md fixes for /ajustes: account, theme, your own
 * data, and credit to the external catalogs.
 *
 * No mockup exists for this screen, so it is composed out of pieces that are
 * already closed rather than invented from scratch: the page title pattern of
 * /actividad and /miembros, `SectionHeading` per block, the neutral card
 * (`rounded-xl border border-border bg-surface`), and the moulding as the
 * separator between blocks with a life of their own
 * (docs/design.md#criterio-de-extensión-para-pantallas-sin-maqueta).
 *
 * It is protected by omission: `shared/lib/routes.ts` lists what is public,
 * and /ajustes is deliberately not there.
 */
export default function SettingsPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Ajustes</h1>
        <p className="max-w-[62ch] text-ink-muted text-pretty">
          Tu cuenta, el aspecto de la aplicación y lo que puedes hacer con lo
          que has escrito.
        </p>
      </div>

      <div className="space-y-4">
        <SectionHeading
          title="Cuenta"
          description="Tu correo, tu contraseña y cómo entras. Lo gestiona Clerk, que es quien guarda esos datos."
        />
        <AccountPanel />
      </div>

      <Moulding />

      <div className="space-y-4">
        <SectionHeading
          title="Tema"
          description="Freak Hub nació oscura y sigue siéndolo por defecto."
        />
        <div className="rounded-xl border border-border bg-surface p-5">
          <ThemeToggle />
        </div>
      </div>

      <Moulding />

      <div className="space-y-4">
        <SectionHeading
          title="Tus datos"
          description="Lo que escribes aquí es tuyo: puedes llevártelo y puedes borrarlo."
        />
        <DataControls />
      </div>

      <Moulding />

      <div className="space-y-4">
        <SectionHeading
          title="De dónde salen las fichas"
          description="Las portadas, las sinopsis y las fechas vienen de catálogos que mantiene otra gente."
        />
        <CatalogAttribution />
      </div>
    </section>
  );
}
