#!/usr/bin/env python3
"""
E2E: 新增諮詢流程
Usage: python3 e2e/consultation_create.py [base_url] [company] [role]
"""
import sys
import json
from playwright.sync_api import sync_playwright

BASE    = sys.argv[1] if len(sys.argv) > 1 else "https://medicare.tomting.com"
COMPANY = sys.argv[2] if len(sys.argv) > 2 else "GardenWorld"
ROLE    = sys.argv[3] if len(sys.argv) > 3 else "GardenWorld Admin"

PASS, FAIL = 0, 0

def check(condition, msg):
    global PASS, FAIL
    if condition:
        print(f"  ✅ {msg}")
        PASS += 1
    else:
        print(f"  ❌ {msg}")
        FAIL += 1

def login(page):
    page.goto(f"{BASE}/aesthetics/#/login")
    page.wait_for_load_state("networkidle")
    page.fill('input[type="text"]', "SuperUser")
    page.fill('input[type="password"]', "System")
    page.click('button[type="submit"]')
    page.wait_for_timeout(1500)
    page.get_by_role("button", name=COMPANY, exact=True).click()
    page.wait_for_timeout(1500)
    page.get_by_role("button", name=ROLE, exact=True).click()
    page.wait_for_timeout(1500)
    if "login" in page.url:
        page.locator("button.selection-item").first.click()
        page.wait_for_timeout(1500)
    check("login" not in page.url, f"Login as {COMPANY}/{ROLE}")

def test_form_fields(page):
    """必填欄位應只有 摘要、負責人、客戶"""
    page.goto(f"{BASE}/aesthetics/#/consultation/new")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    labels = page.locator("label").all_text_contents()
    labels = [l.strip().rstrip("*").strip() for l in labels if l.strip()]
    check("到期類型" not in labels, "到期類型 NOT in mandatory fields")
    check("優先順序" not in labels, "優先順序 NOT in mandatory fields")
    check("摘要" in labels, "摘要 IS in mandatory fields")
    check("負責人" in labels, "負責人 IS in mandatory fields")
    check("客戶" in labels, "客戶 IS in mandatory fields")

    status_opts = [o.strip() for o in page.locator("select.status-select option").all_text_contents()
                   if o.strip() and "--" not in o]
    check(len(status_opts) > 0, f"Status dropdown has options: {status_opts}")

def test_create(page):
    """送出表單應成功 (HTTP 201)"""
    page.goto(f"{BASE}/aesthetics/#/consultation/new")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    for ta in page.locator("textarea").all():
        if ta.is_visible() and not ta.is_disabled():
            ta.fill("E2E自動測試 — 請忽略")
            break

    with page.expect_response(
        lambda r: "R_Request" in r.url and r.request.method == "POST",
        timeout=15000
    ) as resp_info:
        page.locator("button").filter(has_text="儲存").last.click()

    resp = resp_info.value
    check(resp.status in (200, 201), f"Create returns HTTP {resp.status} (expected 201)")

    body = resp.json()
    check(bool(body.get("id")), f"Response has id={body.get('id')}")

    payload = json.loads(resp.request.post_data or "{}")
    check("R_RequestType_ID" in payload,
          f"Payload includes R_RequestType_ID={payload.get('R_RequestType_ID')}")
    check("DueType" not in payload, "Payload does NOT include DueType")
    check("Priority" not in payload, "Payload does NOT include Priority")

with sync_playwright() as p:
    print(f"=== E2E: 新增諮詢 [{BASE}] ===\n")
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(ignore_https_errors=True)
    page = ctx.new_page()

    try:
        login(page)
        print("\n[Form Fields]")
        test_form_fields(page)
        print("\n[Create Request]")
        test_create(page)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        page.screenshot(path="/tmp/e2e_crash.png")
        FAIL += 1
    finally:
        browser.close()

    print(f"\n{'='*40}")
    print(f"{'✅ ALL PASS' if FAIL == 0 else '❌ FAILURES'}: {PASS} passed, {FAIL} failed")
    sys.exit(0 if FAIL == 0 else 1)
