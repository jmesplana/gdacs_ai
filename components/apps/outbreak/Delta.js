import { deltaTrend } from '../../../lib/outbreak/response';
import { formatValue } from '../../../lib/outbreak/data';
import styles from './outbreak.module.css';

// Directional change indicator. `rising` sets which direction is styled as concerning:
// for case counts an increase is adverse (rising=true); for response coverage a decrease is (rising=false).
const GLYPH = { up: '▲', down: '▼', flat: '▬', none: '·' };

export default function Delta({ delta, rising = true, suffix = '' }) {
  const trend = deltaTrend(delta);
  const adverse = trend === (rising ? 'up' : 'down');
  const good = trend !== 'none' && trend !== 'flat' && !adverse;
  const tone = adverse ? styles.deltaAdverse : good ? styles.deltaGood : styles.deltaFlat;
  const text = trend === 'none' ? 'no comparable value' : `${delta > 0 ? '+' : ''}${formatValue(delta)}${suffix}`;
  return <span className={`${styles.delta} ${tone}`}><span aria-hidden="true">{GLYPH[trend]}</span> {text}</span>;
}
