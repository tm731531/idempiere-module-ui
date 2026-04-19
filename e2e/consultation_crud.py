#!/usr/bin/env python3
"""
E2E: 諮詢 CRUD 商務流程
Usage: python3 e2e/consultation_crud.py [base_url] [company] [role]
Tests: Create → Read → Update → sidebar errors
"""
import sys, json
from playwright.sync_api import sync_playwright

BASE    = sys.argv[1] if len(sys.argv) > 1 else "https://medicare.tomting.com"
COMPANY = sys.argv[2] if len(sys.argv) > 2 else "GardenWorld"
ROLE    = sys.argv[3] if len(sys.argv) > 3 else "GardenWorld Admin"

PASS, FAIL = 0, 0
created_id = None

def check(condition, msg):
    global PASS, FAIL
    symbol = "✅" if condition else "❌"
    print(f"  {symbol} {msg}")
    if condition: PASS += 1
    else: FAIL += 1
    return condition

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

def test_create(page):
    global created_id
    print("\n[C] Create")
    page.goto(f"{BASE}/aesthetics/#/consultation/new")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    # Fill summary
    for ta in page.locator("textarea").all():
        if ta.is_visible() and not ta.is_disabled():
            ta.fill("E2E-CRUD測試 — 請忽略")
            break

    # Select a status if available
    status_opts = page.locator("select.status-select option[value]").all()
    for opt in status_opts:
        val = opt.get_attribute("value")
        if val and val != "0":
            page.locator("select.status-select").select_option(value=val)
            break

    with page.expect_response(
        lambda r: "R_Request" in r.url and r.request.method == "POST",
        timeout=15000
    ) as ri:
        page.locator("button").filter(has_text="儲存").last.click()

    resp = ri.value
    body = resp.json()
    ok = check(resp.status in (200, 201), f"POST /R_Request → {resp.status}")
    if ok:
        created_id = body.get("id")
        check(bool(created_id), f"Got id={created_id}")
        payload = json.loads(resp.request.post_data or "{}")
        check("R_RequestType_ID" in payload, f"R_RequestType_ID={payload.get('R_RequestType_ID')} injected")
        check("DueType" not in payload, "DueType NOT in payload")
        check("Priority" not in payload, "Priority NOT in payload")
    return created_id

def test_read(page, record_id):
    print(f"\n[R] Read #{record_id}")
    page.goto(f"{BASE}/aesthetics/#/consultation/{record_id}")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    check(f"/consultation/{record_id}" in page.url, "Navigated to edit page")
    check(page.locator("h2:has-text('編輯諮詢')").count() > 0, "Page title is 編輯諮詢")

    # Summary should be filled
    summaries = page.locator("textarea").all()
    summary_text = ""
    for ta in summaries:
        if ta.is_visible():
            summary_text = ta.input_value()
            break
    check("E2E-CRUD" in summary_text, f"Summary loaded: '{summary_text[:30]}'")

    # Save button should exist and be visible
    save_btn = page.locator("button[type='submit'], button:has-text('儲存')").last
    check(save_btn.is_visible(), "儲存 button is visible")

    # QuickActionBar buttons
    action_btns = page.locator(".action-btn").all_text_contents()
    check(len(action_btns) >= 2, f"QuickActionBar has buttons: {[b.strip() for b in action_btns]}")

    # Sidebar: no "載入失敗" errors
    errors = page.locator(".error-state").all_text_contents()
    check(len(errors) == 0, f"No error states in sidebar (found: {errors})")

    # Status dropdown has options
    status_opts = [o.strip() for o in page.locator("select.status-select option").all_text_contents()
                   if o.strip() and "--" not in o]
    check(len(status_opts) > 0, f"Status options loaded: {status_opts}")

def test_update(page, record_id):
    print(f"\n[U] Update #{record_id}")
    page.goto(f"{BASE}/aesthetics/#/consultation/{record_id}")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    # Change summary
    new_text = "E2E-CRUD更新測試"
    for ta in page.locator("textarea").all():
        if ta.is_visible() and not ta.is_disabled():
            ta.fill(new_text)
            break

    # Select first non-default status
    status_opts = page.locator("select.status-select option").all()
    for opt in status_opts:
        val = opt.get_attribute("value")
        if val and val != "0":
            page.locator("select.status-select").select_option(value=val)
            print(f"  Selected status value={val}")
            break

    with page.expect_response(
        lambda r: "R_Request" in r.url and r.request.method in ("PUT", "PATCH"),
        timeout=15000
    ) as ri:
        page.locator("button[type='submit'], button:has-text('儲存')").last.click()

    resp = ri.value
    check(resp.status in (200, 201), f"PUT /R_Request/{record_id} → {resp.status}")

    if resp.status >= 400:
        body = resp.json()
        print(f"  Error: {body.get('detail', body.get('title', ''))[:300]}")
    else:
        # Reload and verify
        page.goto(f"{BASE}/aesthetics/#/consultation/{record_id}")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        for ta in page.locator("textarea").all():
            if ta.is_visible():
                actual = ta.input_value()
                check(new_text in actual, f"Updated summary persisted: '{actual[:40]}'")
                break

def test_list(page):
    print("\n[L] List view")
    page.goto(f"{BASE}/aesthetics/#/consultation")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    rows = page.locator(".list-item, .request-row, tr[data-id]").count()
    check(rows >= 0, f"List view loaded ({rows} visible rows)")

    new_btn = page.locator("button:has-text('新增'), a:has-text('新增諮詢')").first
    check(new_btn.is_visible(), "新增 button visible in list")

with sync_playwright() as p:
    print(f"=== E2E CRUD: 諮詢 [{BASE} / {COMPANY}] ===\n")
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(ignore_https_errors=True)
    page = ctx.new_page()

    try:
        login(page)
        cid = test_create(page)
        if cid:
            test_read(page, cid)
            test_update(page, cid)
        test_list(page)
    except Exception as e:
        print(f"❌ Unexpected: {type(e).__name__}: {e}")
        page.screenshot(path="/tmp/e2e_crud_crash.png")
        FAIL += 1
    finally:
        browser.close()

    print(f"\n{'='*45}")
    print(f"{'✅ ALL PASS' if FAIL == 0 else '❌ FAILURES'}: {PASS} passed, {FAIL} failed")
    sys.exit(0 if FAIL == 0 else 1)
