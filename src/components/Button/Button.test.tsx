import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

import { fireEvent, render, screen } from '@testing-library/react';

describe('Button', () => {
  it('renders its label and responds to clicks', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Save</Button>);

    const button = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disables interaction while loading', () => {
    const handleClick = vi.fn();
    render(
      <Button onClick={handleClick} isLoading>
        Save
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
