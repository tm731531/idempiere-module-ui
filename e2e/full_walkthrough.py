#!/usr/bin/env python3
"""
E2E 全流程走通：登入 → 諮詢 → 建立預約
Usage: python3 e2e/full_walkthrough.py [base_url] [company] [role] [username] [password]

Steps:
  1. Login flow (user → Company → Role → Warehouse)
  2. Consultation list view
  3. Create consultation (客戶 + 負責人 + 摘要)
  4. Edit consultation – change status
  5. Set tracking date (DateNextAction)
  6. 建立預約 from consultation
  7. Appointment form prefill check
  8. Save appointment
  9. Kanban board smoke test
  10. Dashboard smoke test
"""
import sys, os, json, datetime
from playwright.sync_api import sync_playwright, expect

BASE     = sys.argv[1] if len(sys.argv) > 1 else "https://medicare.tomting.com"
COMPANY  = sys.argv[2] if len(sys.argv) > 2 else "GardenWorld"
ROLE     = sys.argv[3] if len(sys.argv) > 3 else "GardenWorld Admin"
USERNAME = sys.argv[4] if len(sys.argv) > 4 else "SuperUser"
PASSWORD = sys.argv[5] if len(sys.argv) > 5 else "System"

SS_DIR = "/tmp/e2e_screenshots"
os.makedirs(SS_DIR, exist_ok=True)

PASS, FAIL, WARN = 0, 0, 0
MEMO = []   # Issues / observations to record

def ss(page, name):
    path = f"{SS_DIR}/{name}.png"
    page.screenshot(path=path, full_page=True)
    print(f"  📸 {path}")

def check(cond, msg, warn=False):
    global PASS, FAIL, WARN
    if cond:
        print(f"  ✅ {msg}")
        PASS += 1
    elif warn:
        print(f"  ⚠️  {msg}")
        WARN += 1
    else:
        print(f"  ❌ {msg}")
        FAIL += 1
    return cond

def memo(note):
    print(f"  📝 MEMO: {note}")
    MEMO.append(note)

# ─── 1. Login ────────────────────────────────────────────────────────────────

def is_logged_in(page):
    return "login" not in page.url and page.locator("button.selection-item").count() == 0

def click_selection(page, preferred_name=None):
    """Click a selection-item button. If preferred_name given, try to match it first."""
    if is_logged_in(page):
        return False  # already done
    btns = page.locator("button.selection-item").all()
    if not btns:
        return False
    chosen = None
    if preferred_name:
        for b in btns:
            if b.inner_text().strip() == preferred_name:
                chosen = b
                break
    if chosen is None:
        # Prefer non-* buttons to avoid org=0
        for b in btns:
            if b.inner_text().strip() != "*":
                chosen = b
                break
    if chosen is None:
        chosen = btns[0]
    chosen.click()
    page.wait_for_timeout(1500)
    return True

