import { LOGO_MARK } from "@/lib/logo";

type Props = {
  className?: string;
  animate?: boolean;
};

export default function WiseOSIcon({ className }: Props) {
  return (
    <img
      src={LOGO_MARK}
      alt="WiseOS"
      className={className}
    />
  );
}
