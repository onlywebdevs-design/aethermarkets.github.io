import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold tracking-wide transition-opacity disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        gold: "gold-box hover:opacity-90",
        purple: "bg-purple text-fg hover:opacity-90",
        buy: "bg-buy text-ink hover:opacity-90",
        sell: "bg-sell text-fg hover:opacity-90",
        ghost: "border border-line bg-surface text-fg hover:bg-surface-2",
        quiet: "bg-transparent text-muted hover:text-fg",
      },
      size: {
        md: "min-h-11",
        sm: "min-h-10 px-4 py-2 text-xs",
        lg: "min-h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "gold", size: "md" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, ...props }: Props) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
