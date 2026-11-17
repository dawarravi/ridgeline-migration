// Same generated "photo" as the legacy store, so the two look comparable.
export function ProductArt({ name, color }: { name: string; color: string }) {
  return (
    <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={name}>
      <rect width="400" height="400" fill="#f1f5f9" />
      <path
        d="M120 110 L170 80 L230 80 L280 110 L320 170 L285 190 L270 165 L270 330 L130 330 L130 165 L115 190 L80 170 Z"
        fill={color}
      />
    </svg>
  )
}