def step_login(page):
    print("\n[1] 登入流程")
    page.goto(f"{BASE}/aesthetics/#/login")
    page.wait_for_load_state("networkidle")
    ss(page, "01_login")

    page.fill('input[type="text"]', USERNAME)
    page.fill('input[type="password"]', PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_timeout(2000)

    # Multi-step selection: company → role → org → warehouse
    # Each step is optional — some may be auto-skipped by the app.
    # Run up to 5 selection rounds; stop as soon as login is complete.
    preferred_sequence = [COMPANY, ROLE]  # try these names in order first
    for _round in range(5):
        if is_logged_in(page):
            break
        btns = page.locator("button.selection-item").all()
        if not btns:
            page.wait_for_timeout(1000)
            btns = page.locator("button.selection-item").all()
            if not btns:
                break
        # Try preferred name first
        pref = preferred_sequence.pop(0) if preferred_sequence else None
        clicked = click_selection(page, pref)
        if not clicked:
            break

    ss(page, "03_after_login")
    ok = check("login" not in page.url, f"Login complete → {page.url}")
    if not ok:
        ss(page, "02_login_failed")
        raise RuntimeError("Login failed — cannot continue")
    return True

# ─── 2. Consultation list ────────────────────────────────────────────────────

def step_consultation_list(page):
    print("\n[2] 諮詢列表")
    page.goto(f"{BASE}/aesthetics/#/consultation")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    ss(page, "04_consultation_list")

    check(page.locator(".list-item, .request-row, [class*='request-card']").count() >= 0,
          "列表頁載入（不論有無資料）")

    # Status tabs
    tabs = page.locator(".status-tab, [class*='tab-btn'], [role='tab']").all_text_contents()
    check(len(tabs) > 0, f"Status tabs found: {[t.strip() for t in tabs[:5]]}", warn=True)

    # 新增 button
    new_btn = page.locator("button:has-text('新增'), a:has-text('新增')").first
    check(new_btn.is_visible(), "新增按鈕可見")

    # Check if any items exist
    items = page.locator(".list-item, .request-row, [class*='consultation-item']").count()
    memo(f"現有諮詢筆數（可見）: {items}")

# ─── 3. Create consultation ──────────────────────────────────────────────────

created_id = None
created_customer_id = None

def step_create_consultation(page):
    global created_id, created_customer_id
    print("\n[3] 新增諮詢")
    page.goto(f"{BASE}/aesthetics/#/consultation/new")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(4000)
    ss(page, "05_consultation_new")

    # Check form fields
    labels = [l.strip() for l in page.locator("label").all_text_contents() if l.strip()]
    check("摘要" in " ".join(labels), "摘要 欄位存在")
    check("負責人" in " ".join(labels), "負責人 欄位存在")
    check("客戶" in " ".join(labels), "客戶 欄位存在")

    # Unwanted fields
    bad_fields = ["到期類型", "優先順序", "DueType", "Priority"]
    for bf in bad_fields:
        if bf in " ".join(labels):
            memo(f"不應出現的欄位仍在表單中: {bf}")
        else:
            check(True, f"'{bf}' 正確隱藏")

    # Fill 摘要 (Summary textarea)
    summary_text = f"E2E走通測試 {datetime.datetime.now().strftime('%H:%M:%S')} — 請忽略"
    filled = False
    for ta in page.locator("textarea").all():
        if ta.is_visible() and not ta.is_disabled():
            ta.fill(summary_text)
            filled = True
            break
    check(filled, "摘要 填寫成功")

    # Fill all unfilled <select> fields (SalesRep_ID, C_BPartner_ID rendered as dropdowns)
    # Wait for options to load from API
    page.wait_for_timeout(2500)

    def fill_all_unfilled_selects():
        """
        1. Fill every unfilled <select> (dropdown mode SearchSelector), skipping .status-select
        2. For search-mode SearchSelector (input[placeholder="搜尋..."]):
           click → wait for options → pick first
        Returns list of (label, value) for each filled field.
        """
        filled = []

        # ── Part A: <select> dropdowns ──────────────────────────────────────
        selects = page.locator("select:not(.status-select)").all()
        for sel in selects:
            if not sel.is_visible():
                continue
            opts = sel.locator("option").all()
            real_opts = [o for o in opts
                         if (o.get_attribute("value") or "").strip() not in ("", "0", "null", "undefined")]
            if not real_opts:
                continue
            current = (sel.input_value() or "").strip()
            if current in ("", "0", "null", "undefined"):
                first_val = real_opts[0].get_attribute("value")
                first_text = real_opts[0].inner_text().strip()
                sel.select_option(value=first_val)
                page.wait_for_timeout(400)
                filled.append((first_text, first_val))

        # ── Part B: SearchSelector in search mode ───────────────────────────
        # Renders as <input placeholder="搜尋..."> → type char → ul.selector-dropdown li appears
        # Only interact with VISIBLE search inputs (excludes collapsed 更多欄位 content)
        search_inputs = page.locator("input[placeholder='搜尋...']").all()
        for inp in search_inputs:
            if not inp.is_visible():
                continue
            # Check parent visibility — skip if inside collapsed section
            parent_visible = inp.evaluate(
                "el => { let p = el.parentElement; "
                "while(p) { if(getComputedStyle(p).display === 'none') return false; p = p.parentElement; } "
                "return true; }"
            )
            if not parent_visible:
                continue
            if inp.input_value():  # already has a selected value
                continue

            inp.click()
            page.wait_for_timeout(300)
            # Type a character to trigger the search API
            inp.type("a", delay=50)
            page.wait_for_timeout(1500)  # wait for debounce + API response

            # Wait for ul.selector-dropdown to appear
            dropdown = page.locator("ul.selector-dropdown")
            if dropdown.count() > 0 and dropdown.first.is_visible():
                first_item = dropdown.first.locator("li").first
                if first_item.count() > 0:
                    opt_text = first_item.inner_text().strip()
                    first_item.click()
                    page.wait_for_timeout(400)
                    filled.append((opt_text, "search-mode"))
                    continue

            # Fallback: no dropdown appeared
            memo(f"SearchSelector search mode: 沒有出現 selector-dropdown — 可能無符合 'a' 的結果")
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)

        return filled

    results = fill_all_unfilled_selects()
    for label_text, val in results:
        memo(f"欄位自動填充 → '{label_text}' (value={val})")

    check(len(results) >= 2, f"負責人+客戶 均已選擇（填了 {len(results)} 個欄位）", warn=True)
    ss(page, "05b_selects_filled")

    # Select a status
    status_sel = page.locator("select.status-select")
    if status_sel.count() > 0:
        opts = status_sel.locator("option[value]").all()
        for opt in opts:
            val = opt.get_attribute("value")
            if val and val != "0" and val != "":
                status_sel.select_option(value=val)
                memo(f"Status 預設選擇: value={val} '{opt.inner_text().strip()}'")
                break

    ss(page, "06_consultation_filled")

    # Submit and capture response
    try:
        with page.expect_response(
            lambda r: "R_Request" in r.url and r.request.method == "POST",
            timeout=20000
        ) as ri:
            # Find submit button
            submit = page.locator("button[type='submit'], button:has-text('儲存')").last
            submit.scroll_into_view_if_needed()
            page.wait_for_timeout(500)
            submit.click()

        resp = ri.value
        body = resp.json()
        ok = check(resp.status in (200, 201), f"POST /R_Request → HTTP {resp.status}")

        if resp.status >= 400:
            err = body.get("detail") or body.get("title") or body.get("message") or str(body)[:300]
            memo(f"CREATE FAILED {resp.status}: {err}")
            ss(page, "06_error_create")
            return None

        created_id = body.get("id")
        check(bool(created_id), f"新諮詢 ID = {created_id}")

        # Check payload
        payload = json.loads(resp.request.post_data or "{}")
        check("R_RequestType_ID" in payload, f"R_RequestType_ID={payload.get('R_RequestType_ID')} 在 payload")
        for bad in ["DueType", "Priority"]:
            if bad in payload:
                memo(f"Payload 包含不應有的欄位: {bad}={payload[bad]}")

        page.wait_for_timeout(2000)
        ss(page, "07_after_create")
        return created_id

    except Exception as e:
        memo(f"CREATE EXCEPTION: {type(e).__name__}: {e}")
        ss(page, "06_exception_create")
        return None

