import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import i18n from '../../i18n/config';
import { ImageViewer } from './ImageViewer';

const TEST_URL = 'blob:mock-abc';

function fireImageLoad(width = 1200, height = 800) {
  const img = screen.getByTestId('image-viewer-img') as HTMLImageElement;
  Object.defineProperty(img, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: height, configurable: true });
  fireEvent.load(img);
}

beforeEach(() => {
  if (i18n.language !== 'de') {
    void i18n.changeLanguage('de');
  }
});

describe('ImageViewer', () => {
  it('renders an <img> with the blob URL as src and the filename as alt', () => {
    render(<ImageViewer url={TEST_URL} filename="scan.png" />);
    const img = screen.getByTestId('image-viewer-img');
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', TEST_URL);
    expect(img).toHaveAttribute('alt', 'scan.png');
  });

  it('starts in Fit mode', () => {
    render(<ImageViewer url={TEST_URL} filename="a.png" />);
    expect(screen.getByTestId('zoom-level').textContent).toMatch(/Angepasst/);
  });

  it('zoom in from fit snaps to 100% (pixel-accurate)', async () => {
    render(<ImageViewer url={TEST_URL} filename="a.png" />);
    fireImageLoad();
    await act(async () => {
      fireEvent.click(screen.getByTestId('zoom-in-btn'));
    });
    expect(screen.getByTestId('zoom-level').textContent).toBe('100%');
  });

  it('zoom out from fit snaps to 50%', async () => {
    render(<ImageViewer url={TEST_URL} filename="a.png" />);
    fireImageLoad();
    await act(async () => {
      fireEvent.click(screen.getByTestId('zoom-out-btn'));
    });
    expect(screen.getByTestId('zoom-level').textContent).toBe('50%');
  });

  it('reset button returns to Fit mode', async () => {
    render(<ImageViewer url={TEST_URL} filename="a.png" />);
    fireImageLoad();
    await act(async () => {
      fireEvent.click(screen.getByTestId('zoom-in-btn'));
      fireEvent.click(screen.getByTestId('zoom-reset-btn'));
    });
    expect(screen.getByTestId('zoom-level').textContent).toMatch(/Angepasst/);
  });

  it('zoom in clamps at 500% and disables the zoom-in button', async () => {
    render(<ImageViewer url={TEST_URL} filename="a.png" />);
    fireImageLoad();
    // 1.0, 1.25, 1.5625, 1.953125, 2.44140625, 3.0517..., 3.8146..., 4.7683..., >5 -> clamp 500
    const btn = screen.getByTestId('zoom-in-btn');
    for (let i = 0; i < 15; i++) {
      await act(async () => {
        fireEvent.click(btn);
      });
    }
    expect(screen.getByTestId('zoom-level').textContent).toBe('500%');
    expect(btn).toBeDisabled();
  });

  it('zoom out clamps at 25% and disables the zoom-out button', async () => {
    render(<ImageViewer url={TEST_URL} filename="a.png" />);
    fireImageLoad();
    const btn = screen.getByTestId('zoom-out-btn');
    for (let i = 0; i < 15; i++) {
      await act(async () => {
        fireEvent.click(btn);
      });
    }
    expect(screen.getByTestId('zoom-level').textContent).toBe('25%');
    expect(btn).toBeDisabled();
  });

  it('applies pixel-accurate width/height on the image when zoomed', async () => {
    render(<ImageViewer url={TEST_URL} filename="a.png" />);
    fireImageLoad(1200, 800);
    await act(async () => {
      fireEvent.click(screen.getByTestId('zoom-in-btn'));
    });
    const img = screen.getByTestId('image-viewer-img');
    expect(img).toHaveAttribute('width', '1200');
    expect(img).toHaveAttribute('height', '800');
  });

  it('zoom-level element has aria-live=polite for screen-reader announcements', () => {
    render(<ImageViewer url={TEST_URL} filename="a.png" />);
    const label = screen.getByTestId('zoom-level');
    expect(label).toHaveAttribute('aria-live', 'polite');
    expect(label).toHaveAttribute('role', 'status');
  });

  it('keyboard shortcut + zooms in from fit to 100%', async () => {
    render(<ImageViewer url={TEST_URL} filename="a.png" />);
    fireImageLoad();
    const container = screen.getByTestId('image-viewer');
    container.focus();
    await act(async () => {
      fireEvent.keyDown(container, { key: '+' });
    });
    expect(screen.getByTestId('zoom-level').textContent).toBe('100%');
  });

  it('keyboard shortcut - zooms out', async () => {
    render(<ImageViewer url={TEST_URL} filename="a.png" />);
    fireImageLoad();
    const container = screen.getByTestId('image-viewer');
    await act(async () => {
      fireEvent.keyDown(container, { key: '-' });
    });
    expect(screen.getByTestId('zoom-level').textContent).toBe('50%');
  });

  it('keyboard shortcut 0 resets to Fit', async () => {
    render(<ImageViewer url={TEST_URL} filename="a.png" />);
    fireImageLoad();
    const container = screen.getByTestId('image-viewer');
    await act(async () => {
      fireEvent.click(screen.getByTestId('zoom-in-btn'));
      fireEvent.keyDown(container, { key: '0' });
    });
    expect(screen.getByTestId('zoom-level').textContent).toMatch(/Angepasst/);
  });

  it('ctrl+wheel up zooms in; plain wheel leaves state unchanged', async () => {
    render(<ImageViewer url={TEST_URL} filename="a.png" />);
    fireImageLoad();
    const container = screen.getByTestId('image-viewer');
    // Plain wheel: no change (normal page scroll behavior).
    await act(async () => {
      const ev = new WheelEvent('wheel', {
        deltaY: -100,
        ctrlKey: false,
        bubbles: true,
        cancelable: true,
      });
      container.dispatchEvent(ev);
    });
    expect(screen.getByTestId('zoom-level').textContent).toMatch(/Angepasst/);
    // Ctrl+wheel up: zoom in.
    await act(async () => {
      const ev = new WheelEvent('wheel', {
        deltaY: -100,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      });
      container.dispatchEvent(ev);
    });
    expect(screen.getByTestId('zoom-level').textContent).toBe('100%');
  });
});
