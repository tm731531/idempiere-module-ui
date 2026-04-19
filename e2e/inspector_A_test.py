#!/usr/bin/env python3
"""
檢查小組 A — 預約系統破壞性測試
Inspector A: Appointment System Destructive Testing
"""

import requests
import urllib3
import json
import time
import os
from datetime import datetime, timedelta
from pathlib import Path

urllib3.disable_warnings()

SCREENSHOT_DIR = Path("/tmp/inspector_A")
SCREENSHOT_DIR.mkdir(exist_ok=True)

BASE_URL = "https://medicare.tomting.com"
API_BASE = f"{BASE_URL}/api/v1"
APP_URL = f"{BASE_URL}/aesthetics/#/"

results = []


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


# ─── AUTH ────────────────────────────────────────────────────────────────────
def authenticate():
    log("🔐 Authenticating...")
    s = requests.Session()
    s.verify = False

    r = s.post(f'{API_BASE}/auth/tokens',
               json={'userName': 'renewAdmin', 'password': 'renewAdmin'},
               headers={'Content-Type': 'application/json'})
    d = r.json()
    token = d['token']
    cid = d['clients'][0]['id']
    s.headers['Authorization'] = f'Bearer {token}'

    rid = s.get(f'{API_BASE}/auth/roles',
                params={'client': cid}).json()['roles'][0]['id']

    orgs = s.get(f'{API_BASE}/auth/organizations',
                 params={'client': cid, 'role': rid}).json().get('organizations', [])
    oid = next((o for o in orgs if o.get('name') != '*'), orgs[0])['id']

    whs = s.get(f'{API_BASE}/auth/warehouses',
                params={'client': cid, 'role': rid, 'organization': oid}).json().get('warehouses', [{}])
    wid = whs[0].get('id', 0) if whs else 0

    t2 = s.put(f'{API_BASE}/auth/tokens',
               json={'clientId': cid, 'roleId': rid, 'organizationId': oid, 'warehouseId': wid},
               headers={'Content-Type': 'application/json'}).json().get('token')
    s.headers['Authorization'] = f'Bearer {t2}'

    log(f"✅ Auth OK — orgId={oid}, warehouseId={wid}")
    return s


# ─── HELPERS ─────────────────────────────────────────────────────────────────
def get_resource(s):
    """Get first available S_Resource"""
    r = s.get(f'{API_BASE}/models/S_Resource', params={'$select': 'S_Resource_ID,Name', '$top': 5})
    items = r.json().get('records', [])
    if items:
        log(f"  Found resource: {items[0].get('Name')} (id={items[0].get('id')})")
        return items[0]
    return None


def get_bpartner(s):
    """Get first available customer"""
    r = s.get(f'{API_BASE}/models/C_BPartner',
              params={'$select': 'C_BPartner_ID,Name', '$filter': 'IsCustomer eq true', '$top': 5})
    items = r.json().get('records', [])
    if items:
        log(f"  Found BPartner: {items[0].get('Name')} (id={items[0].get('id')})")
        return items[0]
    return None


def create_assignment(s, resource_id, bpartner_id, date_from, date_to, name="Test Appt"):
    """Create S_ResourceAssignment via API"""
    payload = {
        "Name": name,
        "S_Resource_ID": {"id": resource_id},
        "AssignDateFrom": date_from,
        "AssignDateTo": date_to,
        "IsConfirmed": False,
    }
    if bpartner_id:
        payload["C_BPartner_ID"] = {"id": bpartner_id}

    r = s.post(f'{API_BASE}/models/S_ResourceAssignment',
               json=payload,
               headers={'Content-Type': 'application/json'})
    return r


def delete_assignment(s, record_id):
    """Delete S_ResourceAssignment via API"""
    r = s.delete(f'{API_BASE}/models/S_ResourceAssignment/{record_id}')
    return r


def screenshot(page, name):
    path = str(SCREENSHOT_DIR / f"{name}.png")
    try:
        page.screenshot(path=path)
    except Exception as e:
        log(f"  Screenshot failed: {e}")
    return path


def add_result(test_id, name, status, expected, actual, notes="", screenshot_path=""):
    results.append({
        "id": test_id,
        "name": name,
        "status": status,  # PASS / FAIL / WARNING / ERROR
        "expected": expected,
        "actual": actual,
        "notes": notes,
        "screenshot": screenshot_path,
    })
    icon = {"PASS": "✅", "FAIL": "❌", "WARNING": "⚠️", "ERROR": "💥"}.get(status, "?")
    log(f"  {icon} [{test_id}] {name}: {status}")


