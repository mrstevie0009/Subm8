import * as React from 'react';

type IconProps = React.SVGProps<SVGSVGElement> & {
  size?: number | string;
  color?: string;
  children: React.ReactNode; // <path> / <rect> …
};

export function Icon({ size = 24, color = 'currentColor', children, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      style={{ color }}
      {...rest}
    >
      {children}
    </svg>
  );
}
