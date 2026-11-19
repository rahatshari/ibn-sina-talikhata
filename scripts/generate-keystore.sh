#!/usr/bin/env bash
set -euo pipefail

KEYSTORE_FILE="${1:-talikhata-release.jks}"
ALIAS_NAME="${2:-talikhata}"

echo "=================================================="
echo "Ibn Sina TallyKhata — One-Time Release Keystore"
echo "=================================================="
echo "Keystore file: $KEYSTORE_FILE"
echo "Key alias:     $ALIAS_NAME"
echo ""

keytool -genkeypair -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$ALIAS_NAME" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

echo ""
echo "--------------------------------------------------"
echo "1) Copy the base64 output below into GitHub Secret:"
echo "   Secret name: ANDROID_KEYSTORE_BASE64"
echo "--------------------------------------------------"
if base64 --help 2>&1 | grep -q "\-w"; then
  base64 -w 0 "$KEYSTORE_FILE"
else
  base64 "$KEYSTORE_FILE" | tr -d '\n'
fi
echo ""
echo ""
echo "--------------------------------------------------"
echo "2) Copy the SHA-1 fingerprint below into Firebase"
echo "   Project (tali-66089) -> Android App (com.rahat.talikhata):"
echo "--------------------------------------------------"
keytool -list -v -keystore "$KEYSTORE_FILE" -alias "$ALIAS_NAME" | grep -E "SHA1:|SHA256:"
