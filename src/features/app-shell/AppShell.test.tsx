import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './AppShell';

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/test']}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/test" element={<p>Test Content</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  it('renders header, nav, and main', () => {
    renderShell();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('renders children in main content area', () => {
    renderShell();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });
});
