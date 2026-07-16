import { MessageCircle, ShieldCheck, Store, WifiOff } from 'lucide-react';

const HIGHLIGHTS = [
  {
    icon: Store,
    title: 'One login, every business',
    description: 'Run a cafe, a pharmacy, and a tiffin center from a single dashboard.',
  },
  {
    icon: WifiOff,
    title: 'Offline-first billing',
    description: "Keeps taking orders when the internet doesn't, and syncs when it's back.",
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp billing built in',
    description: 'Send GST-ready bills straight to a customer, no extra app needed.',
  },
  {
    icon: ShieldCheck,
    title: 'PIN login for the counter',
    description: 'Staff sign in fast with a 6-digit PIN — no passwords to forget.',
  },
];

/**
 * Left-hand brand/marketing panel for the login screen — matches the
 * split-layout pattern common to production admin tools (and Metronic's own
 * auth screens): one side sells the product, the other side is a plain,
 * single-shade form. Everything here is deliberately centered (logo,
 * headline, highlights, footer) so the panel reads as one calm column
 * rather than a left-aligned wall of text. Not a shared component — this
 * copy is specific to the login screen only (docs/coding-standards.md §4).
 */
export function LoginMarketingPanel() {
  return (
    <div className="relative hidden w-1/2 flex-col items-center justify-center overflow-y-auto bg-navy-deep px-12 py-10 text-center text-white lg:flex">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(600px circle at 15% 20%, rgba(255,107,43,0.18), transparent 60%), radial-gradient(500px circle at 85% 85%, rgba(26,95,212,0.18), transparent 60%)',
        }}
        aria-hidden="true"
      />

      <div className="relative flex max-w-md flex-col items-center">
        <Logo />

        <p className="mt-10 font-display text-3xl font-black leading-tight tracking-tight">
          Every business.
          <br />
          One flow.
        </p>
        <p className="mx-auto mt-4 max-w-sm text-sm text-white/50">
          POSCountr is the business operating system for small Indian businesses — billing,
          inventory, and staff, all under one subscription.
        </p>

        <div className="mt-9 flex w-full flex-col items-stretch gap-5">
          {HIGHLIGHTS.map((item) => (
            <div
              key={item.title}
              className="flex items-center gap-3 rounded-control bg-white/5 px-4 py-3 text-left"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-white/10 text-brand-light">
                <item.icon size={18} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-0.5 text-xs leading-snug text-white/45">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="relative mt-9 text-[11px] text-white/30">
          Built for kiranas, cafes, pharmacies, and tiffin centers across India.
        </p>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="relative flex items-center gap-3">
      <svg width="44" height="44" viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <rect width="100" height="100" rx="24" fill="#111830" />
        <path
          d="M66 22 L30 22 Q18 22 18 34 L18 68 Q18 76 28 76"
          stroke="#5DA0FF"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <rect x="31" y="36" width="34" height="7" rx="3.5" fill="white" opacity="0.88" />
        <circle cx="70" cy="76" r="13" fill="#FF6B2B" />
        <circle cx="70" cy="76" r="6" fill="white" />
      </svg>
      <span className="font-display text-xl font-black tracking-tight">
        <span className="text-white">POS</span>
        <span className="text-brand">C</span>
        <span className="text-white/30">ountr</span>
      </span>
    </div>
  );
}
