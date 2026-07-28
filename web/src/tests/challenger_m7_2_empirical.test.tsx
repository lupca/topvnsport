// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import OtpModal, {
  getStoredCooldown,
  setStoredCooldownExpiry,
  getStoredOtpCode,
  setStoredOtpCode
} from '../components/OtpModal';
import { sportApi } from '../services/sportApi';
import { SIMULATED_LATENCY, delay } from '../services/sport-api/constants';

describe('Milestone 7 Challenger 2 - Empirical Verification Suite', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('1. OtpModal State Retention: Unmount & Remount during Active Cooldown', () => {
    const phone = '0901234567';

    it('preserves exact cooldown remaining and entered OTP across unmount and remount', () => {
      const handleClose = vi.fn();
      const handleSuccess = vi.fn();

      // Render modal first time
      const { unmount } = render(
        <OtpModal
          isOpen={true}
          phoneNumber={phone}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      );

      // Verify initial state: 60s cooldown initiated automatically
      const input = screen.getByPlaceholderText('Nhập 6 số OTP') as HTMLInputElement;
      expect(input.value).toBe('');
      expect(screen.getByText(/Gửi lại sau \(60s\)/)).toBeInTheDocument();

      // User enters OTP '555666'
      fireEvent.change(input, { target: { value: '555666' } });
      expect(input.value).toBe('555666');
      expect(getStoredOtpCode(phone)).toBe('555666');

      // Fast-forward time by 20 seconds
      act(() => {
        vi.advanceTimersByTime(20000);
      });

      // Cooldown should now be ~40 seconds
      expect(screen.getByText(/Gửi lại sau \(40s\)/)).toBeInTheDocument();
      expect(getStoredCooldown(phone)).toBe(40);

      // Unmount modal mid-cooldown
      unmount();

      // Storage checks post-unmount
      expect(getStoredOtpCode(phone)).toBe('555666');
      expect(getStoredCooldown(phone)).toBe(40);

      // Advance time by another 10 seconds while unmounted
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Cooldown should be 30 seconds
      expect(getStoredCooldown(phone)).toBe(30);

      // Remount modal
      render(
        <OtpModal
          isOpen={true}
          phoneNumber={phone}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      );

      // Verify restored OTP input and restored active cooldown (30s)
      const remountedInput = screen.getByPlaceholderText('Nhập 6 số OTP') as HTMLInputElement;
      expect(remountedInput.value).toBe('555666');
      expect(screen.getByText(/Gửi lại sau \(30s\)/)).toBeInTheDocument();

      // Advance time to expiration (30s more)
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // Resend button should become active
      expect(screen.getByText('Gửi lại mã')).toBeInTheDocument();
      expect(screen.getByText('Gửi lại mã')).not.toBeDisabled();
    });

    it('handles multiple unmounts and remounts without losing remaining cooldown', () => {
      const phoneNum = '0911223344';

      setStoredCooldownExpiry(phoneNum, 50);
      setStoredOtpCode(phoneNum, '123123');

      // Mount 1
      const { unmount: unmount1 } = render(
        <OtpModal isOpen={true} phoneNumber={phoneNum} onClose={vi.fn()} onSuccess={vi.fn()} />
      );
      expect(screen.getByPlaceholderText('Nhập 6 số OTP')).toHaveValue('123123');
      expect(screen.getByText(/Gửi lại sau \(50s\)/)).toBeInTheDocument();
      unmount1();

      // Advance 25s
      act(() => {
        vi.advanceTimersByTime(25000);
      });

      // Mount 2
      const { unmount: unmount2 } = render(
        <OtpModal isOpen={true} phoneNumber={phoneNum} onClose={vi.fn()} onSuccess={vi.fn()} />
      );
      expect(screen.getByText(/Gửi lại sau \(25s\)/)).toBeInTheDocument();
      unmount2();

      // Advance 26s -> expired
      act(() => {
        vi.advanceTimersByTime(26000);
      });

      // Mount 3
      render(
        <OtpModal isOpen={true} phoneNumber={phoneNum} onClose={vi.fn()} onSuccess={vi.fn()} />
      );
      expect(screen.getByText('Gửi lại mã')).toBeInTheDocument();
    });
  });

  describe('2. Multi-Phone OTP Key Isolation', () => {
    const phoneA = '0901111111';
    const phoneB = '0902222222';

    it('isolates OTP codes and cooldown expiries completely between different phone numbers', () => {
      // Phone A setup: code '111111', 45s cooldown
      setStoredOtpCode(phoneA, '111111');
      setStoredCooldownExpiry(phoneA, 45);

      // Phone B setup: code '222222', 15s cooldown
      setStoredOtpCode(phoneB, '222222');
      setStoredCooldownExpiry(phoneB, 15);

      // Verify storage keys in sessionStorage
      expect(sessionStorage.getItem(`otp_code_${phoneA}`)).toBe('111111');
      expect(sessionStorage.getItem(`otp_code_${phoneB}`)).toBe('222222');
      expect(getStoredOtpCode(phoneA)).toBe('111111');
      expect(getStoredOtpCode(phoneB)).toBe('222222');

      expect(getStoredCooldown(phoneA)).toBeGreaterThanOrEqual(44);
      expect(getStoredCooldown(phoneB)).toBeGreaterThanOrEqual(14);

      // Render for Phone A
      const { rerender } = render(
        <OtpModal isOpen={true} phoneNumber={phoneA} onClose={vi.fn()} onSuccess={vi.fn()} />
      );
      expect(screen.getByPlaceholderText('Nhập 6 số OTP')).toHaveValue('111111');
      expect(screen.getByText(/Gửi lại sau \(45s\)/)).toBeInTheDocument();

      // Switch props to Phone B dynamically
      rerender(
        <OtpModal isOpen={true} phoneNumber={phoneB} onClose={vi.fn()} onSuccess={vi.fn()} />
      );
      expect(screen.getByPlaceholderText('Nhập 6 số OTP')).toHaveValue('222222');
      expect(screen.getByText(/Gửi lại sau \(15s\)/)).toBeInTheDocument();

      // Advance 16s -> Phone B expires, Phone A still has ~29s left
      act(() => {
        vi.advanceTimersByTime(16000);
      });

      // Phone B resend active
      expect(screen.getByText('Gửi lại mã')).toBeInTheDocument();

      // Switch back to Phone A
      rerender(
        <OtpModal isOpen={true} phoneNumber={phoneA} onClose={vi.fn()} onSuccess={vi.fn()} />
      );
      expect(screen.getByPlaceholderText('Nhập 6 số OTP')).toHaveValue('111111');
      expect(screen.getByText(/Gửi lại sau \(29s\)/)).toBeInTheDocument();
    });

    it('prevents cross-contamination when changing OTP input for one phone', () => {
      // Render Phone A
      const { rerender } = render(
        <OtpModal isOpen={true} phoneNumber={phoneA} onClose={vi.fn()} onSuccess={vi.fn()} />
      );

      const input = screen.getByPlaceholderText('Nhập 6 số OTP');
      fireEvent.change(input, { target: { value: '999000' } });
      expect(getStoredOtpCode(phoneA)).toBe('999000');
      expect(getStoredOtpCode(phoneB)).toBe('');

      // Switch to Phone B and set code
      rerender(
        <OtpModal isOpen={true} phoneNumber={phoneB} onClose={vi.fn()} onSuccess={vi.fn()} />
      );
      const inputB = screen.getByPlaceholderText('Nhập 6 số OTP');
      expect(inputB).toHaveValue('');
      fireEvent.change(inputB, { target: { value: '777888' } });

      expect(getStoredOtpCode(phoneA)).toBe('999000');
      expect(getStoredOtpCode(phoneB)).toBe('777888');
    });
  });

  describe('3. Zero Simulated Latency Verification across API Modules', () => {
    it('verifies SIMULATED_LATENCY constant is explicitly set to 0', () => {
      expect(SIMULATED_LATENCY).toBe(0);
    });

    it('verifies delay(0) resolves immediately without blocking', async () => {
      vi.useRealTimers();
      const start = performance.now();
      await delay(0);
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(50); // should be practically instant
    });

    it('verifies sportApi methods perform zero simulated delay', async () => {
      vi.useRealTimers();
      // Mock global fetch to return instantaneous responses
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ([])
      });
      global.fetch = mockFetch;

      const start = performance.now();
      await sportApi.getProducts();
      await sportApi.getBlogs();
      await sportApi.getBranches();
      await sportApi.getConstants();
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(200);
    });
  });
});
