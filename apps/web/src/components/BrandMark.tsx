// MyAnalyst logomark — the rising blue arrow/chart mark. Served from /logo.png (a square, white-tile
// rendering of the brand logo) so it reads cleanly on both light and dark surfaces. The `className`
// controls the size; the image is square, so object-cover keeps it crisp without distortion.
export function BrandMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="MyAnalyst logo"
      width={512}
      height={512}
      className={`${className} rounded-[24%] object-cover ring-1 ring-black/10 dark:ring-white/10`}
    />
  );
}
