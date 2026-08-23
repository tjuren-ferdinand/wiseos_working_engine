type Props = {
  className?: string;
  animate?: boolean;
};

export default function WiseOSIcon({ className }: Props) {
  return (
    <img
      src="/dashboard_logo.jpg"
      alt="WiseOS"
      className={className}
    />
  );
}