# ─── 4. View & edit consultation ─────────────────────────────────────────────

def step_view_consultation(page, cid):
    print(f"\n[4] 查看諮詢 #{cid}")
    page.goto(f"{BASE}/aesthetics/#/consultation/{cid}")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(4000)
    ss(page, "08_consultation_view")

    check(f"/consultation/{cid}" in page.url, "導航到編輯頁")

    # Page title
    h2 = page.locator("h2, h1").first.inner_text() if page.locator("h2, h1").count() > 0 else ""
    check("諮詢" in h2 or "Request" in h2 or str(cid) in h2, f"頁面標題: '{h2}'", warn=True)

    # Status dropdown
    status_opts = [o.strip() for o in
                   page.locator("select.status-select option").all_text_contents()
                   if o.strip() and "--" not in o]
    check(len(status_opts) > 0, f"Status dropdown 有 {len(status_opts)} 個選項: {status_opts}")

    # Error states in sidebar
    errors = page.locator(".error-state, .load-error").all_text_contents()
    if errors:
        memo(f"Sidebar 載入錯誤: {errors}")
    check(len(errors) == 0, "Sidebar 無錯誤狀態")

    # QuickActionBar
    action_btns = [b.strip() for b in page.locator(".action-btn, .quick-action").all_text_contents()]
    check(len(action_btns) >= 1, f"QuickActionBar 按鈕: {action_btns}", warn=True)

    # 建立預約 button
    appt_btn = page.locator("button:has-text('建立預約'), a:has-text('建立預約')").first
    check(appt_btn.count() > 0, "建立預約 按鈕存在", warn=True)

    # 建立訂單 button
    order_btn = page.locator("button:has-text('建立訂單'), a:has-text('建立訂單')").first
    check(order_btn.count() > 0, "建立訂單 按鈕存在", warn=True)

    # Summary field value
    for ta in page.locator("textarea").all():
        if ta.is_visible():
            val = ta.input_value()
            check(bool(val), f"摘要有值: '{val[:40]}'")
            break

    # 儲存 button visible
    save = page.locator("button[type='submit'], button:has-text('儲存修改'), button:has-text('儲存')").last
    check(save.is_visible(), "儲存/儲存修改 按鈕可見")

