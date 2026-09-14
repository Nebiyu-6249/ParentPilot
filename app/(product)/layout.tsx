import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { ChevronIcon } from "@/components/icons";
import { copy } from "@/lib/copy";

/**
 * The pages a parent reaches from inside the product.
 *
 * Settings, the account, history, setup, a recap, a finished-work check: none
 * of these is a marketing page, and until now they all wore the teal frame and
 * the site nav. Tapping "Account" in the thread dropped the parent onto a page
 * advertising the thing they were already using.
 *
 * So this is the third surface, and it is the chat surface's own: the same
 * ground, the same face, the same accent. `.pp-product` in globals.css points
 * the sheet tokens these pages were written against at the app palette, which
 * restyles them without rewriting them. The chrome is one line: the way back.
 */
export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pp-product">
      <header className="pp-product-bar">
        <a href="/app" className="pp-product-back">
          <ChevronIcon size={16} direction="left" />
          {copy.nav.backToThread}
        </a>

        <a href="/" aria-label={copy.brand.name} style={{ textDecoration: "none" }}>
          <Logo size={20} on="app" />
        </a>

        <ThemeToggle />
      </header>

      {children}
    </div>
  );
}