# ─── PLAYWRIGHT SETUP ────────────────────────────────────────────────────────
def get_browser():
    from playwright.sync_api import sync_playwright
    pw = sync_playwright().start()
    browser = pw.chromium.launch(
        headless=True,
        args=['--no-sandbox', '--disable-dev-shm-usage', '--ignore-certificate-errors']
    )
    return pw, browser


def login_ui(page):
    """Login to the web UI"""
    page.goto(f"{BASE_URL}/aesthetics/#/login", wait_until="networkidle", timeout=30000)
    time.sleep(1)
    page.fill('input[type="text"], input[name="username"], input[placeholder*="帳號"], input[placeholder*="username"]', 'renewAdmin')
    page.fill('input[type="password"]', 'renewAdmin')
    page.click('button[type="submit"], button:has-text("登入"), button:has-text("Login")')
    try:
        page.wait_for_url("**/aesthetics/**", timeout=15000)
    except:
        pass
    time.sleep(2)


# ─── TEST FUNCTIONS ───────────────────────────────────────────────────────────

def test_a001_reversed_time(s, page):
    """A-001: End time before start time"""
    log("\n=== A-001: Reversed time (DateTo < DateFrom) ===")
    resource = get_resource(s)
    bp = get_bpartner(s)

    if not resource:
        add_result("A-001", "結束時間早於開始時間", "ERROR",
                   "API 拒絕或 UI 驗證", "無 S_Resource 可用", "跳過測試")
        return

    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    date_from = f"{tomorrow}T18:00:00+08:00"
    date_to = f"{tomorrow}T17:00:00+08:00"  # REVERSED!

    r = create_assignment(s, resource.get('id'), bp.get('id') if bp else None,
                          date_from, date_to, name="A001-倒置時間測試")
    sc = screenshot(page, "A001_reversed_time")

    if r.status_code in [200, 201]:
        body = r.json()
        record_id = body.get('id')
        # Check if it was actually created with reversed times
        add_result("A-001", "結束時間早於開始時間", "FAIL",
                   "API 應拒絕 DateTo < DateFrom",
                   f"API 接受了倒置時間！HTTP {r.status_code}, record_id={record_id}",
                   "嚴重：後端無時間順序驗證",
                   sc)
        # Cleanup
        if record_id:
            delete_assignment(s, record_id)
    else:
        add_result("A-001", "結束時間早於開始時間", "PASS",
                   "API 應拒絕 DateTo < DateFrom",
                   f"API 拒絕，HTTP {r.status_code}: {r.text[:200]}",
                   "正確：後端有時間驗證",
                   sc)


def test_a002_long_name(s, page):
    """A-002: 500-character name"""
    log("\n=== A-002: 500 字元超長名稱 ===")
    resource = get_resource(s)
    bp = get_bpartner(s)

    if not resource:
        add_result("A-002", "超長名稱(500字元)", "ERROR", "測試執行", "無 S_Resource", "跳過")
        return

    long_name = "A" * 500
    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    date_from = f"{tomorrow}T09:00:00+08:00"
    date_to = f"{tomorrow}T10:00:00+08:00"

    r = create_assignment(s, resource.get('id'), bp.get('id') if bp else None,
                          date_from, date_to, name=long_name)
    sc = screenshot(page, "A002_long_name")

    if r.status_code in [200, 201]:
        body = r.json()
        record_id = body.get('id')
        saved_name = body.get('Name', '')
        if len(saved_name) == 500:
            add_result("A-002", "超長名稱(500字元)", "WARNING",
                       "名稱應有長度限制（資料庫欄位通常60-255字元）",
                       f"API 接受並完整儲存 500 字元名稱",
                       "警告：可能超出資料庫欄位長度",
                       sc)
        elif len(saved_name) < 500:
            add_result("A-002", "超長名稱(500字元)", "WARNING",
                       "應有明確的長度限制提示",
                       f"名稱被截斷至 {len(saved_name)} 字元（靜默截斷，無錯誤訊息）",
                       "靜默截斷是不友善的行為",
                       sc)
        if record_id:
            delete_assignment(s, record_id)
    else:
        add_result("A-002", "超長名稱(500字元)", "PASS",
                   "應拒絕超長名稱",
                   f"API 拒絕，HTTP {r.status_code}: {r.text[:200]}",
                   "正確拒絕超長輸入",
                   sc)


