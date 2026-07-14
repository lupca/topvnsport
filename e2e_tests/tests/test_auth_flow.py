from __future__ import annotations
import re
import time
from playwright.sync_api import expect
import pytest

def test_pmi_auth_flow(page):
    page.on("console", lambda msg: print(f"PMI CONSOLE [{msg.type}]: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PMI PAGE ERROR: {err}"))

    # 1. Access unauthenticated -> redirects to Identity Service login
    page.goto("http://localhost:13100")
    page.wait_for_url(re.compile(r"^http://localhost:13110/login\?redirect="))
    assert "localhost:13110" in page.url

    # 2. Fill login form with seeded admin account
    page.fill("input[name='username']", "admin")
    page.fill("input[name='password']", "Admin@123")
    page.click("button[type='submit']")

    # 3. Redirected back to PMI and verify token is set
    page.wait_for_url(re.compile(r"^http://localhost:13100/(\?.*)?$"))
    page.wait_for_timeout(2000) # Wait to capture any logs or errors
    token = page.evaluate("localStorage.getItem('access_token')")
    assert token is not None

    # 4. Clicking logout clears token and redirects to login
    logout_btn = page.get_by_role("button", name="Đăng xuất")
    expect(logout_btn).to_be_visible()
    logout_btn.click(no_wait_after=True)

    # 5. Redirected back to Identity Service login page
    page.wait_for_url(re.compile(r"^http://localhost:13110/login\?redirect="))
    assert "localhost:13110" in page.url


def test_oms_auth_flow(page):
    page.on("console", lambda msg: print(f"OMS CONSOLE [{msg.type}]: {msg.text}"))
    page.on("pageerror", lambda err: print(f"OMS PAGE ERROR: {err}"))

    # 1. Access unauthenticated -> redirects to Identity Service login
    page.goto("http://localhost:13101")
    page.wait_for_url(re.compile(r"^http://localhost:13110/login\?redirect="))
    assert "localhost:13110" in page.url

    # 2. Fill login form
    page.fill("input[name='username']", "admin")
    page.fill("input[name='password']", "Admin@123")
    page.click("button[type='submit']")

    # 3. Redirected back to OMS and verify token is set
    page.wait_for_url(re.compile(r"^http://localhost:13101/(\?.*)?$"))
    page.wait_for_timeout(2000)
    token = page.evaluate("localStorage.getItem('access_token')")
    assert token is not None

    # 4. Click logout
    logout_btn = page.get_by_role("button", name="Đăng xuất")
    expect(logout_btn).to_be_visible()
    logout_btn.click(no_wait_after=True)

    # 5. Redirected back to Identity Service login page
    page.wait_for_url(re.compile(r"^http://localhost:13110/login\?redirect="))
    assert "localhost:13110" in page.url


def test_wms_auth_flow(page):
    page.on("console", lambda msg: print(f"WMS CONSOLE [{msg.type}]: {msg.text}"))
    page.on("pageerror", lambda err: print(f"WMS PAGE ERROR: {err}"))

    # 1. Access unauthenticated -> redirects to Identity Service login
    page.goto("http://localhost:13102")
    page.wait_for_url(re.compile(r"^http://localhost:13110/login\?redirect="))
    assert "localhost:13110" in page.url

    # 2. Fill login form
    page.fill("input[name='username']", "admin")
    page.fill("input[name='password']", "Admin@123")
    page.click("button[type='submit']")

    # 3. Redirected back to WMS and verify token is set
    page.wait_for_url(re.compile(r"^http://localhost:13102/(\?.*)?$"))
    page.wait_for_timeout(2000)
    token = page.evaluate("localStorage.getItem('access_token')")
    assert token is not None

    # 4. Click logout
    logout_btn = page.get_by_role("button", name="Đăng xuất")
    expect(logout_btn).to_be_visible()
    logout_btn.click(no_wait_after=True)

    # 5. Redirected back to Identity Service login page
    page.wait_for_url(re.compile(r"^http://localhost:13110/login\?redirect="))
    assert "localhost:13110" in page.url


def test_token_expiration_redirect_flow(page):
    # Send user with an invalid token to trigger 401 / redirect flow
    # Next.js AuthGuard handleAuthCallback sets token from url if present, then cleans URL
    page.goto("http://localhost:13100/?token=invalid_expired_token")
    
    # Verify AuthGuard detects invalid/expired token on verification, clears token, and redirects back to Identity Service
    page.wait_for_url(re.compile(r"^http://localhost:13110/login\?redirect="))
    assert "localhost:13110" in page.url
