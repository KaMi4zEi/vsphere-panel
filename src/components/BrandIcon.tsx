type BrandIconProps = {
  size: number;
  className?: string;
};

export default function BrandIcon({ size, className }: BrandIconProps) {
  return (
    <img
      className={className}
      src="/api/favicon"
      alt=""
      width={size}
      height={size}
      draggable={false}
      style={{ width: size, height: size, objectFit: "contain", borderRadius: Math.max(4, Math.round(size * 0.2)), flexShrink: 0 }}
    />
  );
}