def test_a003_empty_name(s, page):
    """A-003: Empty name"""
    log("\n=== A-003: 空白名稱 ===")
    resource = get_resource(s)
    bp = get_bpartner(s)

    if not resource:
        add_result("A-003", "空白名稱", "ERROR", "測試執行", "無 S_Resource", "跳過")
        return

    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    date_from = f"{tomorrow}T11:00:00+08:00"
    date_to = f"{tomorrow}T12:00:00+08:00"

    r = create_assignment(s, resource.get('id'), bp.get('id') if bp else None,
                          date_from, date_to, name="")
    sc = screenshot(page, "A003_empty_name")

    if r.status_code in [200, 201]:
        record_id = r.json().get('id')
        add_result("A-003", "空白名稱", "FAIL",
                   "API 應要求名稱不為空（Name 是必填欄位）",
                   f"API 接受空白名稱！HTTP {r.status_code}, id={record_id}",
                   "嚴重：沒有必填驗證",
                   sc)
        if record_id:
            delete_assignment(s, record_id)
    else:
        add_result("A-003", "空白名稱", "PASS",
                   "應拒絕空白名稱",
                   f"API 拒絕，HTTP {r.status_code}: {r.text[:200]}",
                   "正確：Name 有 NOT NULL 或必填驗證",
                   sc)


def test_a004_xss_name(s, page):
    """A-004: XSS and SQL injection in name"""
    log("\n=== A-004: XSS / SQL Injection ===")
    resource = get_resource(s)
    bp = get_bpartner(s)

    if not resource:
        add_result("A-004", "XSS/SQL Injection", "ERROR", "測試執行", "無 S_Resource", "跳過")
        return

    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    date_from = f"{tomorrow}T13:00:00+08:00"
    date_to = f"{tomorrow}T14:00:00+08:00"

    xss_payload = "<script>alert('XSS')</script>"
    r = create_assignment(s, resource.get('id'), bp.get('id') if bp else None,
                          date_from, date_to, name=xss_payload)

    xss_created = None
    if r.status_code in [200, 201]:
        body = r.json()
        xss_created = body.get('id')
        saved_name = body.get('Name', '')
        # Check if stored as-is (XSS risk in UI)
        if '<script>' in saved_name:
            add_result("A-004", "XSS/SQL Injection", "WARNING",
                       "儲存原始 HTML 但 UI 應做 escape",
                       f"API 儲存原始 XSS payload: '{saved_name[:80]}'",
                       "前端若未 escape 則有 XSS 風險；後端已接受",
                       "")
        else:
            add_result("A-004", "XSS/SQL Injection", "PASS",
                       "儲存時應 sanitize",
                       f"名稱已被處理: '{saved_name[:80]}'",
                       "後端有 sanitization",
                       "")
        if xss_created:
            delete_assignment(s, xss_created)
    else:
        add_result("A-004", "XSS/SQL Injection", "PASS",
                   "拒絕惡意輸入",
                   f"API 拒絕，HTTP {r.status_code}",
                   "後端有拒絕惡意輸入",
                   "")

    # SQL injection test
    sql_payload = "'; DROP TABLE appointments; --"
    date_from2 = f"{tomorrow}T14:00:00+08:00"
    date_to2 = f"{tomorrow}T15:00:00+08:00"
    r2 = create_assignment(s, resource.get('id'), bp.get('id') if bp else None,
                           date_from2, date_to2, name=sql_payload)
    sql_id = None
    if r2.status_code in [200, 201]:
        sql_id = r2.json().get('id')
        add_result("A-004b", "SQL Injection 名稱", "WARNING",
                   "應拒絕或 sanitize SQL injection 字串",
                   f"API 接受 SQL injection payload，HTTP {r2.status_code}",
                   "iDempiere 使用 ORM 應防護，但仍需確認",
                   "")
        if sql_id:
            delete_assignment(s, sql_id)
    else:
        add_result("A-004b", "SQL Injection 名稱", "PASS",
                   "拒絕 SQL injection 字串",
                   f"HTTP {r2.status_code}: {r2.text[:100]}",
                   "後端正確拒絕",
                   "")


