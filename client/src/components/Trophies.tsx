import React from 'react';
import { Box } from '@mui/material';
import { EmojiEvents } from '@mui/icons-material';

type Props = { currentHours?: number | null };

function Trophies({ currentHours }: Props) {
  const nodes = React.useMemo(() => {
    const hours = currentHours || 0;
    const goldCount = Math.floor(hours / 24);
    const remainder = hours - goldCount * 24;
    const showPartial = goldCount >= 1 && remainder >= 6;
    const partialType = remainder >= 12 ? 'silver' : 'bronze';
  const trophies: Array<React.ReactNode> = [];
    for (let i = 0; i < goldCount; i++) {
      trophies.push(
        <EmojiEvents key={`gold-${i}`} sx={{ color: '#FFD700' }} fontSize="small" />
      );
    }
    if (showPartial) {
      if (partialType === 'silver') {
        trophies.push(<EmojiEvents key={`partial-silver`} sx={{ color: '#C0C0C0' }} fontSize="small" />);
      } else {
        trophies.push(<EmojiEvents key={`partial-bronze`} sx={{ color: '#CD7F32' }} fontSize="small" />);
      }
    }
    return trophies;
  }, [currentHours]);

  return <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center' }}>{nodes}</Box>;
}

export default React.memo(Trophies);