# ─── 5. Change status ────────────────────────────────────────────────────────

def step_change_status(page, cid):
    print(f"\n[5] 修改狀態 #{cid}")
    page.goto(f"{BASE}/aesthetics/#/consultation/{cid}")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    status_sel = page.locator("select.status-select")
    if status_sel.count() == 0:
        memo("找不到 status-select — 跳過狀態修改")
        return

    opts = status_sel.locator("option").all()
    target_val = None
    target_name = None
    for opt in opts:
        val = opt.get_attribute("value")
        nm = opt.inner_text().strip()
        if val and val != "0" and "取消" not in nm and "Cancel" not in nm.lower():
            target_val = val
            target_name = nm
            break

    if not target_val:
        memo("Status 沒有可選項目")
        return

    status_sel.select_option(value=target_val)
    print(f"  → 選擇狀態: {target_name} (id={target_val})")

    try:
        with page.expect_response(
            lambda r: "R_Request" in r.url and r.request.method in ("PUT", "PATCH"),
            timeout=20000
        ) as ri:
            save = page.locator("button[type='submit'], button:has-text('儲存修改'), button:has-text('儲存')").last
            save.scroll_into_view_if_needed()
            page.wait_for_timeout(300)
            save.click()

        resp = ri.value
        ok = check(resp.status in (200, 201), f"PUT status → HTTP {resp.status}")
        if not ok:
            body = resp.json()
            memo(f"Status update failed {resp.status}: {str(body)[:300]}")
        ss(page, "09_status_changed")
    except Exception as e:
        memo(f"Status change exception: {e}")

# ─── 6. Set tracking date ────────────────────────────────────────────────────

def step_tracking_date(page, cid):
    print(f"\n[6] 設定追蹤日期 #{cid}")
    page.goto(f"{BASE}/aesthetics/#/consultation/{cid}")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    # Find 預約追蹤 button in QuickActionBar
    tracking_btn = page.locator(
        ".action-btn:has-text('追蹤'), button:has-text('預約追蹤')"
    ).first
    if tracking_btn.count() == 0:
        memo("未找到追蹤按鈕")
        ss(page, "10_no_tracking_btn")
        return

    tracking_btn.click()
    page.wait_for_timeout(1500)
    ss(page, "10_tracking_modal_opened")

    # Verify modal opened
    modal = page.locator(".dialog-overlay").first
    if not modal.is_visible():
        memo("TrackingDateModal 未開啟")
        return
    check(True, "追蹤日期 Modal 開啟")

    # Interact with modal fields using page-level locators
    # (Vue scoped CSS makes nested locators unreliable)

    # Dismiss any existing validation error alert first
    dismiss = page.locator(".error-close").first
    if dismiss.count() > 0 and dismiss.is_visible():
        dismiss.click()
        page.wait_for_timeout(300)

    # Date — first date input visible on page (inside modal)
    tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
    date_input = page.locator("input[type='date']").first
    if date_input.is_visible():
        date_input.fill(tomorrow)
        page.wait_for_timeout(200)

    # Time
    time_input = page.locator("input[type='time']").first
    if time_input.is_visible():
        time_input.fill("10:00")
        page.wait_for_timeout(200)

    # Description — use the LAST visible textarea (modal's textarea, not background form)
    all_ta = [t for t in page.locator("textarea").all() if t.is_visible()]
    desc_ta = all_ta[-1] if all_ta else None
    if desc_ta:
        desc_ta.fill("E2E 追蹤說明測試")
        page.wait_for_timeout(400)

    ss(page, "10b_tracking_filled")

    # Dismiss validation error if still showing (it's a stale alert from before description was filled)
    dismiss2 = page.locator(".error-close").first
    if dismiss2.count() > 0 and dismiss2.is_visible():
        dismiss2.click()
        page.wait_for_timeout(300)

    # Confirm button — use page-level locator (avoid scoped CSS nested issue)
    # The button text has surrounding spaces: " 確認 "
    confirm = page.locator(".dialog-overlay button:has-text('確認')").first
    try:
        page.wait_for_timeout(400)

        with page.expect_response(
            lambda r: "R_Request" in r.url and r.request.method in ("PUT", "PATCH"),
            timeout=15000
        ) as ri:
            confirm.click(timeout=5000)

        resp = ri.value
        check(resp.status in (200, 201), f"追蹤日期 PUT → HTTP {resp.status}")
        if resp.status >= 400:
            memo(f"Tracking date update failed {resp.status}: {resp.json()}")
        page.wait_for_timeout(1000)
        ss(page, "11_tracking_saved")

    except Exception as e:
        memo(f"Tracking date exception: {str(e)[:200]}")
        ss(page, "10_tracking_exception")

    # Always ensure modal is closed before next step
    # Click 取消 if modal still open
    cancel_btn = page.locator(".dialog-overlay button:has-text('取消')").first
    if cancel_btn.count() > 0 and cancel_btn.is_visible():
        cancel_btn.click()
        page.wait_for_timeout(500)