def test_a005_time_conflict(s, page):
    """A-005: Time conflict same resource"""
    log("\n=== A-005: 同時段同服務人員衝突 ===")
    resource = get_resource(s)
    bp = get_bpartner(s)

    if not resource:
        add_result("A-005", "時段衝突偵測", "ERROR", "測試執行", "無 S_Resource", "跳過")
        return

    tomorrow = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")
    date_from = f"{tomorrow}T11:00:00+08:00"
    date_to = f"{tomorrow}T12:00:00+08:00"

    # Create first appointment
    r1 = create_assignment(s, resource.get('id'), bp.get('id') if bp else None,
                           date_from, date_to, name="A005-衝突測試A")

    if r1.status_code not in [200, 201]:
        add_result("A-005", "時段衝突偵測", "ERROR",
                   "建立第一個預約成功",
                   f"建立第一個預約失敗 HTTP {r1.status_code}: {r1.text[:200]}",
                   "無法繼續測試")
        return

    id1 = r1.json().get('id')
    log(f"  Created appointment 1: id={id1}")

    # Create conflicting appointment
    r2 = create_assignment(s, resource.get('id'), bp.get('id') if bp else None,
                           date_from, date_to, name="A005-衝突測試B")

    sc = screenshot(page, "A005_conflict")

    if r2.status_code in [200, 201]:
        id2 = r2.json().get('id')
        add_result("A-005", "時段衝突偵測", "FAIL",
                   "API 應偵測到時段衝突並拒絕",
                   f"API 允許建立衝突預約！兩筆 id={id1}, {id2} 均成功",
                   "嚴重：無雙重預約防護！服務人員可能同時有兩個客戶",
                   sc)
        if id2:
            delete_assignment(s, id2)
    else:
        add_result("A-005", "時段衝突偵測", "PASS",
                   "應拒絕衝突時段",
                   f"API 拒絕第二個預約，HTTP {r2.status_code}: {r2.text[:200]}",
                   "正確：有衝突偵測機制",
                   sc)

    if id1:
        delete_assignment(s, id1)


def test_a006_zero_duration(s, page):
    """A-006: Zero duration appointment (DateFrom == DateTo)"""
    log("\n=== A-006: 零長度時間（同時刻開始結束）===")
    resource = get_resource(s)
    bp = get_bpartner(s)

    if not resource:
        add_result("A-006", "零長度時間", "ERROR", "測試執行", "無 S_Resource", "跳過")
        return

    tomorrow = (datetime.now() + timedelta(days=3)).strftime("%Y-%m-%d")
    same_time = f"{tomorrow}T10:00:00+08:00"

    r = create_assignment(s, resource.get('id'), bp.get('id') if bp else None,
                          same_time, same_time, name="A006-零長度時間")
    sc = screenshot(page, "A006_zero_duration")

    if r.status_code in [200, 201]:
        record_id = r.json().get('id')
        add_result("A-006", "零長度時間", "FAIL",
                   "應拒絕 DateFrom == DateTo（無意義預約）",
                   f"API 接受零長度預約，id={record_id}",
                   "警告：可能導致行事曆顯示異常",
                   sc)
        if record_id:
            delete_assignment(s, record_id)
    else:
        add_result("A-006", "零長度時間", "PASS",
                   "應拒絕零長度時間",
                   f"API 拒絕，HTTP {r.status_code}: {r.text[:200]}",
                   "正確",
                   sc)


def test_a007_nonexistent_url(page):
    """A-007: Navigate to non-existent appointment ID"""
    log("\n=== A-007: 不存在的預約 URL ===")
    try:
        page.goto(f"{BASE_URL}/aesthetics/#/appointment/99999999", wait_until="networkidle", timeout=20000)
        time.sleep(3)
        sc = screenshot(page, "A007_nonexistent")

        # Check page content
        content = page.content()
        url = page.url

        # Check for JS errors
        js_errors = []
        page.on("pageerror", lambda err: js_errors.append(str(err)))

        # Check for crash indicators
        if "Cannot read" in content or "undefined" in content.lower() or "TypeError" in content:
            add_result("A-007", "不存在的預約 URL", "FAIL",
                       "應顯示 404 或友善錯誤頁面",
                       f"頁面顯示 JS 錯誤或崩潰內容",
                       "頁面可能崩潰",
                       sc)
        elif page.query_selector(".error-message, .not-found, [class*='error']"):
            add_result("A-007", "不存在的預約 URL", "PASS",
                       "顯示友善錯誤訊息",
                       f"顯示錯誤頁面或提示",
                       "正確處理不存在的路由",
                       sc)
        else:
            # Check if it's showing empty form vs error
            text_content = page.inner_text('body') if page.query_selector('body') else ""
            if "99999999" in text_content or "找不到" in text_content or "not found" in text_content.lower():
                add_result("A-007", "不存在的預約 URL", "PASS",
                           "顯示錯誤提示",
                           f"頁面顯示找不到記錄的提示",
                           "",
                           sc)
            else:
                add_result("A-007", "不存在的預約 URL", "WARNING",
                           "應顯示明確錯誤訊息",
                           f"頁面行為不明確（既無錯誤也無明確提示）",
                           f"URL: {url}，需人工確認截圖",
                           sc)
    except Exception as e:
        sc = screenshot(page, "A007_error")
        add_result("A-007", "不存在的預約 URL", "FAIL",
                   "應優雅處理不存在的 ID",
                   f"導航發生例外: {str(e)[:200]}",
                   "頁面可能崩潰",
                   sc)


