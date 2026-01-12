import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import Footer from './Footer';

describe('Footer', () => {
  beforeEach(() => {
    render(<Footer />);
  });

  it('renders the repository link', () => {
    const link = screen.getByRole('link', { name: /JoeAzar\/pokerbench/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://github.com/JoeAzar/pokerbench');
  });

  it('renders the YouTube link', () => {
    const link = screen.getByRole('link', { name: /@PokerBench/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://www.youtube.com/@PokerBench');
  });

  it('renders the "Built with Antigravity" link', () => {
    const link = screen.getByRole('link', { name: /Built with Antigravity/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://antigravity.google/');
  });

  it('renders the support button', () => {
    const button = screen.getByRole('button', { name: /Support PokerBench/i });
    expect(button).toBeInTheDocument();
  });

  it('opens and closes the support modal', () => {
    const supportButton = screen.getByRole('button', { name: /Support PokerBench/i });

    // Open modal
    fireEvent.click(supportButton);
    expect(screen.getByText(/Over was spent running PokerBench/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Donate via PayPal/i })).toBeInTheDocument();

    // Close modal via close button
    const closeBtn = document.querySelector('.modal-close');
    expect(closeBtn).toBeInTheDocument();
    if (closeBtn) fireEvent.click(closeBtn);

    // After closing, we should only have 1 "Support PokerBench" (the footer button)
    // and no "Donate via PayPal" link
    expect(screen.getAllByText(/Support PokerBench/i)).toHaveLength(1);
    expect(screen.queryByRole('link', { name: /Donate via PayPal/i })).not.toBeInTheDocument();
  });
});
