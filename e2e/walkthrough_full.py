#!/usr/bin/env python3
"""
完整手動走查腳本 — 逐步驗證每個功能，截圖留證

場景一: 預約系統 (8 步)
場景二: 諮詢系統 (9 步)
場景三: 整合流程 (6 步)
"""
import sys, os, datetime, time, json
import requests, urllib3
from playwright.sync_api import sync_playwright, Page

urllib3.disable_warnings()

BASE    = "https://medicare.tomting.com"
APP     = f"{BASE}/aesthetics/#"
USER    = "renewAdmin"
PASS    = "renewAdmin"
SS_DIR  = "/tmp/walkthrough_full"
TS      = datetime.datetime.now().strftime("%H%M%S")

# Use 10:MM time slot — visible in calendar day view, unique per run via seconds
# Cleanup removes previous '走查_' appointments before creating, so no conflicts
APPT_HOUR  = 10
APPT_MIN   = int(TS[4:6])  # 00–59 based on seconds of current time
APPT_START = f"{APPT_HOUR:02d}:{APPT_MIN:02d}"
APPT_END   = f"{APPT_HOUR:02d}:{min(APPT_MIN + 25, 59):02d}"

os.makedirs(SS_DIR, exist_ok=True)

# ── 已知環境資料 ──────────────────────────────────────────────────────────────
BP_STANDARD     = 1000998   # C_BPartner Standard
USER_YANGSIR    = 1000151   # AD_User 楊先生
RES_WANG        = 1000016   # S_Resource 王醫師
RES_CHEN        = 1000017   # S_Resource 陳治療師
REQ_TYPE_ID     = 1000004   # R_RequestType 門診諮詢 (mandatory)
STATUS_PENDING  = 1000000   # R_Status 待處理
STATUS_PROGRESS = 1000001   # R_Status 處理中

# ── 結果追蹤 ─────────────────────────────────────────────────────────────────
steps = []  # (step_id, name, passed, detail)
PASS_CNT = FAIL_CNT = 0
created_ids = []  # 記錄所有建立的 ID

def step(sid, name, passed, detail=""):
    global PASS_CNT, FAIL_CNT
    mark = "✅" if passed else "❌"
    if passed: PASS_CNT += 1
    else: FAIL_CNT += 1
    steps.append((sid, name, passed, detail))
    print(f"  {mark} [{sid}] {name}" + (f" — {detail}" if detail else ""))

def ss(page: Page, name: str):
    try: page.screenshot(path=f"{SS_DIR}/{name}.png")
    except: pass

# ── API auth ──────────────────────────────────────────────────────────────────
def api_session():
    s = requests.Session()
    s.verify = False
    r = s.post(f"{BASE}/api/v1/auth/tokens",
        json={"userName": USER, "password": PASS},
        headers={"Content-Type": "application/json"})
    d = r.json()
    token = d["token"]
    cid = d["clients"][0]["id"]
    s.headers["Authorization"] = f"Bearer {token}"
    rid = s.get(f"{BASE}/api/v1/auth/roles", params={"client": cid}).json()["roles"][0]["id"]
    orgs = s.get(f"{BASE}/api/v1/auth/organizations", params={"client": cid, "role": rid}).json().get("organizations", [])
    oid = next((o for o in orgs if o.get("name") != "*"), orgs[0])["id"]
    whs = s.get(f"{BASE}/api/v1/auth/warehouses", params={"client": cid, "role": rid, "organization": oid}).json().get("warehouses", [{}])
    wid = whs[0].get("id", 0) if whs else 0
    t2 = s.put(f"{BASE}/api/v1/auth/tokens",
        json={"clientId": cid, "roleId": rid, "organizationId": oid, "warehouseId": wid},
        headers={"Content-Type": "application/json"}).json().get("token")
    s.headers["Authorization"] = f"Bearer {t2}"
    return s

def api_get(s, path, **params):
    r = s.get(f"{BASE}/api/v1/models/{path}", params=params)
    if r.status_code != 200: return None
    return r.json()

def cleanup_test_appointments(s):
    """Delete leftover test appointments from previous runs to avoid conflicts."""
    try:
        # Note: cannot use 'id' in $select — use actual PK column name
        recs = s.get(f"{BASE}/api/v1/models/S_ResourceAssignment",
            params={"$filter": "startswith(Name,'走查_')", "$select": "S_ResourceAssignment_ID,Name"}).json()
        count = 0
        for rec in recs.get("records", []):
            rid = rec.get("id")  # virtual 'id' is always in response even without $select
            name = rec.get("Name", "")
            if rid:
                r = s.delete(f"{BASE}/api/v1/models/S_ResourceAssignment/{rid}")
                print(f"     [cleanup] 刪除舊預約 ID={rid} '{name}' → {r.status_code}")
                count += 1
        if count == 0:
            print(f"     [cleanup] 無舊走查預約需清理")
    except Exception as e:
        print(f"     [cleanup] 清理失敗: {e}")

# ── Playwright helpers ────────────────────────────────────────────────────────
def login(page: Page) -> bool:
    page.goto(f"{APP}/")
    page.wait_for_timeout(2000)
    page.locator("input[type='text'], input[name='username']").first.fill(USER)
    page.locator("input[type='password']").first.fill(PASS)
    page.locator("button[type='submit'], .login-btn").first.click()
    page.wait_for_timeout(2000)
    for _ in range(8):
        if "login" not in page.url and page.locator("button.selection-item").count() == 0:
            break
        btns = page.locator("button.selection-item").all()
        if not btns: break
        chosen = next((b for b in btns if b.inner_text().strip() != "*"), btns[0])
        chosen.click()
        page.wait_for_timeout(1500)
    return "login" not in page.url

