#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBAPP_DIR="$SCRIPT_DIR/webapp"
BUNDLE_DIR="$SCRIPT_DIR/osgi-bundle"
IDEMPIERE_HOME="${IDEMPIERE_HOME:-/opt/idempiere-server/x86_64}"

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
    echo ""
    echo "To activate, use Felix Web Console or restart iDempiere."
else
    echo "[4/4] Skipping deploy (use --deploy flag)"
fi

echo ""
echo "URL: https://<host>:8443/aesthetics/#/"
echo "=========================================="
