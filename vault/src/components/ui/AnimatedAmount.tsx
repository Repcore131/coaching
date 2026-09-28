import { formatEuro } from '../../domain/money';
import { useCountUp } from '../../hooks/useCountUp';

interface Props {
  cents: number;
  round?: boolean;
  sign?: boolean;
  className?: string;
}

/** Montant qui défile jusqu'à sa valeur. Le lecteur d'écran lit la valeur finale. */
export function AnimatedAmount({ cents, round, sign, className }: Props) {
  const v = useCountUp(cents);
  const final = formatEuro(cents, { round, sign });
  return (
    <span className={className} aria-label={final}>
      <span aria-hidden="true">{formatEuro(v, { round, sign })}</span>
    </span>
  );
}