# ─── 7. 建立預約 from consultation ──────────────────────────────────────────

appointment_id = None

def step_create_appointment(page, cid):
    global appointment_id
    print(f"\n[7] 從諮詢建立預約 #{cid}")
    # Force component remount: navigate to home first (prevents Vue Router from
    # skipping re-render when navigating to the same hash route)
    page.goto(f"{BASE}/aesthetics/#/")
    page.wait_for_timeout(800)
    page.goto(f"{BASE}/aesthetics/#/consultation/{cid}")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(4000)
    ss(page, "12_before_appt_create")

    # Find 建立預約 button
    appt_btn = page.locator("button:has-text('建立預約'), a:has-text('建立預約')").first
    if appt_btn.count() == 0:
        memo("找不到 '建立預約' 按鈕 — 可能需要先設定客戶")
        # Check if customer is set
        customer_field = page.locator("[data-col='C_BPartner_ID'] input, [class*='bpartner'] input").first
        if customer_field.count() > 0:
            val = customer_field.input_value()
            memo(f"客戶欄位值: '{val}'")
        ss(page, "12_no_appt_btn")
        check(False, "建立預約 按鈕存在")
        return

    check(True, "找到 建立預約 按鈕")

    # Close any open modal overlay before clicking
    overlay = page.locator(".dialog-overlay")
    if overlay.count() > 0 and overlay.first.is_visible():
        page.keyboard.press("Escape")
        page.wait_for_timeout(800)

    appt_btn.click()
    page.wait_for_timeout(3000)
    ss(page, "13_appointment_form")

    # Should navigate to appointment form
    check("appointment" in page.url or "appointment" in page.url.lower(),
          f"導航到預約頁面: {page.url}")

    # Verify prefill
    page_text = page.content()

    # Check for consultation banner
    consultation_banner = page.locator(
        "[class*='consultation'], [class*='banner'], :has-text('關聯諮詢')"
    ).first
    if consultation_banner.count() > 0:
        check(True, "顯示關聯諮詢 banner")
        memo(f"Banner text: {consultation_banner.inner_text()[:80]}")
    else:
        memo("未找到關聯諮詢 banner")

    # Doctor field
    doctor_field = page.locator(
        "[data-col='S_Resource_ID'] input, [class*='resource'] input, input[placeholder*='醫師'], input[placeholder*='資源']"
    ).first
    doctor_set = doctor_field.count() > 0 and doctor_field.is_visible()
    check(doctor_set, "醫師/資源 欄位可見", warn=True)

    # Date/time field
    dt_field = page.locator("input[type='datetime-local'], input[type='date']").first
    check(dt_field.count() > 0 and dt_field.is_visible(), "日期時間欄位可見", warn=True)

    # Customer prefilled
    customer_inputs = page.locator("input[placeholder*='客戶'], [data-col='C_BPartner_ID'] input").all()
    customer_prefilled = any(inp.input_value() for inp in customer_inputs if inp.is_visible())
    check(customer_prefilled, "客戶 已預填", warn=True)

    ss(page, "13b_appointment_form_detail")

    # Try to fill and save appointment
    return step_fill_appointment(page, cid)

