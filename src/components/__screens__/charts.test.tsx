/// <reference types="jest" />
import { render, screen } from '@testing-library/react-native';

import { PowerChart } from '@/components/power-chart';

describe('purchasing-power chart', () => {
  it('tells a screen reader what the lines show', async () => {
    await render(
      <PowerChart
        points={[
          { month: '2025-10', nominal: 100_000, real: 100_000 },
          { month: '2026-10', nominal: 140_000, real: 108_000 },
        ]}
      />,
    );
    expect(screen.getByLabelText(/Alım gücün arttı: \+%8,0/)).toBeTruthy();
  });
});