def test_a008_browser_back(page):
    """A-008: Browser back button state persistence"""
    log("\n=== A-008: 瀏覽器返回鍵測試 ===")
    try:
        # Go to appointment list
        page.goto(f"{BASE_URL}/aesthetics/#/appointment", wait_until="networkidle", timeout=20000)
        time.sleep(2)

        # Try to find create button
        create_btn = page.query_selector('button:has-text("新增"), button:has-text("建立"), a:has-text("新增")')
        if create_btn:
            create_btn.click()
            time.sleep(2)
            sc1 = screenshot(page, "A008_form_open")

            # Fill some data if form exists
            name_input = page.query_selector('input[placeholder*="名稱"], input[name="Name"]')
            if name_input:
                name_input.fill("A008-返回鍵測試資料")

            # Go back
            page.go_back()
            time.sleep(2)

            # Go forward
            page.go_forward()
            time.sleep(2)
            sc2 = screenshot(page, "A008_after_forward")

            content = page.inner_text('body')
            if "A008-返回鍵測試資料" in content:
                add_result("A-008", "瀏覽器返回鍵", "WARNING",
                           "返回後前進，表單狀態應被清除",
                           "前進後表單仍保有之前輸入的資料（狀態殘留）",
                           "可能導致使用者不小心提交舊資料",
                           sc2)
            else:
                add_result("A-008", "瀏覽器返回鍵", "PASS",
                           "返回鍵正常，無狀態殘留",
                           "前進後表單已清空或不存在",
                           "",
                           sc2)
        else:
            sc = screenshot(page, "A008_no_button")
            add_result("A-008", "瀏覽器返回鍵", "WARNING",
                       "找到新增按鈕並測試",
                       "找不到新增按鈕，無法完整測試",
                       "可能 UI 結構不同",
                       sc)
    except Exception as e:
        sc = screenshot(page, "A008_error")
        add_result("A-008", "瀏覽器返回鍵", "ERROR",
                   "測試流程正常執行",
                   f"例外: {str(e)[:200]}",
                   "",
                   sc)