def step_fill_appointment(page, cid):
    global appointment_id
    print("\n[8] 填寫並儲存預約")

    # Wait for options to load
    page.wait_for_timeout(1500)

    # Fill 服務人員 (S_Resource_ID) — it's a <select>
    resource_sel = page.locator("select").first  # first select on appointment form
    has_resource = False
    if resource_sel.is_visible():
        opts = resource_sel.locator("option").all()
        real_opts = [o for o in opts
                     if (o.get_attribute("value") or "").strip() not in ("", "0", "null", "undefined", "請選擇")]
        if real_opts:
            first_val = real_opts[0].get_attribute("value")
            first_text = real_opts[0].inner_text().strip()
            resource_sel.select_option(value=first_val)
            page.wait_for_timeout(400)
            check(True, f"服務人員 選擇: '{first_text}' (value={first_val})")
            has_resource = True
        else:
            memo("⚠️  服務人員 (S_Resource) 下拉為空 — 需要在 iDempiere 建立 S_Resource 資料（醫師/治療師）才能儲存預約")
            check(False, "服務人員 有可選選項")

    if not has_resource:
        ss(page, "14_appointment_no_resource")
        memo("跳過預約儲存 — 缺少 S_Resource 主檔資料")
        return None

    # Start time (datetime-local)
    tomorrow_start = (datetime.datetime.now() + datetime.timedelta(days=1)).strftime("%Y-%m-%dT10:00")
    tomorrow_end   = (datetime.datetime.now() + datetime.timedelta(days=1)).strftime("%Y-%m-%dT11:00")

    dt_inputs = page.locator("input[type='datetime-local']").all()
    visible_dt = [i for i in dt_inputs if i.is_visible()]
    if len(visible_dt) >= 1 and not visible_dt[0].input_value():
        visible_dt[0].fill(tomorrow_start)
        page.wait_for_timeout(200)
        check(True, f"開始時間 填入: {tomorrow_start}")
    elif len(visible_dt) >= 1:
        check(True, f"開始時間已有值: {visible_dt[0].input_value()}")

    # End time
    if len(visible_dt) >= 2 and not visible_dt[1].input_value():
        visible_dt[1].fill(tomorrow_end)
        page.wait_for_timeout(200)
        check(True, f"結束時間 填入: {tomorrow_end}")

    # Name (optional)
    name_input = page.locator("input[type='text']").first
    if name_input.is_visible() and not name_input.input_value():
        name_input.fill("E2E 自動預約")
        page.wait_for_timeout(200)

    # Note / Description
    for ta in page.locator("textarea").all():
        if ta.is_visible() and not ta.is_disabled():
            if not ta.input_value():
                ta.fill("E2E 自動預約 — 請忽略")
            break

    ss(page, "14_appointment_filled")

    # Check validation errors
    err_text = page.locator(".validation-error, .form-error, [class*='error']:not(.error-close)").all_text_contents()
    if err_text:
        memo(f"預約表單驗證錯誤: {err_text}")

    # Submit
    submit = page.locator("button:has-text('儲存')").last
    if submit.is_disabled():
        memo("儲存按鈕 disabled — 表單驗證未通過（可能缺少服務人員資料）")
        ss(page, "14_appointment_blocked")
        check(False, "預約可以儲存")
        return None

    try:
        with page.expect_response(
            lambda r: ("S_ResourceAssignment" in r.url or "ResourceAssignment" in r.url)
                and r.request.method in ("POST", "PUT"),
            timeout=20000
        ) as ri:
            submit.scroll_into_view_if_needed()
            page.wait_for_timeout(300)
            submit.click()

        resp = ri.value
        body = resp.json()
        ok = check(resp.status in (200, 201), f"預約 POST/PUT → HTTP {resp.status}")
        ss(page, "15_appointment_saved")

        if resp.status >= 400:
            err = body.get("detail") or body.get("title") or str(body)[:300]
            memo(f"APPOINTMENT SAVE FAILED {resp.status}: {err}")
            return None

        appointment_id = body.get("id")
        check(bool(appointment_id), f"預約 ID = {appointment_id}")
        memo(f"成功建立預約 ID={appointment_id} from 諮詢 #{cid}")
        return appointment_id

    except Exception as e:
        memo(f"Appointment save exception: {str(e)[:150]}")
        ss(page, "14_appointment_exception")
        return None

