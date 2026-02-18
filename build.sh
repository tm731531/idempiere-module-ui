#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBAPP_DIR="$SCRIPT_DIR/webapp"
BUNDLE_DIR="$SCRIPT_DIR/osgi-bundle"
IDEMPIERE_HOME="${IDEMPIERE_HOME:-/home/tom/idempiere-server}"

BUILD_TIMESTAMP="$(date +%Y%m%d%H%M)"
# Use full timestamp for version to force Jetty to recognize as new bundle
BUILD_VERSION="1.0.0.${BUILD_TIMESTAMP}"
JAR_NAME="org.idempiere.ui.aesthetics_${BUILD_VERSION}.jar"
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

# Update index.html with actual Vite-generated asset hashes
echo "[1b/4] Updating index.html asset hashes..."
cd "$SCRIPT_DIR/osgi-bundle/web"

# Find the actual generated hashes from the assets directory
# Vite generates main-*.js (or index-*.js depending on config)
MAIN_JS=$(ls -t assets/main-*.js 2>/dev/null | head -1)
if [ -z "$MAIN_JS" ]; then
  MAIN_JS=$(ls -t assets/index-*.js 2>/dev/null | head -1)
fi
MAIN_JS=$(basename "$MAIN_JS" 2>/dev/null)

VUE_VENDOR=$(ls -t assets/vue-vendor-*.js 2>/dev/null | head -1 | xargs -r basename)
PRIMEVUE_VENDOR=$(ls -t assets/primevue-vendor-*.js 2>/dev/null | head -1 | xargs -r basename)

# CSS can be main-*.css or index-*.css
MAIN_CSS=$(ls -t assets/main-*.css 2>/dev/null | head -1)
if [ -z "$MAIN_CSS" ]; then
  MAIN_CSS=$(ls -t assets/index-*.css 2>/dev/null | head -1)
fi
MAIN_CSS=$(basename "$MAIN_CSS" 2>/dev/null)

if [ -n "$MAIN_JS" ] && [ -n "$VUE_VENDOR" ] && [ -n "$PRIMEVUE_VENDOR" ] && [ -n "$MAIN_CSS" ]; then
    echo "Found assets: $MAIN_JS, $VUE_VENDOR, $PRIMEVUE_VENDOR, $MAIN_CSS"

    # Create new index.html with updated hashes
    cat > index.html << HTMLEOF
<!DOCTYPE html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>醫美診所</title>
    <script type="module" crossorigin src="/aesthetics/assets/${MAIN_JS}"></script>
    <link rel="modulepreload" crossorigin href="/aesthetics/assets/${VUE_VENDOR}">
    <link rel="modulepreload" crossorigin href="/aesthetics/assets/${PRIMEVUE_VENDOR}">
    <link rel="stylesheet" crossorigin href="/aesthetics/assets/${MAIN_CSS}">
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
HTMLEOF
    echo "✓ index.html updated with latest hashes"
else
    echo "⚠️  Warning: Could not find all expected assets, index.html may not be updated"
    echo "  MAIN_JS=$MAIN_JS, VUE_VENDOR=$VUE_VENDOR, PRIMEVUE_VENDOR=$PRIMEVUE_VENDOR, MAIN_CSS=$MAIN_CSS"
fi
echo ""

echo "[2/4] Preparing MANIFEST (version → $BUILD_VERSION)..."
cd "$BUNDLE_DIR"
cp META-INF/MANIFEST.MF META-INF/MANIFEST.MF.bak
sed -i "s/Bundle-Version: 1.0.0.qualifier/Bundle-Version: ${BUILD_VERSION}/" META-INF/MANIFEST.MF

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
    # Original deploy
    DEPLOY_JAR="$IDEMPIERE_HOME/plugins/$JAR_NAME"
    echo "[4/4] Deploying to $DEPLOY_JAR ..."
    cp "$OUTPUT_JAR" "$DEPLOY_JAR"

    # Also deploy to /opt/idempiere-server/x86_64/plugins/
    if [ -d "/opt/idempiere-server/x86_64/plugins/" ]; then
      cp "$OUTPUT_JAR" "/opt/idempiere-server/x86_64/plugins/$JAR_NAME"
      # Clear Jetty WAB cache for aesthetics bundle
      sudo rm -rf "/opt/idempiere-server/x86_64/jettyhome/work/jetty-0_0_0_0-8080-bundleFile-_aesthetics-any-" 2>/dev/null || true
    fi
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
        # Hot-deploy: uninstall old bundle and install new one (forces Jetty cache clear)
        echo "Uninstalling old bundle $BUNDLE_ID..."
        curl -ks -b /tmp/felix-deploy -X POST \
            "$FELIX_BASE/system/console/bundles/$BUNDLE_ID?action=uninstall" \
            -o /dev/null
        sleep 1

        echo "Installing new bundle..."
        curl -ks -b /tmp/felix-deploy -X POST \
            -F "action=install" \
            -F "bundlestart=start" \
            -F "bundlefile=@$DEPLOY_JAR" \
            "$FELIX_BASE/system/console/bundles" -o /dev/null
        sleep 2

        NEW_BUNDLE_ID=$(curl -ks -b /tmp/felix-deploy "$FELIX_BASE/system/console/bundles.json" | \
            python3 -c "import json,sys;data=json.load(sys.stdin);[print(b['id']) for b in data.get('data',[]) if b.get('symbolicName')=='$BUNDLE_SYM']" 2>/dev/null)
        echo "Bundle $NEW_BUNDLE_ID installed and started (hot-deploy)."
    else
        # First install — no existing bundle found
        curl -ks -b /tmp/felix-deploy -X POST \
            -F "action=install" \
            -F "bundlefile=@$DEPLOY_JAR" \
            -F "bundlestart=start" \
            "$FELIX_BASE/system/console/bundles" -o /dev/null
        BUNDLE_ID=$(curl -ks -b /tmp/felix-deploy "$FELIX_BASE/system/console/bundles.json" | \
            python3 -c "import json,sys;data=json.load(sys.stdin);[print(b['id']) for b in data.get('data',[]) if b.get('symbolicName')=='$BUNDLE_SYM']" 2>/dev/null)
        echo "Bundle $BUNDLE_ID installed and started."
    fi

    rm -f /tmp/felix-deploy
else
    echo "[4/4] Skipping deploy (use --deploy flag)"
fi

echo ""
echo "URL: https://<host>:8443/aesthetics/#/"
echo "=========================================="
echo ""

# After deploy, check if Jetty cache needs clearing
if [ "$1" = "--deploy" ] && [ -d "/opt/idempiere-server/x86_64/jettyhome/work/jetty-0_0_0_0-8080-bundleFile-_aesthetics-any-" ]; then
    echo ""
    echo "⚠️  NOTE: Jetty WAB cache detected"
    echo "If UI changes are not visible after hard refresh (Ctrl+Shift+R),"
    echo "run this command to clear Jetty cache:"
    echo ""
    echo "  sudo rm -rf /opt/idempiere-server/x86_64/jettyhome/work/jetty-0_0_0_0-8080-bundleFile-_aesthetics-any-"
    echo ""
    echo "Then restart the server:"
    echo "  sudo systemctl restart idempiere"
    echo ""
fi
