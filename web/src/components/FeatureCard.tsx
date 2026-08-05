import { Icon } from '@iconify/react';

interface Props {
  icon: string;
  title: string;
  description: string;
}

export default function FeatureCard({ icon, title, description }: Props) {
  return (
    <div className="group rounded-2xl border border-separator-secondary bg-fill-tertiary p-6 transition-all duration-300 hover:border-separator-primary hover:shadow-lg">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-primary transition-transform duration-300 group-hover:scale-110">
        <Icon icon={icon} className="h-6 w-6 text-background-primary" />
      </div>
      <h3 className="mb-2 font-display text-lg font-bold text-label-primary">{title}</h3>
      <p className="text-sm leading-relaxed text-label-secondary">{description}</p>
    </div>
  );
}
