#!/bin/bash

# 清除 Jetty WAB cache 並重啟 iDempiere
# Usage: ./clear-cache-and-restart.sh

set -e

echo "=========================================="
echo "清除 Jetty cache 並重啟伺服器"
echo "=========================================="
echo ""

CACHE_DIR="/opt/idempiere-server/x86_64/jettyhome/work/jetty-0_0_0_0-8080-bundleFile-_aesthetics-any-"

# 檢查是否有 cache
if [ ! -d "$CACHE_DIR" ]; then
    echo "✓ 沒有 Jetty cache，無需清除"
else
    echo "1/3: 停止 iDempiere 伺服器..."
    echo '!QAZ2wsx' | sudo -S systemctl stop idempiere
    echo "✓ 伺服器已停止"

    echo ""
    echo "2/3: 清除 Jetty cache..."
    echo '!QAZ2wsx' | sudo -S rm -rf "$CACHE_DIR"*
    echo "✓ Cache 已清除"

    echo ""
    echo "3/3: 重啟伺服器..."
    echo '!QAZ2wsx' | sudo -S systemctl restart idempiere
    sleep 5

    if ps aux | grep -q "[j]ava.*idempiere"; then
        echo "✓ 伺服器已啟動"
    else
        echo "⚠️  伺服器啟動中，請稍候..."
        sleep 10
    fi
fi

echo ""
echo "=========================================="
echo "完成！現在用 Ctrl+Shift+R 重整頁面"
echo "=========================================="
