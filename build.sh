#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBAPP_DIR="$SCRIPT_DIR/webapp"
BUNDLE_DIR="$SCRIPT_DIR/osgi-bundle"
IDEMPIERE_HOME="${IDEMPIERE_HOME:-/home/tom/idempiere-server}"

BUILD_TIMESTAMP="$(date +%Y%m%d%H%M)"
JAR_NAME="org.idempiere.ui.aesthetics_1.0.0.${BUILD_TIMESTAMP}.jar"
OUTPUT_JAR="$SCRIPT_DIR/$JAR_NAME"

echo "=========================================="
echo "  iDempiere Aesthetics UI - Build Script"
echo "  Build: $BUILD_TIMESTAMP"
echo "=========================================="
echo ""

echo "[1/4] Building Vue frontend..."
cd "$WEBAPP_DIR"
npm run build
echo "Vue build complete"
echo ""

echo "[2/4] Preparing MANIFEST (qualifier → $BUILD_TIMESTAMP)..."
cd "$BUNDLE_DIR"
cp META-INF/MANIFEST.MF META-INF/MANIFEST.MF.bak
sed -i "s/Bundle-Version: 1.0.0.qualifier/Bundle-Version: 1.0.0.${BUILD_TIMESTAMP}/" META-INF/MANIFEST.MF

echo "[3/4] Building OSGi JAR..."
jar cfm "$OUTPUT_JAR" META-INF/MANIFEST.MF \
    -C . WEB-INF \
    -C . plugin.xml \
    -C web .

mv META-INF/MANIFEST.MF.bak META-INF/MANIFEST.MF

echo "JAR built: $JAR_NAME"
echo "Size: $(ls -lh "$OUTPUT_JAR" | awk '{print $5}')"
echo ""

if [ "$1" = "--deploy" ]; then
    rm -f "$IDEMPIERE_HOME/plugins/org.idempiere.ui.aesthetics_1.0.0"*.jar 2>/dev/null || true
    DEPLOY_JAR="$IDEMPIERE_HOME/plugins/$JAR_NAME"
    echo "[4/4] Deploying to $DEPLOY_JAR ..."
    cp "$OUTPUT_JAR" "$DEPLOY_JAR"
    echo "Deployed successfully."

    # Auto-update via Felix Web Console (bundle ID stays the same)
    FELIX_BASE="https://localhost:8443/osgi"
    BUNDLE_SYM="org.idempiere.ui.aesthetics"

    echo ""
    echo "[5/5] Activating via Felix Web Console..."

    # Login
    CSRF=$(curl -ks -c /tmp/felix-deploy -b /tmp/felix-deploy "$FELIX_BASE/login.jsp" | grep -oP 'name="csrfToken"\s+value="\K[^"]+')
    curl -ks -c /tmp/felix-deploy -b /tmp/felix-deploy -L \
        -d "username=SuperUser&password=System&csrfToken=$CSRF&returnUrl=/osgi/system/console/bundles" \
        "$FELIX_BASE/login" -o /dev/null

    # Find bundle ID by symbolic name
    BUNDLE_ID=$(curl -ks -b /tmp/felix-deploy "$FELIX_BASE/system/console/bundles.json" | \
        python3 -c "import json,sys;data=json.load(sys.stdin);[print(b['id']) for b in data.get('data',[]) if b.get('symbolicName')=='$BUNDLE_SYM']" 2>/dev/null)

    if [ -n "$BUNDLE_ID" ]; then
        # Update existing bundle in-place (keeps same bundle ID)
        HTTP_CODE=$(curl -ks -b /tmp/felix-deploy -X POST \
            -F "action=update" \
            -F "bundlefile=@$DEPLOY_JAR" \
            "$FELIX_BASE/system/console/bundles/$BUNDLE_ID" -o /dev/null -w "%{http_code}")
        if [ "$HTTP_CODE" = "200" ]; then
            echo "Bundle $BUNDLE_ID updated and active."
        else
            echo "WARNING: Update returned HTTP $HTTP_CODE"
        fi
    else
        # First install — no existing bundle found
        curl -ks -b /tmp/felix-deploy -X POST \
            -F "action=install" \
            -F "bundlefile=@$DEPLOY_JAR" \
            -F "bundlestart=start" \
            "$FELIX_BASE/system/console/bundles" -o /dev/null
        echo "Bundle installed and started (first deploy)."
    fi

    rm -f /tmp/felix-deploy
else
    echo "[4/4] Skipping deploy (use --deploy flag)"
fi

echo ""
echo "URL: https://<host>:8443/aesthetics/#/"
echo "=========================================="
