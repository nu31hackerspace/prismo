import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

const githubUrl = "https://github.com/nu31hackerspace/prismo";
const instructionUrl = "https://github.com/nu31hackerspace/prismo";

const features = [
  {
    icon: "mdi:open-source-initiative",
    title: "Open Source",
    description:
      "Fully open hardware and software. PCB schematics, firmware, and tools — everything is free and available on GitHub.",
  },
  {
    icon: "mdi:nfc-variant",
    title: "NFC / RFID Access",
    description:
      "Control doors and machines with NFC/RFID cards. Add or revoke access for users in seconds.",
  },
  {
    icon: "mdi:account-school",
    title: "Beginner Friendly",
    description:
      "Designed as a first soldering project. No special tools, no paid software, no expert knowledge required.",
  },
  {
    icon: "mdi:currency-usd-off",
    title: "Low Cost",
    description:
      "All components are off-the-shelf and affordable. Single-layer PCB can be made with CNC or toner-transfer.",
  },
  {
    icon: "mdi:wifi",
    title: "Wi-Fi Provisioning",
    description:
      "First boot creates a hotspot. Connect, open prismo.local, enter your Wi-Fi credentials — done.",
  },
  {
    icon: "mdi:chip",
    title: "ESP32-C3 Powered",
    description:
      "Built on MicroPython with frozen firmware. Flash directly from your browser — no IDE needed.",
  },
];

const steps = [
  {
    icon: "mdi:flash",
    title: "Flash",
    description:
      "Flash the firmware to your ESP32-C3 board directly from the browser using our web flasher.",
  },
  {
    icon: "mdi:wifi-cog",
    title: "Provision",
    description:
      "Connect to the Prismo hotspot, open prismo.local, and enter your Wi-Fi credentials and configuration.",
  },
  {
    icon: "mdi:lock-open-check",
    title: "Use",
    description:
      "Tap your NFC/RFID card to open doors or activate machines. Manage access from the web interface.",
  },
];

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex flex-col rounded-2xl border border-separator-secondary bg-surface p-6 transition-colors hover:border-separator-primary">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-fill-secondary text-label-secondary">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <h3 className="mb-2 font-semibold text-lg text-label-primary">{title}</h3>
      <p className="text-sm leading-relaxed text-label-secondary">{description}</p>
    </div>
  );
}

function StepCard({ step, icon, title, description }: { step: number; icon: string; title: string; description: string }) {
  return (
    <div className="relative">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-fill-secondary text-label-primary">
        <Icon name={icon} className="h-8 w-8" />
      </div>
      <div className="absolute -top-3 -left-3 flex h-8 w-8 items-center justify-center rounded-full border-4 border-background-primary bg-accent-primary font-bold text-white text-xs">
        {step}
      </div>
      <h3 className="mb-3 font-semibold text-xl text-label-primary">{title}</h3>
      <p className="text-base leading-relaxed text-label-secondary">{description}</p>
    </div>
  );
}

export default function Landing() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  const redirectUri = `${window.location.origin}/google/callback`;
  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=openid email profile&prompt=consent`;

  return (
    <>
      {/* Header */}
      <header className="fixed top-0 right-0 left-0 z-50 border-b border-separator-secondary bg-background-primary/80 backdrop-blur-lg">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xl font-bold tracking-tight text-label-primary">
            prismo
          </Link>
          <div className="flex items-center gap-3">
            <Button tag="landing_header_instruction" variant="ghost" size="sm" icon="mdi:clipboard-list-outline" href={instructionUrl}>
              Instruction
            </Button>
            <Button tag="landing_header_github" variant="ghost" size="sm" icon="mdi:github" href={githubUrl} className="hidden sm:inline-flex">
              GitHub
            </Button>
            <Button tag="landing_header_sign_in" variant="primary" size="md" icon="mdi:google" href={googleAuthUrl}>
              Sign In
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgb(0,0,0) 1px, transparent 1px), linear-gradient(90deg, rgb(0,0,0) 1px, transparent 1px)",
            backgroundSize: "60px 60px"
          }}
        ></div>

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-separator-secondary bg-fill-tertiary px-4 py-1.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent-primary"></span>
            <span className="text-xs font-bold tracking-wide text-label-secondary uppercase">
              Pre-release — In Active Development
            </span>
          </div>

          <h1 className="mb-6 text-4xl leading-tight font-bold tracking-tight text-label-primary md:text-6xl md:leading-tight">
            Open-source access control
            <br />
            <span className="text-label-tertiary">for hackerspaces</span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-label-secondary">
            Prismo is a simple NFC/RFID device that lets you control access to doors and machines. Easy to
            build, free to use, and friendly for beginners.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button tag="landing_hero_login_to_flash" variant="primary" size="md" className="px-8 py-6 text-lg" icon="mdi:flash" href={googleAuthUrl}>
              Login to Flash Firmware
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-label-primary md:text-4xl">
              Built for makerspaces
            </h2>
            <p className="mx-auto max-w-xl text-base text-label-secondary">
              Everything you need to set up access control — simple hardware, free software, and a
              community-driven approach.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-t border-b border-separator-secondary py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-14 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-label-primary md:text-4xl">
              Up and running in minutes
            </h2>
            <p className="mx-auto max-w-xl text-base text-label-secondary">
              Three steps from unboxing to a working access point.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
            {steps.map((step, i) => (
              <StepCard key={step.title} step={i + 1} {...step} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="rounded-3xl border border-separator-secondary bg-fill-tertiary p-12 md:p-16">
            <Icon name="mdi:open-source-initiative" className="mx-auto mb-6 h-12 w-12 text-label-primary" />
            <h2 className="mb-4 text-3xl font-bold tracking-tight text-label-primary md:text-4xl">
              Join the project
            </h2>
            <p className="mx-auto mb-8 max-w-lg text-base leading-relaxed text-label-secondary">
              Prismo is built in the open. Contribute code, improve hardware designs, report bugs, or just
              star the repo — every bit helps.
            </p>
            <Button tag="landing_cta_github" variant="primary" size="md" icon="mdi:github" href={githubUrl}>
              View on GitHub
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-separator-secondary py-8">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <span className="text-sm font-bold text-label-tertiary"> prismo </span>
            <div className="flex items-center gap-6">
              <a href={githubUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-label-tertiary transition-colors hover:text-label-primary">
                GitHub
              </a>
              <a href={instructionUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-label-tertiary transition-colors hover:text-label-primary">
                Instruction
              </a>
              <Link to="/system/design-system" className="text-sm text-label-tertiary transition-colors hover:text-label-primary">
                Design System
              </Link>
            </div>
            <span className="text-xs text-label-tertiary"> open source · MIT license </span>
          </div>
        </div>
      </footer>
    </>
  );
}