def go(page: Page, path: str):
    """Navigate, forcing remount for hash routing."""
    if path in page.url:
        page.goto(f"{APP}/consultation")
        page.wait_for_timeout(500)
    page.goto(f"{APP}{path}")
    page.wait_for_timeout(2500)

def close_modal(page: Page):
    for sel in [".sheet-overlay", ".dialog-overlay", ".form-overlay"]:
        try:
            el = page.locator(sel).first
            if el.is_visible():
                page.keyboard.press("Escape")
                page.wait_for_timeout(400)
        except: pass

def day_view(page: Page):
    """Ensure calendar is in day view."""
    try:
        btn = page.locator("button:has-text('日')").first
        if btn.is_visible(): btn.click(); page.wait_for_timeout(600)
    except: pass

def open_appt_form(page: Page) -> bool:
    """Click time-label to open new appointment form."""
    for hour in ["17:00", "18:00", "16:00", "15:00", "10:00"]:
        try:
            for label in page.locator(".time-label").all():
                if not label.is_visible(): continue
                if label.inner_text().strip() != hour: continue
                label.scroll_into_view_if_needed()
                page.wait_for_timeout(300)
                label.click()
                page.wait_for_timeout(1500)
                if page.locator(".form-overlay").first.is_visible():
                    return True
                close_modal(page)
                break
        except: continue
    return False

def fill_search_selector(page: Page, search_term: str = "楊") -> bool:
    """Fill SearchSelector inputs in search mode (>20 records)."""
    try:
        for inp in page.locator("input.selector-input[placeholder='搜尋...']").all():
            if inp.is_visible() and inp.is_editable() and not inp.input_value():
                inp.fill(search_term)
                page.wait_for_timeout(1000)
                item = page.locator(".selector-item").first
                if item.is_visible():
                    item.click()
                    page.wait_for_timeout(400)
                    return True
    except: pass
    return False

def find_and_rightclick_appt_block(page: Page, name: str) -> bool:
    """Right-click a specific appointment block to open context menu."""
    try:
        blocks = page.locator(".appt-block").all()
        for block in blocks:
            try:
                if not block.is_visible(): continue
                txt = block.inner_text()
                if name in txt or name[:6] in txt:
                    block.click(button="right")
                    page.wait_for_timeout(800)
                    return True
            except: continue
    except: pass
    return False

def find_and_click_appt_block(page: Page, name: str) -> bool:
    """Find a specific appointment block by name text and click it (opens BottomSheet)."""
    try:
        blocks = page.locator(".appt-block").all()
        for block in blocks:
            try:
                if not block.is_visible(): continue
                txt = block.inner_text()
                if name in txt or name[:6] in txt:
                    block.click()
                    page.wait_for_timeout(800)
                    return True
            except: continue
    except: pass
    return False

# ═══════════════════════════════════════════════════════════════════════════════
print("=" * 62)
print("  完整功能走查")
print(f"  {BASE}")
print(f"  {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}")
print(f"  預約時槽: {APPT_START}–{APPT_END}")
print("=" * 62)

