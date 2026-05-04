type Props = { wordmark: string };

/** Product wordmark beside the logo; app switching uses `EcosystemAppSwitcher` (top right). */
export function EcosystemProductBrand({ wordmark }: Props) {
  return <span className="text-lg font-semibold tracking-tight text-portal-ink">{wordmark}</span>;
}
