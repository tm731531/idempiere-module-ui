#!/bin/bash
# 清除 iDempiere Aesthetics UI 的 Jetty WAB 快取
# 用途：當部署新版本但 UI 沒有更新時，執行此腳本

echo "清除 Jetty WAB 快取..."
echo '!QAZ2wsx' | sudo -S rm -rf "/opt/idempiere-server/x86_64/jettyhome/work/jetty-0_0_0_0-8080-bundleFile-_aesthetics-any-"

if [ $? -eq 0 ]; then
    echo "✓ 快取已清除"
    echo ""
    echo "現在重新載入 Bundle..."

    # 登入 Felix
    CSRF=$(curl -ks -c /tmp/clear-cache.txt -b /tmp/clear-cache.txt 'https://localhost:8443/osgi/login.jsp' 2>/dev/null | grep -oP 'name="csrfToken"\s+value="\K[^"]+' | head -1)

    curl -ks -c /tmp/clear-cache.txt -b /tmp/clear-cache.txt -L \
        -d "username=SuperUser&password=System&csrfToken=$CSRF&returnUrl=/osgi/system/console/bundles" \
        'https://localhost:8443/osgi/login' 2>/dev/null -o /dev/null

    # 取得當前 bundle ID
    BUNDLE_ID=$(curl -ks -b /tmp/clear-cache.txt 'https://localhost:8443/osgi/system/console/bundles.json' 2>/dev/null | python3 -c "import json,sys;data=json.load(sys.stdin);[print(b['id']) for b in data.get('data',[]) if 'aesthetics' in b.get('symbolicName','')]" 2>/dev/null | head -1)

    if [ -n "$BUNDLE_ID" ]; then
        echo "停止 Bundle $BUNDLE_ID..."
        curl -ks -b /tmp/clear-cache.txt -X POST \
            "https://localhost:8443/osgi/system/console/bundles/$BUNDLE_ID?action=stop" \
            2>/dev/null -o /dev/null
        sleep 1

        echo "啟動 Bundle $BUNDLE_ID..."
        curl -ks -b /tmp/clear-cache.txt -X POST \
            "https://localhost:8443/osgi/system/console/bundles/$BUNDLE_ID?action=start" \
            2>/dev/null -o /dev/null
        sleep 2

        rm -f /tmp/clear-cache.txt
        echo "✓ Bundle 已重新載入"
        echo ""
        echo "請在瀏覽器中硬刷新（Ctrl+Shift+R）預約管理頁面"
    fi
else
    echo "✗ 失敗：需要 sudo 權限或伺服器未執行"
fi