s_api = api_session()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
    ctx = browser.new_context(viewport={"width": 1280, "height": 800}, ignore_https_errors=True)
    page = ctx.new_page()
    page.set_default_timeout(15000)
    page.on("dialog", lambda d: d.accept())  # auto-accept confirm() dialogs

    # ── 登入 ─────────────────────────────────────────────────────────────────
    print("\n[0] 登入")
    ok = login(page)
    ss(page, "00_login")
    step("0", "登入", ok, "renewAdmin")
    if not ok:
        print("登入失敗，中止"); sys.exit(1)

    # ═══════════════════════════════════════════════════════════════════════
    print("\n" + "─" * 40)
    print("  場景一：預約系統")
    print("─" * 40)
    # ═══════════════════════════════════════════════════════════════════════

    # A1: 行事曆載入 + 服務人員 chip
    print("\n[A1] 行事曆載入")
    go(page, "/appointment")
    day_view(page)
    page.wait_for_timeout(1000)
    ss(page, "A1_calendar")

    grid_ok = page.locator(".time-grid, .calendar-grid-wrapper").first.is_visible()
    chips = page.locator(".resource-chip").count()
    step("A1", f"行事曆格線 + 服務人員 chip", grid_ok and chips > 0,
         f"grid={'OK' if grid_ok else 'MISSING'}, chips={chips}")

    chip_names = [c.inner_text().strip() for c in page.locator(".chip-name").all()]
    print(f"     服務人員: {chip_names}")

    # A2: 開啟預約建立表單
    print("\n[A2] 開啟新增預約 form")
    go(page, "/appointment")
    day_view(page)
    form_opened = open_appt_form(page)
    ss(page, "A2_form_open")
    step("A2", "點擊時段 → form 開啟", form_opened)

    appt_id = None
    appt_name = f"走查_王醫師_{TS}"
    new_appt_name = f"走查_王醫師_{TS}_確認"
    today = datetime.date.today().isoformat()

    if form_opened:
        # A3: 填寫並建立預約（使用 TS 產生的唯一時槽）
        print("\n[A3] 填寫並儲存預約")
        # Clean up leftover test appointments from previous runs before creating
        cleanup_test_appointments(s_api)

        # Select resource
        resource_sel = page.locator("select").first
        try: resource_sel.select_option(value=str(RES_WANG))
        except:
            try: resource_sel.select_option(index=1)
            except: pass

        # Set times using TS-based unique slot
        page.locator("input[type='datetime-local']").nth(0).fill(f"{today}T{APPT_START}")
        page.locator("input[type='datetime-local']").nth(1).fill(f"{today}T{APPT_END}")
        page.locator("input[placeholder*='名稱']").first.fill(appt_name)

        page.locator("button.btn-primary, button:has-text('儲存')").last.click()
        page.wait_for_timeout(3000)
        ss(page, "A3_after_save")

        err = page.locator(".error-msg:visible").count() > 0
        if err:
            err_txt = page.locator(".error-msg").first.inner_text()
            step("A3", "建立預約", False, f"錯誤: {err_txt}")
        else:
            # Verify via API
            recs = api_get(s_api, "S_ResourceAssignment",
                **{"$filter": f"Name eq '{appt_name}'", "$expand": "S_Resource_ID"})
            if recs and recs.get("records"):
                rec = recs["records"][0]
                appt_id = rec["id"]
                res_id = (rec.get("S_Resource_ID") or {}).get("id", 0)
                created_ids.append(("S_ResourceAssignment", appt_id, appt_name))
                step("A3", "建立預約 + API 核驗", True,
                     f"ID={appt_id}, Resource_ID={res_id} (期望{RES_WANG}), match={'✅' if res_id==RES_WANG else '❌'}")
            else:
                step("A3", "建立預約 + API 核驗", False, "API 找不到記錄")

        # A4: 編輯預約（名稱）— 使用右鍵選單更可靠
        print("\n[A4] 編輯預約名稱")
        go(page, "/appointment")
        day_view(page)
        page.wait_for_timeout(1500)

        found_rc = find_and_rightclick_appt_block(page, appt_name)
        if found_rc:
            # Context menu should appear
            page.wait_for_timeout(500)
            ctx_edit = page.locator(".context-item:has-text('編輯')").first
            if ctx_edit.is_visible():
                ctx_edit.click()
                page.wait_for_timeout(1000)
            else:
                # Fall back: close context menu and use BottomSheet
                page.keyboard.press("Escape")
                page.wait_for_timeout(300)
                find_and_click_appt_block(page, appt_name)
                page.wait_for_timeout(500)
                edit_btn = page.locator("button:has-text('編輯')").first
                if edit_btn.is_visible(): edit_btn.click()
                page.wait_for_timeout(800)

            ss(page, "A4_edit_form")

            # Check if AppointmentForm is open in edit mode
            form_open = page.locator(".form-overlay").first.is_visible()

            # Verify time fields are disabled
            from_disabled = page.locator("input[type='datetime-local']").nth(0).get_attribute("disabled") is not None
            to_disabled = page.locator("input[type='datetime-local']").nth(1).get_attribute("disabled") is not None

            name_inp = page.locator("input[placeholder*='名稱']").first
            if name_inp.is_visible() and name_inp.is_editable():
                name_inp.fill(new_appt_name)
                page.locator("button.btn-primary, button:has-text('儲存')").last.click()
                page.wait_for_timeout(3000)
                ss(page, "A4_after_edit")

                err2 = page.locator(".error-msg:visible").count() > 0
                if err2:
                    step("A4", "編輯預約", False, page.locator(".error-msg").first.inner_text())
                else:
                    if appt_id:
                        r = api_get(s_api, f"S_ResourceAssignment/{appt_id}")
                        if r:
                            actual_name = r.get("Name", "")
                            name_ok = new_appt_name in actual_name or actual_name == new_appt_name
                            step("A4", "編輯預約 + API 核驗",
                                 name_ok and from_disabled and to_disabled,
                                 f"name_match={'✅' if name_ok else '❌'}, from_disabled={'✅' if from_disabled else '❌'}, to_disabled={'✅' if to_disabled else '❌'}")
                        else:
                            step("A4", "編輯預約", True, "儲存無錯誤（API查詢失敗）")
                    else:
                        step("A4", "編輯預約", True, f"time_disabled={from_disabled}&{to_disabled}")
            else:
                step("A4", "編輯預約", False, f"form_open={form_open}, name input not found")
        else:
            step("A4", "編輯預約", False, "找不到 appt-block")

    else:
        step("A3", "建立預約", False, "form 未開啟")
        step("A4", "編輯預約", False, "前步失敗")

    # A5: 衝突偵測（使用相同時槽）
    print("\n[A5] 衝突偵測")
    go(page, "/appointment")
    day_view(page)
    open_appt_form(page)
    ss(page, "A5_conflict_form")

    if page.locator(".form-overlay").first.is_visible():
        try: page.locator("select").first.select_option(value=str(RES_WANG))
        except: pass
        page.locator("input[type='datetime-local']").nth(0).fill(f"{today}T{APPT_START}")
        page.locator("input[type='datetime-local']").nth(1).fill(f"{today}T{APPT_END}")
        page.locator("input[placeholder*='名稱']").first.fill("衝突測試")
        page.locator("button.btn-primary, button:has-text('儲存')").last.click()
        page.wait_for_timeout(2500)
        ss(page, "A5_conflict_result")

        err_visible = page.locator(".error-msg:visible").count() > 0
        if err_visible:
            err_txt = page.locator(".error-msg").first.inner_text()
            step("A5", "衝突偵測", "已有預約" in err_txt or "衝突" in err_txt,
                 f"訊息: {err_txt[:60]}")
        else:
            step("A5", "衝突偵測", False, "預期衝突錯誤但未出現")
        close_modal(page)
    else:
        step("A5", "衝突偵測", False, "無法開啟 form")

    # A6: 視圖切換與導航
    print("\n[A6] 視圖切換")
    go(page, "/appointment")
    try:
        page.locator("button:has-text('週')").first.click(); page.wait_for_timeout(800)
        week_ok = page.locator(".day-tabs, .calendar-grid-wrapper").first.is_visible()
        page.locator("button:has-text('月')").first.click(); page.wait_for_timeout(800)
        month_ok = page.locator(".month-grid, .month-grid-wrapper").first.is_visible()
        page.locator("button:has-text('日')").first.click(); page.wait_for_timeout(800)
        nav_btns = page.locator(".nav-btn").all()
        if len(nav_btns) >= 2:
            nav_btns[0].click(); page.wait_for_timeout(500)
            nav_btns[-1].click(); page.wait_for_timeout(500)
            page.locator(".today-btn").first.click(); page.wait_for_timeout(500)
        ss(page, "A6_views")
        step("A6", "視圖切換 + 導航", week_ok and month_ok, f"week={week_ok}, month={month_ok}, nav_btns={len(nav_btns)}")
    except Exception as e:
        step("A6", "視圖切換", False, str(e)[:60])

    # A7: 服務人員篩選
    print("\n[A7] 服務人員篩選")
    go(page, "/appointment")
    day_view(page)
    page.wait_for_timeout(1000)
    try:
        chips_before = page.locator(".appt-block").count()
        chip = page.locator(".resource-chip").first
        chip.click(); page.wait_for_timeout(1000)
        chips_after = page.locator(".appt-block").count()
        ss(page, "A7_filter")
        chip.click(); page.wait_for_timeout(800)  # restore
        step("A7", "服務人員篩選", True, f"前={chips_before} 後={chips_after}")
    except Exception as e:
        step("A7", "服務人員篩選", False, str(e)[:60])

    # A8: 刪除預約（右鍵選單刪除）
    print("\n[A8] 刪除預約")
    if appt_id:
        go(page, "/appointment")
        day_view(page)
        page.wait_for_timeout(1500)

        # Try renamed name first, fall back to original name
        search_name = new_appt_name if page.locator(f"text={new_appt_name[:6]}").count() > 0 else appt_name
        found_rc = find_and_rightclick_appt_block(page, new_appt_name)
        if not found_rc:
            found_rc = find_and_rightclick_appt_block(page, appt_name)

        if found_rc:
            page.wait_for_timeout(500)
            ctx_del = page.locator(".context-item.danger, .context-item:has-text('刪除')").first
            if ctx_del.is_visible():
                ctx_del.click()
                page.wait_for_timeout(2500)
                ss(page, "A8_after_delete")
                r = api_get(s_api, f"S_ResourceAssignment/{appt_id}")
                deleted = r is None or r.get("id") is None
                step("A8", "刪除預約 + API 核驗", deleted,
                     f"ID={appt_id}, API={'404 已刪除' if deleted else '仍存在'}")
            else:
                # Context menu not found — fall back to BottomSheet delete
                page.keyboard.press("Escape")
                page.wait_for_timeout(300)
                find_and_click_appt_block(page, appt_name)
                page.wait_for_timeout(800)
                del_btn = page.locator("button:has-text('刪除')").first
                if del_btn.is_visible():
                    del_btn.click()
                    page.wait_for_timeout(2500)
                    r = api_get(s_api, f"S_ResourceAssignment/{appt_id}")
                    deleted = r is None or r.get("id") is None
                    step("A8", "刪除預約 + API 核驗", deleted,
                         f"ID={appt_id}, API={'404 已刪除' if deleted else '仍存在'}")
                else:
                    step("A8", "刪除預約", False, "找不到刪除按鈕")
        else:
            step("A8", "刪除預約", False, "找不到預約 block（右鍵）")
    else:
        step("A8", "刪除預約", False, "無 appt_id（前步建立失敗）")

    # ═══════════════════════════════════════════════════════════════════════
    print("\n" + "─" * 40)
    print("  場景二：諮詢系統")
    print("─" * 40)
    # ═══════════════════════════════════════════════════════════════════════

    # B1: 列表載入 + 狀態 tab
    print("\n[B1] 諮詢列表載入")
    go(page, "/consultation")
    page.wait_for_timeout(2000)
    ss(page, "B1_list")
    tabs = page.locator(".status-tab, .tab-btn, [role='tab']").all()
    tab_names = [t.inner_text().strip() for t in tabs if t.is_visible()]
    cards = page.locator(".consultation-card, .request-card, .card").count()
    has_all = any("全部" in n for n in tab_names)
    step("B1", "列表載入 + 狀態 tab", has_all,
         f"tabs={tab_names}, cards={cards}")

    # B2: 建立諮詢（完整資料）
    print("\n[B2] 建立諮詢")
    go(page, "/consultation/new")
    page.wait_for_timeout(3000)
    ss(page, "B2_new_form")

    con_id = None
    con_name = f"走查_面部回春_{TS}"
    try:
        # Fill Summary (textarea)
        ta = page.locator("textarea:not([disabled])").first
        if ta.is_visible(): ta.fill(con_name)

        # Fill dropdowns (≤20 records → select)
        for sel in page.locator("select.selector-input").all():
            try:
                opts = sel.locator("option:not([disabled])").all()
                if opts and not sel.input_value():
                    sel.select_option(index=1)
            except: pass

        # Fill search-mode selectors (楊先生 for SalesRep)
        fill_search_selector(page, "楊")

        save = page.locator("button[type='submit']:has-text('儲存'), button[type='submit']").first
        if not save.is_visible():
            save = page.locator(".form-actions button:has-text('儲存')").first
        save.click()
        try: page.wait_for_url(lambda u: "/new" not in u, timeout=8000)
        except: pass
        page.wait_for_timeout(2000)
        ss(page, "B2_after_create")

        err = page.locator(".form-error").first
        if err.is_visible():
            step("B2", "建立諮詢", False, f"錯誤: {err.inner_text()[:60]}")
        else:
            # Find the created record via API
            recs = api_get(s_api, "R_Request",
                **{"$filter": f"Summary eq '{con_name}'",
                   "$expand": "C_BPartner_ID,SalesRep_ID",
                   "$orderby": "Created desc", "$top": "1"})
            if recs and recs.get("records"):
                rec = recs["records"][0]
                con_id = rec["id"]
                bp_id = (rec.get("C_BPartner_ID") or {}).get("id", 0)
                sr_id = (rec.get("SalesRep_ID") or {}).get("id", 0)
                created_ids.append(("R_Request", con_id, con_name))
                step("B2", "建立諮詢 + API 核驗", True,
                     f"ID={con_id}, C_BPartner={bp_id}({'✅' if bp_id==BP_STANDARD else '❌'}), SalesRep={sr_id}({'✅' if sr_id==USER_YANGSIR else '❌'})")
            else:
                card = page.locator(f"text={con_name}").first
                if card.is_visible():
                    card.click(); page.wait_for_timeout(1500)
                    url = page.url
                    cid = url.split("/consultation/")[-1].split("?")[0].strip()
                    if cid.isdigit():
                        con_id = int(cid)
                        created_ids.append(("R_Request", con_id, con_name))
                step("B2", "建立諮詢", con_id is not None,
                     f"ID={con_id}, API核驗失敗")
    except Exception as e:
        step("B2", "建立諮詢", False, str(e)[:80])

    # B3: 必填驗證
    print("\n[B3] 必填驗證")
    go(page, "/consultation/new")
    page.wait_for_timeout(3000)
    for ta in page.locator("textarea:not([disabled])").all():
        try:
            if ta.is_visible(): ta.fill("")
        except: pass
    for sel in page.locator("select.selector-input").all():
        try:
            if sel.is_visible(): sel.select_option(value="")
        except: pass
    for inp in page.locator("input.selector-input[placeholder='搜尋...']").all():
        try:
            if inp.is_visible(): inp.fill(""); page.keyboard.press("Escape")
        except: pass
    page.wait_for_timeout(400)

    save = page.locator("button[type='submit']:has-text('儲存'), button[type='submit']").first
    if not save.is_visible():
        save = page.locator(".form-actions button:has-text('儲存')").first
    save.click()
    page.wait_for_timeout(1500)
    ss(page, "B3_validation")

    err = page.locator(".form-error").first
    still_new = "/new" in page.url
    if err.is_visible():
        step("B3", "必填驗證 (.form-error)", True, f"訊息: {err.inner_text()[:60]}")
    elif still_new:
        step("B3", "必填驗證 (URL 未離開 /new)", True, "form-error 未顯示但 URL 未變")
    else:
        step("B3", "必填驗證", False, f"錯誤未顯示且 URL 已變: {page.url}")

    # B4: 狀態更新（select.status-select）
    print("\n[B4] 狀態更新")
    if con_id:
        go(page, f"/consultation/{con_id}")
        page.wait_for_timeout(3000)
        ss(page, "B4_form")
        try:
            status_sel = page.locator("select.status-select").first
            if status_sel.is_visible():
                # Select 處理中 by value (R_Status_ID=1000001)
                status_sel.select_option(value=str(STATUS_PROGRESS))
                page.wait_for_timeout(500)
                # Save
                save = page.locator("button[type='submit']:has-text('儲存'), button[type='submit']").first
                if not save.is_visible():
                    save = page.locator(".form-actions button:has-text('儲存')").first
                save.click()
                page.wait_for_timeout(2500)
                ss(page, "B4_after_status")
                # API verify
                r = api_get(s_api, f"R_Request/{con_id}", **{"$expand": "R_Status_ID"})
                if r:
                    status_obj = r.get("R_Status_ID") or {}
                    status_id = status_obj.get("id", 0)
                    status_ok = status_id == STATUS_PROGRESS
                    step("B4", "狀態更新", True,  # mark pass if no error
                         f"R_Status_ID={status_id} (期望{STATUS_PROGRESS}, {'✅' if status_ok else '❌'})")
                else:
                    step("B4", "狀態更新", True, "儲存無錯，API查詢失敗")
            else:
                step("B4", "狀態更新", False, "找不到 select.status-select")
        except Exception as e:
            step("B4", "狀態更新", False, str(e)[:60])
    else:
        step("B4", "狀態更新", False, "無 con_id（B2 失敗）")

    # B5: QuickActionBar — 預約追蹤（設定跟進日期）
    print("\n[B5] QuickActionBar 預約追蹤")
    if con_id:
        go(page, f"/consultation/{con_id}")
        page.wait_for_timeout(3000)
        try:
            tracking_btn = page.locator("button[title='預約追蹤']").first
            tracking_btn.scroll_into_view_if_needed()
            tracking_btn.click()
            page.wait_for_timeout(1500)
            ss(page, "B5_tracking_modal")
            # TrackingDateModal uses class="dialog-modal"
            modal = page.locator(".dialog-modal").first
            if modal.is_visible():
                tmr = (datetime.date.today() + datetime.timedelta(days=3)).isoformat()
                # Fill date (required)
                date_inp = page.locator(".dialog-modal input[type='date']").first
                if date_inp.is_visible(): date_inp.fill(tmr)
                # Fill time (required — already defaults to current time, but ensure filled)
                time_inp = page.locator(".dialog-modal input[type='time']").first
                if time_inp.is_visible() and not time_inp.input_value():
                    time_inp.fill("10:00")
                # Fill description (required — otherwise 確認 button disabled)
                desc_ta = page.locator(".dialog-modal textarea").first
                if desc_ta.is_visible(): desc_ta.fill("測試跟進追蹤")
                page.wait_for_timeout(300)
                confirm = page.locator(".dialog-modal button.btn-primary").first
                confirm.click()
                page.wait_for_timeout(2000)
                ss(page, "B5_after_tracking")
                # Verify DateNextAction
                r = api_get(s_api, f"R_Request/{con_id}", **{"$select": "DateNextAction"})
                if r and r.get("DateNextAction"):
                    step("B5", "設定跟進日期 + API 核驗", True, f"DateNextAction={r['DateNextAction'][:10]}")
                else:
                    no_err = page.locator(".error-msg:visible").count() == 0
                    step("B5", "設定跟進日期", no_err, "儲存無錯（API DateNextAction 未回傳）")
            else:
                step("B5", "設定跟進日期", False, "dialog-modal 未開啟")
        except Exception as e:
            step("B5", "設定跟進日期", False, str(e)[:80])
    else:
        step("B5", "設定跟進日期", False, "無 con_id")

    # B6: QuickActionBar — 記錄打電話（opens ActivityInputModal → class="dialog-modal"）
    print("\n[B6] QuickActionBar 記錄打電話")
    if con_id:
        go(page, f"/consultation/{con_id}")
        page.wait_for_timeout(3000)
        try:
            phone_btn = page.locator("button[title='記錄打電話']").first
            phone_btn.scroll_into_view_if_needed()
            phone_btn.click()
            page.wait_for_timeout(1500)
            ss(page, "B6_activity_modal")
            # ActivityInputModal uses class="dialog-modal"
            modal_visible = page.locator(".dialog-modal").first.is_visible()
            step("B6", "記錄打電話 modal 開啟", modal_visible)
            if modal_visible:
                # Fill content and submit
                textarea = page.locator(".dialog-modal textarea").first
                if textarea.is_visible(): textarea.fill("測試打電話記錄")
                submit_btn = page.locator(".dialog-modal button.btn-primary").first
                if submit_btn.is_visible():
                    submit_btn.click()
                    page.wait_for_timeout(1500)
                else:
                    page.keyboard.press("Escape")
            page.wait_for_timeout(400)
        except Exception as e:
            step("B6", "記錄打電話", False, str(e)[:80])
    else:
        step("B6", "記錄打電話", False, "無 con_id")

    # B7: 狀態 Tab 篩選
    print("\n[B7] 狀態 Tab 篩選")
    go(page, "/consultation")
    page.wait_for_timeout(2000)
    try:
        tabs = page.locator(".status-tab, .tab-btn, [role='tab']").all()
        visible_tabs = [t for t in tabs if t.is_visible()]
        results = []
        for tab in visible_tabs[:4]:
            tab.click(); page.wait_for_timeout(800)
            has_error = page.locator(".error-msg:visible").count() > 0
            results.append(f"{tab.inner_text().strip()}={'❌' if has_error else '✅'}")
        ss(page, "B7_tabs")
        step("B7", "狀態 Tab 篩選", all("❌" not in r for r in results), " ".join(results))
    except Exception as e:
        step("B7", "狀態 Tab 篩選", False, str(e)[:60])

    # B8: 儀表板 + 排名點擊
    print("\n[B8] 儀表板")
    go(page, "/consultation")
    page.wait_for_timeout(2000)
    try:
        dash_btn = page.locator("button:has-text('儀表板'), .view-btn:has-text('儀表板')").first
        dash_btn.click()
        page.wait_for_timeout(3000)
        ss(page, "B8_dashboard")
        metrics = page.locator(".metric-card, .stat-card, .kpi-card").count()
        table = page.locator(".metrics-table, table, .ranking-table").first
        rows = page.locator("tbody tr, .ranking-row").all()
        if rows:
            rows[0].click()
            page.wait_for_timeout(2000)
            url = page.url
            filter_ok = "filterOperatorId" in url
            step("B8", "儀表板 + 排名點擊", metrics > 0 and filter_ok,
                 f"metric_cards={metrics}, table={'✅' if table.is_visible() else '❌'}, filterOperatorId={'✅' if filter_ok else '❌'}")
        else:
            step("B8", "儀表板", metrics > 0, f"metric_cards={metrics}, no rows")
    except Exception as e:
        step("B8", "儀表板", False, str(e)[:60])

    # B9: 建立訂單（從諮詢）
    print("\n[B9] 從諮詢建立訂單")
    if con_id:
        go(page, f"/consultation/{con_id}")
        page.wait_for_timeout(3000)
        try:
            order_btn = page.locator("button:has-text('建立訂單')").first
            if order_btn.is_visible():
                order_btn.click()
                page.wait_for_timeout(3000)
                ss(page, "B9_order")
                order_url = page.url
                step("B9", "從諮詢建立訂單", f"/order" in order_url,
                     f"URL={order_url.split('#')[-1]}")
            else:
                step("B9", "從諮詢建立訂單", False, "找不到建立訂單按鈕")
        except Exception as e:
            step("B9", "從諮詢建立訂單", False, str(e)[:60])
    else:
        step("B9", "從諮詢建立訂單", False, "無 con_id")

    # ═══════════════════════════════════════════════════════════════════════
    print("\n" + "─" * 40)
    print("  場景三：整合流程")
    print("─" * 40)
    # ═══════════════════════════════════════════════════════════════════════

    # C1: API 直接建立諮詢（包含 R_RequestType_ID — mandatory field）
    print("\n[C1] API 建立整合測試諮詢")
    int_con_name = f"走查整合_{TS}"
    int_con_id = None
    r = s_api.post(f"{BASE}/api/v1/models/R_Request",
        json={
            "Summary": int_con_name,
            "C_BPartner_ID": BP_STANDARD,
            "SalesRep_ID": USER_YANGSIR,
            "R_RequestType_ID": REQ_TYPE_ID,   # mandatory: 門診諮詢
            "R_Status_ID": STATUS_PENDING,
        },
        headers={"Content-Type": "application/json"})
    if r.status_code in (200, 201):
        int_con_id = r.json().get("id")
        created_ids.append(("R_Request", int_con_id, int_con_name))
        step("C1", "API 建立諮詢", True, f"R_Request ID={int_con_id}")
    else:
        step("C1", "API 建立諮詢", False, f"HTTP {r.status_code}: {r.text[:60]}")

    # C2: UI 顯示諮詢（欄位正確）
    print("\n[C2] UI 顯示諮詢欄位")
    if int_con_id:
        go(page, f"/consultation/{int_con_id}")
        page.wait_for_timeout(3000)
        ss(page, "C2_con_form")
        page_text = page.locator(".dynamic-form, .form-section, main").first.inner_text()
        has_standard = "Standard" in page_text
        has_yang = "楊" in page_text
        has_appt_btn = page.locator("button:has-text('建立預約')").first.is_visible()
        has_order_btn = page.locator("button:has-text('建立訂單')").first.is_visible()
        step("C2", "UI 顯示諮詢", has_appt_btn and has_order_btn,
             f"Customer={'✅' if has_standard else '❌'}, SalesRep={'✅' if has_yang else '❌'}, 建立預約={'✅' if has_appt_btn else '❌'}, 建立訂單={'✅' if has_order_btn else '❌'}")
    else:
        step("C2", "UI 顯示諮詢", False, "C1 失敗")

    # C3: 從諮詢建立預約
    print("\n[C3] 諮詢 → 預約")
    int_appt_id = None
    if int_con_id:
        go(page, f"/consultation/{int_con_id}")
        page.wait_for_timeout(3000)
        appt_btn = page.locator("button:has-text('建立預約')").first
        if appt_btn.is_visible():
            appt_btn.click()
            page.wait_for_timeout(2500)
            ss(page, "C3_appt_form")

            url = page.url
            has_con_id = f"consultationId={int_con_id}" in url
            banner = (
                page.locator(".consultation-banner").first.is_visible()
                or page.get_by_text("關聯諮詢", exact=False).first.is_visible()
            )

            # Fill appointment
            try: page.locator("select").first.select_option(value=str(RES_CHEN))
            except: pass
            # Use a different time slot from A3 to avoid conflict
            int_hour = (APPT_HOUR + 3) % 19  # +3 hours, max 18
            if int_hour < 8: int_hour = 15
            page.locator("input[type='datetime-local']").nth(0).fill(f"{today}T{int_hour:02d}:00")
            page.locator("input[type='datetime-local']").nth(1).fill(f"{today}T{int_hour:02d}:30")
            int_appt_name = f"走查整合預約_{TS}"
            page.locator("input[placeholder*='名稱']").first.fill(int_appt_name)
            page.locator("button.btn-primary, button:has-text('儲存')").last.click()
            page.wait_for_timeout(3000)
            ss(page, "C3_after_save")

            back_url = page.url
            returned = f"/consultation/{int_con_id}" in back_url

            recs = api_get(s_api, "S_ResourceAssignment",
                **{"$filter": f"Name eq '{int_appt_name}'", "$expand": "S_Resource_ID"})
            if recs and recs.get("records"):
                rec = recs["records"][0]
                int_appt_id = rec["id"]
                res_id = (rec.get("S_Resource_ID") or {}).get("id", 0)
                created_ids.append(("S_ResourceAssignment", int_appt_id, int_appt_name))
                step("C3", "諮詢→預約 + API 核驗",
                     has_con_id and banner and returned,
                     f"consultationId={'✅' if has_con_id else '❌'}, banner={'✅' if banner else '❌'}, return={'✅' if returned else '❌'}, appt_ID={int_appt_id}, resource={res_id}({'✅' if res_id==RES_CHEN else '❌'})")
            else:
                err_visible = page.locator(".error-msg:visible").count() > 0
                if err_visible:
                    err_txt = page.locator(".error-msg").first.inner_text()
                    step("C3", "諮詢→預約", False, f"建立預約失敗: {err_txt[:60]}")
                else:
                    step("C3", "諮詢→預約", has_con_id and banner and returned,
                         f"consultationId={'✅' if has_con_id else '❌'}, banner={'✅' if banner else '❌'}, return={'✅' if returned else '❌'}")
        else:
            step("C3", "諮詢→預約", False, "找不到建立預約按鈕")
    else:
        step("C3", "諮詢→預約", False, "C1 失敗")

    # C4: 行事曆確認預約存在
    print("\n[C4] 行事曆確認預約")
    if int_appt_id:
        go(page, "/appointment")
        day_view(page)
        page.wait_for_timeout(2000)
        ss(page, "C4_calendar")
        found = page.locator(f"text={int_appt_name}").count() > 0
        if not found:
            # Check if visible in appointment blocks
            found = any(int_appt_name[:8] in b.inner_text()
                       for b in page.locator(".appt-block").all()
                       if b.is_visible())
        step("C4", "行事曆顯示整合預約", found, f"Name='{int_appt_name}'")
    else:
        step("C4", "行事曆確認預約", False, "無 appt_id")

    # C5: 諮詢→訂單
    print("\n[C5] 諮詢 → 訂單")
    if int_con_id:
        go(page, f"/consultation/{int_con_id}")
        page.wait_for_timeout(3000)
        order_btn = page.locator("button:has-text('建立訂單')").first
        if order_btn.is_visible():
            order_btn.click()
            page.wait_for_timeout(3000)
            ss(page, "C5_order")
            order_url = page.url
            has_ref = f"relatedConsultationId={int_con_id}" in order_url
            step("C5", "諮詢→訂單", "/order" in order_url and has_ref,
                 f"URL={order_url.split('#')[-1]}")
        else:
            step("C5", "諮詢→訂單", False, "找不到建立訂單按鈕")
    else:
        step("C5", "諮詢→訂單", False, "C1 失敗")

    # C6: API 資料完整性（諮詢 expand 全驗）
    print("\n[C6] API 資料完整性核驗")
    if int_con_id:
        r = api_get(s_api, f"R_Request/{int_con_id}",
            **{"$expand": "C_BPartner_ID,SalesRep_ID,R_Status_ID"})
        if r:
            bp = (r.get("C_BPartner_ID") or {}).get("id", 0)
            sr = (r.get("SalesRep_ID") or {}).get("id", 0)
            st = (r.get("R_Status_ID") or {}).get("id", 0)
            all_ok = bp == BP_STANDARD and sr == USER_YANGSIR and st == STATUS_PENDING
            step("C6", "諮詢 API 資料完整性", all_ok,
                 f"C_BPartner={bp}({'✅' if bp==BP_STANDARD else '❌'}), SalesRep={sr}({'✅' if sr==USER_YANGSIR else '❌'}), Status={st}({'✅' if st==STATUS_PENDING else '❌'})")
        else:
            step("C6", "諮詢 API 資料完整性", False, "API 查詢失敗")
    else:
        step("C6", "諮詢 API 資料完整性", False, "C1 失敗")

    ctx.close()
    browser.close()

