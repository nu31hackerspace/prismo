import { Icon } from '@iconify/react';

interface Props {
  step: number;
  icon: string;
  title: string;
  description: string;
}

export default function StepCard({ step, icon, title, description }: Props) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative mb-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-primary transition-transform duration-300 hover:scale-110">
          <Icon icon={icon} className="h-8 w-8 text-background-primary" />
        </div>
        <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-background-primary font-display text-xs font-bold text-label-primary ring-2 ring-accent-primary">
          {step}
        </span>
      </div>
      <h3 className="mb-2 font-display text-lg font-bold text-label-primary">{title}</h3>
      <p className="max-w-xs text-sm leading-relaxed text-label-secondary">{description}</p>
    </div>
  );
}