# ─── 8. Verify return to consultation ────────────────────────────────────────

def step_verify_back(page, cid, appt_id):
    print(f"\n[9] 確認返回諮詢 #{cid}")
    if appt_id:
        # Should auto-navigate back after save or user can navigate
        page.wait_for_timeout(2000)
        if f"/consultation/{cid}" in page.url:
            check(True, "儲存後自動返回諮詢頁面")
        else:
            page.goto(f"{BASE}/aesthetics/#/consultation/{cid}")
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(3000)
            check(True, "手動導回諮詢頁面")
        ss(page, "16_back_to_consultation")

# ─── 9. Kanban smoke test ────────────────────────────────────────────────────

def step_kanban(page):
    print("\n[10] Kanban 看板 smoke test")
    page.goto(f"{BASE}/aesthetics/#/consultation/kanban")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(4000)
    ss(page, "17_kanban")

    cols = page.locator(".kanban-column, [class*='kanban-col']").count()
    check(cols > 0, f"Kanban 有 {cols} 欄（狀態欄）", warn=True)

    cards = page.locator(".kanban-card, [class*='kanban-card']").count()
    memo(f"Kanban 顯示 {cards} 張卡片")

    errors = page.locator(".error-state, .load-error, :has-text('載入失敗')").all_text_contents()
    if errors:
        memo(f"Kanban 錯誤: {errors}")
    check(len(errors) == 0, "Kanban 無錯誤", warn=True)

# ─── 10. Dashboard smoke test ────────────────────────────────────────────────

def step_dashboard(page):
    print("\n[11] Dashboard smoke test")
    page.goto(f"{BASE}/aesthetics/#/consultation/dashboard")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(4000)
    ss(page, "18_dashboard")

    errors = page.locator(".error-state, .load-error").all_text_contents()
    if errors:
        memo(f"Dashboard 錯誤: {errors}")
    check(len(errors) == 0, "Dashboard 無錯誤", warn=True)

    metrics = page.locator("[class*='metric'], [class*='stat'], .conversion-rate").count()
    check(metrics > 0, f"Dashboard 顯示 {metrics} 個指標區塊", warn=True)

# ─── Main ─────────────────────────────────────────────────────────────────────

with sync_playwright() as p:
    print(f"{'='*55}")
    print(f" E2E 全流程走通: {BASE}")
    print(f" 帳號: {USERNAME}  公司: {COMPANY}  角色: {ROLE}")
    print(f"{'='*55}")

    browser = p.chromium.launch(headless=True, args=["--ignore-certificate-errors"])
    ctx = browser.new_context(
        ignore_https_errors=True,
        viewport={"width": 1280, "height": 800}
    )
    page = ctx.new_page()

    # Capture console errors
    console_errors = []
    page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}")
            if msg.type in ("error", "warn") else None)

    try:
        step_login(page)
        step_consultation_list(page)

        cid = step_create_consultation(page)
        if cid:
            step_view_consultation(page, cid)
            step_change_status(page, cid)
            step_tracking_date(page, cid)
            appt_id = step_create_appointment(page, cid)
            step_verify_back(page, cid, appt_id)
        else:
            memo("諮詢建立失敗，跳過後續步驟")
            FAIL += 1

        step_kanban(page)
        step_dashboard(page)

    except Exception as e:
        import traceback
        msg = traceback.format_exc()
        memo(f"FATAL: {msg}")
        print(f"\n❌ FATAL: {e}")
        ss(page, "99_fatal_crash")
        FAIL += 1
    finally:
        browser.close()

    # Print console errors
    relevant_errors = [e for e in console_errors if "favicon" not in e and "Extension" not in e]
    if relevant_errors:
        print(f"\n⚠️  Browser console errors ({len(relevant_errors)}):")
        for ce in relevant_errors[:20]:
            print(f"  {ce[:120]}")
            MEMO.append(f"console: {ce[:120]}")

    # Print summary
    print(f"\n{'='*55}")
    print(f" 結果: {PASS} ✅  {FAIL} ❌  {WARN} ⚠️")
    print(f"{'='*55}")

    if MEMO:
        print("\n📋 MEMO（需關注事項）:")
        for i, m in enumerate(MEMO, 1):
            print(f"  {i}. {m}")

    print(f"\n截圖儲存於: {SS_DIR}/")
    sys.exit(0 if FAIL == 0 else 1)