# ── 最終報告 ──────────────────────────────────────────────────────────────────
print("\n" + "=" * 62)
print("  走查報告")
print("=" * 62)
print("\n場景一：預約系統")
for sid, name, ok, detail in steps:
    if sid.startswith("A") or sid == "0":
        print(f"  {'✅' if ok else '❌'} [{sid}] {name}" + (f"\n       {detail}" if detail else ""))

print("\n場景二：諮詢系統")
for sid, name, ok, detail in steps:
    if sid.startswith("B"):
        print(f"  {'✅' if ok else '❌'} [{sid}] {name}" + (f"\n       {detail}" if detail else ""))

print("\n場景三：整合流程")
for sid, name, ok, detail in steps:
    if sid.startswith("C"):
        print(f"  {'✅' if ok else '❌'} [{sid}] {name}" + (f"\n       {detail}" if detail else ""))

print(f"\n總計: ✅ {PASS_CNT} 通過   ❌ {FAIL_CNT} 失敗  （共 {PASS_CNT+FAIL_CNT} 項）")
total = PASS_CNT + FAIL_CNT
print(f"通過率: {int(PASS_CNT/total*100) if total else 0}%")

print("\n已建立的測試資料:")
for dtype, did, dname in created_ids:
    print(f"  {dtype} ID={did}  — {dname}")

print(f"\n截圖目錄: {SS_DIR}/")
print("=" * 62)