def test_a009_rapid_submit(s, page):
    """A-009: Rapid submit (duplicate submission)"""
    log("\n=== A-009: 快速連點儲存（重複提交）===")
    resource = get_resource(s)
    bp = get_bpartner(s)

    if not resource:
        add_result("A-009", "重複提交防護", "ERROR", "測試執行", "無 S_Resource", "跳過")
        return

    # Simulate rapid API calls (5 identical requests simultaneously)
    import threading

    tomorrow = (datetime.now() + timedelta(days=4)).strftime("%Y-%m-%d")
    date_from = f"{tomorrow}T15:00:00+08:00"
    date_to = f"{tomorrow}T16:00:00+08:00"

    created_ids = []
    responses = []

    def make_request():
        r = create_assignment(s, resource.get('id'), bp.get('id') if bp else None,
                              date_from, date_to, name="A009-重複提交測試")
        responses.append(r)
        if r.status_code in [200, 201]:
            rid = r.json().get('id')
            if rid:
                created_ids.append(rid)

    threads = [threading.Thread(target=make_request) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    sc = screenshot(page, "A009_rapid_submit")
    success_count = sum(1 for r in responses if r.status_code in [200, 201])

    log(f"  Created {len(created_ids)} records from 5 rapid requests")

    if len(created_ids) > 1:
        add_result("A-009", "重複提交防護", "FAIL",
                   "快速連點應只建立一筆記錄",
                   f"5次並行請求建立了 {len(created_ids)} 筆重複記錄！IDs: {created_ids}",
                   "嚴重：無重複提交防護，可能造成重複預約",
                   sc)
    elif len(created_ids) == 1:
        add_result("A-009", "重複提交防護", "PASS",
                   "只建立一筆記錄",
                   f"5次並行請求只成功建立 1 筆，其他 {5-success_count} 次失敗",
                   "正確：有防重複機制",
                   sc)
    else:
        add_result("A-009", "重複提交防護", "WARNING",
                   "至少要能建立一筆記錄",
                   f"5次請求全部失敗，無法建立預約",
                   "測試環境問題或系統拒絕",
                   sc)

    # Cleanup
    for rid in created_ids:
        delete_assignment(s, rid)


def test_a010_api_illegal(s):
    """A-010: Illegal API calls"""
    log("\n=== A-010: API 建立非法預約 ===")
    resource = get_resource(s)
    bp = get_bpartner(s)

    # Test 1: AssignDateFrom > AssignDateTo
    tomorrow = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d")
    r1 = create_assignment(s, resource.get('id') if resource else 1000000,
                           bp.get('id') if bp else None,
                           f"{tomorrow}T20:00:00+08:00",
                           f"{tomorrow}T19:00:00+08:00",
                           name="A010-非法時間")

    if r1.status_code in [200, 201]:
        rid = r1.json().get('id')
        add_result("A-010a", "API 非法時間順序", "FAIL",
                   "拒絕 DateFrom > DateTo",
                   f"API 接受倒置時間，HTTP {r1.status_code}, id={rid}",
                   "嚴重：後端無業務邏輯驗證",
                   "")
        if rid:
            delete_assignment(s, rid)
    else:
        add_result("A-010a", "API 非法時間順序", "PASS",
                   "拒絕 DateFrom > DateTo",
                   f"HTTP {r1.status_code}: {r1.text[:200]}",
                   "正確",
                   "")

    # Test 2: No S_Resource_ID
    if not resource:
        add_result("A-010b", "API 無服務人員", "WARNING",
                   "拒絕無 S_Resource_ID",
                   "無法測試（無可用資源）",
                   "跳過", "")
        return

    payload_no_resource = {
        "Name": "A010-無服務人員",
        "AssignDateFrom": f"{tomorrow}T10:00:00+08:00",
        "AssignDateTo": f"{tomorrow}T11:00:00+08:00",
        "IsConfirmed": False,
    }
    r2 = s.post(f'{API_BASE}/models/S_ResourceAssignment',
                json=payload_no_resource,
                headers={'Content-Type': 'application/json'})

    if r2.status_code in [200, 201]:
        rid2 = r2.json().get('id')
        add_result("A-010b", "API 無服務人員", "FAIL",
                   "S_Resource_ID 應為必填",
                   f"API 接受無 S_Resource_ID 的預約，HTTP {r2.status_code}, id={rid2}",
                   "嚴重：沒有資源的預約無意義",
                   "")
        if rid2:
            delete_assignment(s, rid2)
    else:
        add_result("A-010b", "API 無服務人員", "PASS",
                   "S_Resource_ID 應為必填",
                   f"API 拒絕，HTTP {r2.status_code}: {r2.text[:200]}",
                   "正確：S_Resource_ID 為必填",
                   "")

    # Test 3: Non-existent resource ID
    r3 = create_assignment(s, 99999999, bp.get('id') if bp else None,
                           f"{tomorrow}T11:00:00+08:00",
                           f"{tomorrow}T12:00:00+08:00",
                           name="A010-不存在的服務人員")
    if r3.status_code in [200, 201]:
        rid3 = r3.json().get('id')
        add_result("A-010c", "API 不存在的服務人員 ID", "FAIL",
                   "拒絕不存在的 S_Resource_ID=99999999",
                   f"API 接受，HTTP {r3.status_code}, id={rid3}",
                   "嚴重：外鍵驗證缺失",
                   "")
        if rid3:
            delete_assignment(s, rid3)
    else:
        add_result("A-010c", "API 不存在的服務人員 ID", "PASS",
                   "拒絕不存在的外鍵",
                   f"HTTP {r3.status_code}: {r3.text[:200]}",
                   "正確：外鍵約束",
                   "")


def test_a011_double_delete(s):
    """A-011: Delete twice"""
    log("\n=== A-011: 刪除後立即再次刪除 ===")
    resource = get_resource(s)
    bp = get_bpartner(s)

    if not resource:
        add_result("A-011", "重複刪除", "ERROR", "測試執行", "無 S_Resource", "跳過")
        return

    tomorrow = (datetime.now() + timedelta(days=6)).strftime("%Y-%m-%d")
    r = create_assignment(s, resource.get('id'), bp.get('id') if bp else None,
                          f"{tomorrow}T08:00:00+08:00",
                          f"{tomorrow}T09:00:00+08:00",
                          name="A011-重複刪除測試")

    if r.status_code not in [200, 201]:
        add_result("A-011", "重複刪除", "ERROR",
                   "建立測試預約",
                   f"建立失敗 HTTP {r.status_code}",
                   "跳過")
        return

    record_id = r.json().get('id')
    log(f"  Created test record id={record_id}")

    # First delete
    r1 = delete_assignment(s, record_id)
    log(f"  First delete: HTTP {r1.status_code}")

    # Second delete immediately
    r2 = delete_assignment(s, record_id)
    log(f"  Second delete: HTTP {r2.status_code}")

    if r2.status_code in [200, 204]:
        add_result("A-011", "重複刪除", "FAIL",
                   "第二次刪除應返回 404 或錯誤",
                   f"第一次 HTTP {r1.status_code}，第二次仍返回 HTTP {r2.status_code}（成功）",
                   "警告：冪等性問題，可能造成誤刪其他記錄",
                   "")
    elif r2.status_code == 404:
        add_result("A-011", "重複刪除", "PASS",
                   "第二次刪除應返回 404",
                   f"第一次 HTTP {r1.status_code}，第二次 HTTP {r2.status_code} (Not Found)",
                   "正確：已刪除記錄無法再刪",
                   "")
    else:
        add_result("A-011", "重複刪除", "PASS",
                   "第二次刪除應返回錯誤",
                   f"第一次 HTTP {r1.status_code}，第二次 HTTP {r2.status_code}: {r2.text[:100]}",
                   "正確：有錯誤回應",
                   "")


def test_a012_calendar_view(s, page):
    """A-012: Month/Week calendar view"""
    log("\n=== A-012: 月視圖/週視圖顯示 ===")
    try:
        page.goto(f"{BASE_URL}/aesthetics/#/appointment", wait_until="networkidle", timeout=20000)
        time.sleep(3)
        sc1 = screenshot(page, "A012_initial_view")

        # Check current view
        content = page.inner_text('body')

        # Try to find month/week toggle buttons
        month_btn = page.query_selector('button:has-text("月"), [data-view="month"], .fc-month-button')
        week_btn = page.query_selector('button:has-text("週"), [data-view="week"], .fc-week-button')
        day_btn = page.query_selector('button:has-text("日"), [data-view="day"], .fc-day-button')

        issues = []

        if month_btn:
            month_btn.click()
            time.sleep(2)
            sc2 = screenshot(page, "A012_month_view")
            # Check for JS errors or blank areas
            month_content = page.inner_text('body')
            if len(month_content) < 50:
                issues.append("月視圖內容為空")
        else:
            issues.append("找不到月視圖切換按鈕")
            sc2 = sc1

        if week_btn:
            week_btn.click()
            time.sleep(2)
            sc3 = screenshot(page, "A012_week_view")
            week_content = page.inner_text('body')
            if len(week_content) < 50:
                issues.append("週視圖內容為空")
        else:
            issues.append("找不到週視圖切換按鈕")
            sc3 = sc1

        if issues:
            add_result("A-012", "月視圖/週視圖", "WARNING",
                       "月視圖和週視圖切換正常",
                       f"問題: {'; '.join(issues)}",
                       "需要人工確認截圖",
                       sc2)
        else:
            add_result("A-012", "月視圖/週視圖", "PASS",
                       "月視圖和週視圖切換正常",
                       "視圖切換正常，內容有顯示",
                       "",
                       sc2)
    except Exception as e:
        sc = screenshot(page, "A012_error")
        add_result("A-012", "月視圖/週視圖", "ERROR",
                   "視圖切換測試",
                   f"例外: {str(e)[:200]}",
                   "",
                   sc)


def test_a013_deselect_all_chips(page):
    """A-013: Deselect all resource chips"""
    log("\n=== A-013: 服務人員 chip 全部取消 ===")
    try:
        page.goto(f"{BASE_URL}/aesthetics/#/appointment", wait_until="networkidle", timeout=20000)
        time.sleep(3)
        sc1 = screenshot(page, "A013_before")

        # Find all resource chip/toggle buttons
        chips = page.query_selector_all('.chip, [class*="chip"], .resource-filter button, .doctor-chip, .fc-resource')
        if not chips:
            # Try broader selector
            chips = page.query_selector_all('[class*="resource"] button, [class*="doctor"] button')

        log(f"  Found {len(chips)} chips")

        if chips:
            for chip in chips:
                try:
                    chip.click()
                    time.sleep(0.5)
                except:
                    pass

            time.sleep(2)
            sc2 = screenshot(page, "A013_all_deselected")

            # Check if page crashed
            content = page.inner_text('body')
            title = page.title()

            if "error" in content.lower() or len(content) < 10:
                add_result("A-013", "服務人員 chip 全部取消", "FAIL",
                           "取消所有 chip 後頁面應顯示空白行事曆",
                           "頁面可能崩潰或內容為空",
                           "嚴重：UI 崩潰",
                           sc2)
            else:
                add_result("A-013", "服務人員 chip 全部取消", "PASS",
                           "取消所有 chip 後行事曆正常（顯示空白）",
                           f"頁面正常，內容長度={len(content)}",
                           "正確",
                           sc2)
        else:
            sc = screenshot(page, "A013_no_chips")
            add_result("A-013", "服務人員 chip 全部取消", "WARNING",
                       "找到並取消所有服務人員 chip",
                       "找不到 chip 元素，可能 selector 不對",
                       "需要人工確認頁面結構",
                       sc)
    except Exception as e:
        sc = screenshot(page, "A013_error")
        add_result("A-013", "服務人員 chip 全部取消", "ERROR",
                   "取消 chip 測試",
                   f"例外: {str(e)[:200]}",
                   "",
                   sc)


def test_a014_off_hours(s, page):
    """A-014: Off-hours appointment"""
    log("\n=== A-014: 非工作時間時槽 ===")
    resource = get_resource(s)
    bp = get_bpartner(s)

    if not resource:
        add_result("A-014", "非工作時間預約", "ERROR", "測試執行", "無 S_Resource", "跳過")
        return

    tomorrow = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")

    # Test midnight appointment (00:00-00:30)
    r = create_assignment(s, resource.get('id'), bp.get('id') if bp else None,
                          f"{tomorrow}T00:00:00+08:00",
                          f"{tomorrow}T00:30:00+08:00",
                          name="A014-午夜預約測試")

    created_id = None
    if r.status_code in [200, 201]:
        created_id = r.json().get('id')
        log(f"  Midnight appt created: id={created_id}")

        # Check if UI displays it
        try:
            page.goto(f"{BASE_URL}/aesthetics/#/appointment", wait_until="networkidle", timeout=20000)
            time.sleep(3)
            sc = screenshot(page, "A014_midnight_appt")

            add_result("A-014", "非工作時間預約", "WARNING",
                       "API 應拒絕或 UI 應顯示非工作時間警告",
                       f"API 接受午夜(00:00-00:30)預約，id={created_id}",
                       "無工作時間限制，可能造成混亂",
                       sc)
        except Exception as e:
            add_result("A-014", "非工作時間預約", "WARNING",
                       "API 應有工作時間限制",
                       f"API 接受午夜預約 id={created_id}，UI 導航例外: {str(e)[:100]}",
                       "無工作時間限制",
                       "")
    else:
        add_result("A-014", "非工作時間預約", "PASS",
                   "拒絕非工作時間預約",
                   f"API 拒絕午夜預約，HTTP {r.status_code}: {r.text[:200]}",
                   "有工作時間限制",
                   "")

    if created_id:
        delete_assignment(s, created_id)


# ─── MAIN ────────────────────────────────────────────────────────────────────

def main():
    log("=" * 60)
    log("檢查小組 A — 預約系統破壞性測試開始")
    log("=" * 60)

    s = authenticate()
    resource = get_resource(s)
    bp = get_bpartner(s)
    log(f"Resource: {resource}")
    log(f"BPartner: {bp}")

    pw, browser = get_browser()
    context = browser.new_context(ignore_https_errors=True)
    page = context.new_page()

    # Capture console errors
    console_errors = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda err: console_errors.append(f"PAGE ERROR: {err}"))

    # Login
    log("\n=== Logging in to UI ===")
    try:
        login_ui(page)
        sc = screenshot(page, "00_login")
        log(f"  Login screenshot: {sc}")
    except Exception as e:
        log(f"  Login failed: {e}")

    # Run all tests
    test_a001_reversed_time(s, page)
    test_a002_long_name(s, page)
    test_a003_empty_name(s, page)
    test_a004_xss_name(s, page)
    test_a005_time_conflict(s, page)
    test_a006_zero_duration(s, page)
    test_a007_nonexistent_url(page)
    test_a008_browser_back(page)
    test_a009_rapid_submit(s, page)
    test_a010_api_illegal(s)
    test_a011_double_delete(s)
    test_a012_calendar_view(s, page)
    test_a013_deselect_all_chips(page)
    test_a014_off_hours(s, page)

    browser.close()
    pw.stop()

    # Log console errors
    if console_errors:
        log(f"\n⚠️  UI Console Errors detected ({len(console_errors)}):")
        for err in console_errors[:20]:
            log(f"  - {err[:150]}")

    return results, console_errors


if __name__ == "__main__":
    results, console_errors = main()

    # Print summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    fail_count = sum(1 for r in results if r['status'] == 'FAIL')
    warn_count = sum(1 for r in results if r['status'] == 'WARNING')
    pass_count = sum(1 for r in results if r['status'] == 'PASS')
    error_count = sum(1 for r in results if r['status'] == 'ERROR')
    print(f"FAIL: {fail_count}, WARNING: {warn_count}, PASS: {pass_count}, ERROR: {error_count}")
    print(f"Total: {len(results)}")

    # Save results as JSON for report generation
    import json
    with open('/tmp/inspector_A_results.json', 'w', encoding='utf-8') as f:
        json.dump({'results': results, 'console_errors': console_errors[:50]}, f, ensure_ascii=False, indent=2)
    print("\nResults saved to /tmp/inspector_A_results.json")
